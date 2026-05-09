import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
} from 'firebase/firestore';
import { db, auth } from '@/firebase';
import { useAuth } from '@/components/AuthProvider';
import { handleFirestoreError, OperationType } from '@/lib/firestore-utils';
import { AlertCircle, Users } from 'lucide-react';
import type { Pass, Student, Teacher } from '@/lib/types';

interface NewStudentPending {
  name: string;
  originTeacherId: string;
  originTeacherName: string;
  originRoom: string;
}

export default function IncomingPane() {
  const { user } = useAuth();
  const [passes, setPasses] = useState<Pass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedOrigin, setSelectedOrigin] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [studyHallCapacity, setStudyHallCapacity] = useState(0);
  const [pendingNewStudent, setPendingNewStudent] = useState<NewStudentPending | null>(null);

  const [studentSearch, setStudentSearch] = useState('');
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    const qPasses = query(
      collection(db, 'passes'),
      where('destinationTeacherId', '==', user.uid),
      where('status', 'in', ['pending', 'in_transit', 'arrived']),
    );
    const unsubscribePasses = onSnapshot(
      qPasses,
      (snapshot) => {
        setPasses(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Pass)));
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'passes', false),
    );

    const unsubscribeStudents = onSnapshot(
      collection(db, 'students'),
      (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Student));
        data.sort((a, b) => a.name.localeCompare(b.name));
        setStudents(data);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'students', false),
    );

    const unsubscribeTeachers = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'teacher')),
      (snapshot) => {
        const data = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() } as Teacher))
          .filter((t) => !t.isAway);
        data.sort((a, b) => a.name.localeCompare(b.name));
        setTeachers(data);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'users', false),
    );

    const unsubscribeUserDoc = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          setStudyHallCapacity(snap.data()?.studyHallCapacity ?? 0);
        }
      },
    );

    return () => {
      unsubscribePasses();
      unsubscribeStudents();
      unsubscribeTeachers();
      unsubscribeUserDoc();
    };
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.student-search-container')) {
        setIsStudentDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activePasses = passes.filter(
    p => p.status === 'pending' || p.status === 'in_transit',
  );
  const isAtCapacity = studyHallCapacity > 0 && activePasses.length >= studyHallCapacity;

  const createPass = async (
    studentId: string,
    studentName: string,
    originTeacherId: string,
    originRoom: string,
  ): Promise<boolean> => {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) {
      setSubmitError('Authentication error. Please sign out and sign back in.');
      return false;
    }

    const response = await fetch('/api/passes/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        studentId,
        studentName,
        originTeacherId,
        originRoom,
        destinationTeacherId: user!.uid,
        destinationRoom: user!.roomNumber ?? '',
      }),
    });

    if (response.ok) {
      setSelectedStudent('');
      setStudentSearch('');
      setSelectedOrigin('');
      setSubmitError(null);
      return true;
    }

    const body = await response.json().catch(() => ({}));
    setSubmitError(body.error ?? 'Failed to create pass. Please try again.');
    return false;
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentSearch.trim() || !selectedOrigin || !user) return;
    setSubmitError(null);
    setSubmitting(true);

    const originTeacher = teachers.find((t: any) => t.id === selectedOrigin);
    if (!originTeacher) { setSubmitting(false); return; }

    try {
      let studentId = selectedStudent;
      let studentName = studentSearch.trim();

      if (!studentId) {
        const exactMatch = students.find(
          (s: any) => s.name.toLowerCase() === studentName.toLowerCase(),
        );
        if (exactMatch) {
          studentId = exactMatch.id;
          studentName = exactMatch.name;
          if (exactMatch.isAbsent) {
            setSubmitError(`${exactMatch.name} is absent today and cannot receive a pass.`);
            setSubmitting(false);
            return;
          }
        } else {
          setPendingNewStudent({
            name: studentName,
            originTeacherId: originTeacher.id,
            originTeacherName: originTeacher.name,
            originRoom: originTeacher.roomNumber ?? '',
          });
          setSubmitting(false);
          return;
        }
      } else {
        const student = students.find((s: any) => s.id === studentId);
        if (student) {
          studentName = student.name;
          if (student.isAbsent) {
            setSubmitError(`${student.name} is absent today and cannot receive a pass.`);
            setSubmitting(false);
            return;
          }
        }
      }

      await createPass(studentId, studentName, originTeacher.id, originTeacher.roomNumber ?? '');
    } catch (error) {
      console.error(error);
      setSubmitError('Failed to create pass. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmNewStudent = async () => {
    if (!pendingNewStudent || !user) return;
    setSubmitting(true);
    try {
      const newStudentRef = await addDoc(collection(db, 'students'), {
        name: pendingNewStudent.name,
        thirdPeriodTeacherId: pendingNewStudent.originTeacherId,
        notes: 'Created via pass request',
        isAbsent: false,
      });
      const ok = await createPass(
        newStudentRef.id,
        pendingNewStudent.name,
        pendingNewStudent.originTeacherId,
        pendingNewStudent.originRoom,
      );
      if (ok) setPendingNewStudent(null);
    } catch (error) {
      console.error(error);
      setSubmitError('Failed to create student. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReceive = async (passId: string) => {
    try {
      await updateDoc(doc(db, 'passes', passId), {
        status: 'arrived',
        arrivedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `passes/${passId}`);
    }
  };

  const handleComplete = async (pass: any) => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) return;
      const response = await fetch(`/api/passes/${pass.id}/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        console.error('Complete pass failed:', body);
      }
    } catch (error) {
      console.error('Failed to complete pass:', error);
    }
  };

  return (
    <div className="neo-box flex flex-col h-full">
      {pendingNewStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="neo-box bg-white max-w-md w-full mx-4 overflow-hidden">
            <div className="bg-neo-yellow border-b-4 border-neo-border p-4">
              <h3 className="text-xl font-black uppercase">Confirm New Student</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="font-bold">
                No student named <span className="bg-neo-yellow px-1">"{pendingNewStudent.name}"</span> exists in the system.
              </p>
              <p className="text-sm font-medium text-gray-600">
                Confirming will create a new student record assigned to{' '}
                <strong>{pendingNewStudent.originTeacherName}</strong>'s class.
                Make sure the name is spelled correctly — typos create phantom students.
              </p>
              {submitError && (
                <div className="bg-neo-red text-white p-3 border-4 border-neo-border font-bold flex items-start gap-2 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{submitError}</p>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setPendingNewStudent(null); setSubmitError(null); }}
                  className="neo-button bg-gray-200 flex-1 py-3 font-black uppercase"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmNewStudent}
                  className="neo-button bg-neo-green flex-1 py-3 font-black uppercase"
                  disabled={submitting}
                >
                  {submitting ? 'Creating...' : 'Confirm & Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-neo-blue text-white border-b-4 border-neo-border p-4 flex justify-between items-center">
        <h2 className="text-xl font-black uppercase">Incoming (Destination)</h2>
        {studyHallCapacity > 0 && (
          <div className={`flex items-center gap-2 px-3 py-1 border-2 border-white font-black text-sm ${isAtCapacity ? 'bg-neo-red animate-pulse' : 'bg-white/20'}`}>
            <Users className="w-4 h-4" />
            {activePasses.length}/{studyHallCapacity}
            {isAtCapacity && <span className="ml-1">FULL</span>}
          </div>
        )}
      </div>

      <div className="p-4 border-b-4 border-neo-border bg-gray-50">
        {isAtCapacity ? (
          <div className="bg-neo-red text-white border-4 border-neo-border p-4 font-black uppercase text-center">
            Room Full ({activePasses.length}/{studyHallCapacity}) — No new requests until a student is released
          </div>
        ) : (
          <form onSubmit={handleRequest} className="flex flex-col gap-3">
            {submitError && (
              <div className="bg-neo-red text-white p-3 border-4 border-neo-border font-bold flex items-start gap-2 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{submitError}</p>
              </div>
            )}

            <div className="flex flex-col gap-1 relative student-search-container">
              <label className="font-bold text-sm uppercase">1. Select Student</label>
              <div className="relative">
                <input
                  type="text"
                  className="neo-input w-full truncate"
                  placeholder="Search or type a student's name..."
                  value={studentSearch}
                  onChange={(e) => {
                    setStudentSearch(e.target.value);
                    setIsStudentDropdownOpen(true);
                    setSelectedStudent('');
                    setSelectedOrigin('');
                    setSubmitError(null);
                  }}
                  onFocus={() => setIsStudentDropdownOpen(true)}
                />
                {isStudentDropdownOpen && studentSearch && (
                  <div className="absolute z-20 w-full mt-1 bg-white border-4 border-neo-border max-h-48 overflow-y-auto shadow-lg">
                    {students.filter((s: any) =>
                      s.name.toLowerCase().includes(studentSearch.toLowerCase()),
                    ).length === 0 ? (
                      <div className="p-2 text-sm font-bold text-neo-yellow-dark bg-neo-yellow/20 border-b-2 border-neo-border">
                        No match — submitting will prompt you to create a new student.
                      </div>
                    ) : (
                      students
                        .filter((s: any) =>
                          s.name.toLowerCase().includes(studentSearch.toLowerCase()),
                        )
                        .slice(0, 50)
                        .map((s: any) => (
                          <div
                            key={s.id}
                            className={`p-2 hover:bg-neo-yellow cursor-pointer border-b-2 border-neo-border last:border-b-0 font-bold text-sm flex justify-between items-center ${s.isAbsent ? 'opacity-50' : ''}`}
                            onClick={() => {
                              setSelectedStudent(s.id);
                              setStudentSearch(s.name);
                              setIsStudentDropdownOpen(false);
                              if (s.thirdPeriodTeacherId) {
                                setSelectedOrigin(s.thirdPeriodTeacherId);
                              } else {
                                setSelectedOrigin('');
                              }
                            }}
                          >
                            <span>{s.name}</span>
                            {s.isAbsent && (
                              <span className="text-xs bg-neo-red text-white px-1 py-0.5 font-black">ABSENT</span>
                            )}
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-bold text-sm uppercase">2. Coming From (3rd Period Teacher)</label>
              <select
                className="neo-input cursor-pointer truncate"
                value={selectedOrigin}
                onChange={(e) => setSelectedOrigin(e.target.value)}
                required
              >
                <option value="" disabled>Select Origin Teacher...</option>
                {teachers.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name} (Room {t.roomNumber})</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="neo-button bg-neo-yellow px-4 py-3 mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Checking...' : 'Request Student'}
            </button>
          </form>
        )}
      </div>

      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        {loading ? (
          <p className="font-bold text-gray-400 animate-pulse">Loading incoming students...</p>
        ) : passes.length === 0 ? (
          <p className="font-bold text-gray-500">No incoming students.</p>
        ) : (
          passes.map(pass => (
            <div
              key={pass.id}
              className={`border-4 border-neo-border p-4 ${
                pass.status === 'in_transit'
                  ? 'bg-neo-yellow'
                  : pass.status === 'arrived'
                  ? 'bg-neo-green text-neo-border'
                  : 'bg-white'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div>
                  <p className="font-black text-lg">{pass.studentName}</p>
                  <p className="font-bold text-sm">
                    Status: {pass.status.replace('_', ' ').toUpperCase()}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  {pass.status === 'in_transit' && (
                    <button
                      onClick={() => handleReceive(pass.id)}
                      className="neo-button bg-neo-green text-neo-border px-4 py-3 w-full sm:w-auto min-h-[48px] font-black"
                    >
                      Received
                    </button>
                  )}
                  {pass.status === 'arrived' && (
                    <button
                      onClick={() => handleComplete(pass)}
                      className="neo-button bg-neo-border text-white px-4 py-3 w-full sm:w-auto min-h-[48px] font-black"
                    >
                      Complete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

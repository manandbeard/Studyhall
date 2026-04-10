'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAuth } from '@/components/AuthProvider';
import { handleFirestoreError, OperationType } from '@/lib/firestore-utils';

export default function IncomingPane() {
  const { user } = useAuth();
  const [passes, setPasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedOrigin, setSelectedOrigin] = useState('');
  const [loading, setLoading] = useState(true);

  const [studentSearch, setStudentSearch] = useState('');
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Listen for incoming passes
    const qPasses = query(
      collection(db, 'passes'),
      where('destinationTeacherId', '==', user.uid),
      where('status', 'in', ['pending', 'in_transit', 'arrived'])
    );

    const unsubscribePasses = onSnapshot(qPasses, (snapshot) => {
      const passData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPasses(passData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'passes');
    });

    // Listen for all students to populate dropdown in real-time
    const unsubscribeStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
      const studentData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort students alphabetically by name
      studentData.sort((a: any, b: any) => a.name.localeCompare(b.name));
      setStudents(studentData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'students');
    });

    // Listen for all teachers
    const unsubscribeTeachers = onSnapshot(query(collection(db, 'users'), where('role', '==', 'teacher')), (snapshot) => {
      const teacherData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter(t => !t.isAway); // Filter out teachers who are away
      teacherData.sort((a: any, b: any) => a.name.localeCompare(b.name));
      setTeachers(teacherData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => {
      unsubscribePasses();
      unsubscribeStudents();
      unsubscribeTeachers();
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

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentSearch.trim() || !selectedOrigin || !user) return;

    const originTeacher = teachers.find(t => t.id === selectedOrigin);
    if (!originTeacher) return;

    let studentId = selectedStudent;
    let studentName = studentSearch.trim();

    try {
      if (!studentId) {
        const existingStudent = students.find(s => s.name.toLowerCase() === studentName.toLowerCase());
        if (existingStudent) {
          studentId = existingStudent.id;
          studentName = existingStudent.name;
        } else {
          const newStudentRef = await addDoc(collection(db, 'students'), {
            name: studentName,
            thirdPeriodTeacherId: originTeacher.id,
            notes: 'Created via pass request',
            isAbsent: false
          });
          studentId = newStudentRef.id;
        }
      } else {
        const student = students.find(s => s.id === studentId);
        if (student) studentName = student.name;
      }

      await addDoc(collection(db, 'passes'), {
        studentId: studentId,
        studentName: studentName,
        originTeacherId: originTeacher.id,
        destinationTeacherId: user.uid,
        destinationRoom: user.roomNumber,
        status: 'pending',
        requestedAt: new Date().toISOString()
      });
      setSelectedStudent('');
      setStudentSearch('');
      setSelectedOrigin('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'passes');
    }
  };

  const handleReceive = async (passId: string) => {
    try {
      await updateDoc(doc(db, 'passes', passId), {
        status: 'arrived',
        arrivedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `passes/${passId}`);
    }
  };

  const handleComplete = async (passId: string) => {
    try {
      await updateDoc(doc(db, 'passes', passId), {
        status: 'completed',
        completedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `passes/${passId}`);
    }
  };

  return (
    <div className="neo-box flex flex-col h-full">
      <div className="bg-neo-blue text-white border-b-4 border-neo-border p-4">
        <h2 className="text-xl font-black uppercase">Incoming (Destination)</h2>
      </div>
      
      <div className="p-4 border-b-4 border-neo-border bg-gray-50">
        <form onSubmit={handleRequest} className="flex flex-col gap-3">
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
                }}
                onFocus={() => setIsStudentDropdownOpen(true)}
              />
              {isStudentDropdownOpen && studentSearch && (
                <div className="absolute z-20 w-full mt-1 bg-white border-4 border-neo-border max-h-48 overflow-y-auto shadow-lg">
                  {students.filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase())).length === 0 ? (
                    <div className="p-2 text-sm text-gray-500 font-bold">No students found. A new student will be created.</div>
                  ) : (
                    students
                      .filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase()))
                      .slice(0, 50) // Limit to 50 for performance
                      .map(s => (
                        <div 
                          key={s.id} 
                          className="p-2 hover:bg-neo-yellow cursor-pointer border-b-2 border-neo-border last:border-b-0 font-bold text-sm"
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
                          {s.name}
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
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.name} (Room {t.roomNumber})</option>
              ))}
            </select>
          </div>

          <button type="submit" className="neo-button bg-neo-yellow px-4 py-3 mt-2">
            Request Student
          </button>
        </form>
      </div>

      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        {loading ? (
          <p className="font-bold text-gray-400 animate-pulse">Loading incoming students...</p>
        ) : passes.length === 0 ? (
          <p className="font-bold text-gray-500">No incoming students.</p>
        ) : (
          passes.map(pass => (
            <div key={pass.id} className={`border-4 border-neo-border p-4 ${
              pass.status === 'in_transit' ? 'bg-neo-yellow' : 
              pass.status === 'arrived' ? 'bg-neo-green text-neo-border' : 'bg-white'
            }`}>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-black text-lg">{pass.studentName}</p>
                  <p className="font-bold text-sm">Status: {pass.status.replace('_', ' ').toUpperCase()}</p>
                </div>
                <div className="flex gap-2">
                  {pass.status === 'in_transit' && (
                    <button 
                      onClick={() => handleReceive(pass.id)}
                      className="neo-button bg-neo-green text-neo-border px-4 py-2"
                    >
                      Received
                    </button>
                  )}
                  {pass.status === 'arrived' && (
                    <button 
                      onClick={() => handleComplete(pass.id)}
                      className="neo-button bg-neo-border text-white px-4 py-2"
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

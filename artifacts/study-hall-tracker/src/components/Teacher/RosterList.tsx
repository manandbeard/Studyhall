import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  getDocs,
  getDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '@/firebase';
import { useAuth } from '@/components/AuthProvider';
import { handleFirestoreError, OperationType } from '@/lib/firestore-utils';
import type { Student } from '@/lib/types';
import { UserX, UserCheck, Search, Edit3, Trash2, AlertTriangle } from 'lucide-react';

export default function RosterList({ onRosterCleared }: { onRosterCleared?: () => void }) {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState('');
  const [cancelNotice, setCancelNotice] = useState<string | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearingRoster, setClearingRoster] = useState(false);
  const [clearNotice, setClearNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'students'), where('thirdPeriodTeacherId', '==', user.uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const studentData = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Student));
        studentData.sort((a: any, b: any) => a.name.localeCompare(b.name));
        setStudents(studentData);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'students', false);
      },
    );

    return () => unsubscribe();
  }, [user]);

  const toggleAbsent = async (student: any) => {
    const newAbsent = !student.isAbsent;
    try {
      await updateDoc(doc(db, 'students', student.id), { isAbsent: newAbsent });

      if (newAbsent) {
        // Cancel both pending and in_transit passes to clean up locks/counters.
        const pendingQ = query(
          collection(db, 'passes'),
          where('studentId', '==', student.id),
          where('status', 'in', ['pending', 'in_transit']),
        );
        const pendingSnap = await getDocs(pendingQ);

        if (!pendingSnap.empty) {
          const now = new Date().toISOString();

          // Read all counter docs before the batch so we can compute a safe floor-guarded decrement.
          const counterIds = [
            ...new Set(
              pendingSnap.docs
                .map((d) => d.data().destinationTeacherId as string | undefined)
                .filter((id): id is string => !!id),
            ),
          ];
          // Read counter docs directly by ID (more efficient than a filtered query).
          const counterValues: Record<string, number> = {};
          await Promise.all(
            counterIds.map(async (id) => {
              const snap = await getDoc(doc(db, 'teacherActiveCount', id));
              counterValues[id] = (snap.data()?.count as number) ?? 0;
            }),
          );

          // Count how many passes we are cancelling per destination teacher.
          const decrements: Record<string, number> = {};
          for (const passDoc of pendingSnap.docs) {
            const destId = passDoc.data().destinationTeacherId as string | undefined;
            if (destId) {
              decrements[destId] = (decrements[destId] ?? 0) + 1;
            }
          }

          const batch = writeBatch(db);

          for (const passDoc of pendingSnap.docs) {
            const passData = passDoc.data();
            batch.update(passDoc.ref, {
              status: 'cancelled',
              cancelledAt: now,
              cancelledReason: 'student_absent',
            });
          }

          // Write the counter decrements once per affected teacher (not once per pass)
          // to avoid redundant batch operations writing the same value multiple times.
          for (const [destId, decrement] of Object.entries(decrements)) {
            const counterRef = doc(db, 'teacherActiveCount', destId);
            const current = counterValues[destId] ?? 0;
            batch.set(counterRef, { count: Math.max(0, current - decrement) }, { merge: true });
          }

          const lockRef = doc(db, 'activeStudentPasses', student.id);
          batch.delete(lockRef);

          await batch.commit();

          const count = pendingSnap.size;
          const notice = `${student.name} marked absent — ${count} active pass${count > 1 ? 'es' : ''} cancelled.`;
          setCancelNotice(notice);
          setTimeout(() => setCancelNotice(null), 6000);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `students/${student.id}`);
    }
  };

  const saveNotes = async (studentId: string) => {
    try {
      await updateDoc(doc(db, 'students', studentId), {
        notes: notesValue,
      });
      setEditingNotesId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `students/${studentId}`);
    }
  };

  const clearRoster = async () => {
    if (!user) return;
    if (!clearConfirm) {
      setClearConfirm(true);
      return;
    }

    setClearingRoster(true);
    setClearNotice(null);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error('Authentication error. Please sign out and sign back in.');
      }

      const response = await fetch('/api/roster/clear', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error ?? 'Failed to clear roster.');
      }

      const clearedStudents = Number(body.clearedStudents ?? 0);
      const cancelledPasses = Number(body.cancelledPasses ?? 0);

      if (clearedStudents === 0) {
        setClearNotice({ text: 'Roster is already empty.', type: 'success' });
        setClearConfirm(false);
        return;
      }

      setClearNotice({
        text: `Cleared ${clearedStudents} student${clearedStudents === 1 ? '' : 's'} and cancelled ${cancelledPasses} active pass${cancelledPasses === 1 ? '' : 'es'}. Google Classroom disconnected.`,
        type: 'success',
      });
      setClearConfirm(false);
      setSearchTerm('');
      onRosterCleared?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to clear roster.';
      setClearNotice({ text: message, type: 'error' });
      setClearConfirm(false);
      handleFirestoreError(error, OperationType.DELETE, `students?thirdPeriodTeacherId=${user.uid}`, false);
    } finally {
      setClearingRoster(false);
    }
  };

  const filteredStudents = students.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="neo-box flex flex-col h-full bg-white">
      <div className="bg-neo-border text-white border-b-4 border-neo-border p-4 flex justify-between items-center">
        <h2 className="text-xl font-black uppercase">Class Roster</h2>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            onClick={clearRoster}
            disabled={clearingRoster || students.length === 0}
            className="neo-button bg-neo-red text-white px-3 py-2 text-xs flex items-center gap-2 disabled:opacity-60"
          >
            <Trash2 className="w-4 h-4" />
            {clearingRoster ? 'Clearing...' : clearConfirm ? 'Confirm Clear' : 'Clear Roster'}
          </button>
          <div className="relative w-48 text-neo-border">
            <input
              type="text"
              placeholder="Search roster..."
              className="neo-input w-full pl-8 py-1 text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="w-4 h-4 absolute left-2 top-2 text-gray-500" />
          </div>
        </div>
      </div>

      {cancelNotice && (
        <div className="bg-neo-yellow border-b-4 border-neo-border px-4 py-2 font-black text-sm uppercase text-neo-border">
          {cancelNotice}
        </div>
      )}

      {clearConfirm && (
        <div className="bg-neo-yellow border-b-4 border-neo-border px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-neo-border">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-black text-sm uppercase">
              Remove all {students.length} student{students.length === 1 ? '' : 's'} and disconnect Google Classroom?
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearRoster}
              disabled={clearingRoster}
              className="neo-button bg-neo-red text-white px-3 py-2 text-xs"
            >
              Yes, Clear All
            </button>
            <button
              onClick={() => setClearConfirm(false)}
              className="neo-button bg-white text-neo-border px-3 py-2 text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {clearNotice && (
        <div className={`${clearNotice.type === 'error' ? 'bg-neo-red text-white' : 'bg-neo-green text-neo-border'} border-b-4 border-neo-border px-4 py-2 font-black text-sm uppercase`}>
          {clearNotice.text}
        </div>
      )}

      <div className="p-4 flex-1 overflow-y-auto">
        {loading ? (
          <p className="font-bold text-gray-400 animate-pulse p-4">Loading roster...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {filteredStudents.map((student) => (
              <div
                key={student.id}
                className={`border-2 border-neo-border p-2 flex flex-col ${
                  student.isAbsent ? 'bg-gray-100 opacity-60' : 'bg-white'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span
                    className={`font-bold text-sm truncate ${
                      student.isAbsent ? 'line-through text-gray-500' : ''
                    }`}
                  >
                    {student.name}
                  </span>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => {
                        if (editingNotesId === student.id) {
                          setEditingNotesId(null);
                        } else {
                          setEditingNotesId(student.id);
                          setNotesValue(student.notes || '');
                        }
                      }}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center border-2 border-neo-border bg-neo-yellow text-neo-border transition-colors"
                      title="Edit Notes"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleAbsent(student)}
                      className={`min-w-[44px] min-h-[44px] flex items-center justify-center border-2 border-neo-border transition-colors ${
                        student.isAbsent
                          ? 'bg-neo-red text-white'
                          : 'bg-neo-green text-neo-border'
                      }`}
                      title={student.isAbsent ? 'Mark Present' : 'Mark Absent'}
                    >
                      {student.isAbsent ? (
                        <UserX className="w-4 h-4" />
                      ) : (
                        <UserCheck className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {editingNotesId === student.id ? (
                  <div className="mt-2 flex gap-1">
                    <input
                      type="text"
                      value={notesValue}
                      onChange={(e) => setNotesValue(e.target.value)}
                      className="neo-input flex-1 text-xs py-1 px-2"
                      placeholder="Add notes..."
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveNotes(student.id);
                        if (e.key === 'Escape') setEditingNotesId(null);
                      }}
                    />
                    <button
                      onClick={() => saveNotes(student.id)}
                      className="neo-button bg-neo-blue text-white text-xs px-2 py-1"
                    >
                      Save
                    </button>
                  </div>
                ) : student.notes ? (
                  <div
                    className="mt-1 text-xs text-gray-600 italic truncate"
                    title={student.notes}
                  >
                    {student.notes}
                  </div>
                ) : null}
              </div>
            ))}
            {filteredStudents.length === 0 && (
              <p className="col-span-full text-center font-bold text-gray-500 py-4">
                {searchTerm
                  ? 'No students found matching search.'
                  : 'No students in roster. Use the import tool below.'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

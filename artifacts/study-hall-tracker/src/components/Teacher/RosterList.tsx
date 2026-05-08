import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  getDocs,
  writeBatch,
  increment,
} from 'firebase/firestore';
import { db } from '@/firebase';
import { useAuth } from '@/components/AuthProvider';
import { handleFirestoreError, OperationType } from '@/lib/firestore-utils';
import { UserX, UserCheck, Search, Edit3 } from 'lucide-react';

export default function RosterList() {
  const { user } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState('');
  const [cancelNotice, setCancelNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'students'), where('thirdPeriodTeacherId', '==', user.uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const studentData = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        studentData.sort((a: any, b: any) => a.name.localeCompare(b.name));
        setStudents(studentData);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'students');
      },
    );

    return () => unsubscribe();
  }, [user]);

  const toggleAbsent = async (student: any) => {
    const newAbsent = !student.isAbsent;
    try {
      await updateDoc(doc(db, 'students', student.id), { isAbsent: newAbsent });

      if (newAbsent) {
        const pendingQ = query(
          collection(db, 'passes'),
          where('studentId', '==', student.id),
          where('status', '==', 'pending'),
        );
        const pendingSnap = await getDocs(pendingQ);

        if (!pendingSnap.empty) {
          const now = new Date().toISOString();
          const batch = writeBatch(db);

          for (const passDoc of pendingSnap.docs) {
            const passData = passDoc.data();
            batch.update(passDoc.ref, {
              status: 'cancelled',
              cancelledAt: now,
              cancelledReason: 'student_absent',
            });
            if (passData.destinationTeacherId) {
              const counterRef = doc(db, 'teacherActiveCount', passData.destinationTeacherId);
              batch.set(counterRef, { count: increment(-1) }, { merge: true });
            }
          }

          const lockRef = doc(db, 'activeStudentPasses', student.id);
          batch.delete(lockRef);

          await batch.commit();

          const count = pendingSnap.size;
          const notice = `${student.name} marked absent — ${count} pending pass${count > 1 ? 'es' : ''} cancelled.`;
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

  const filteredStudents = students.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="neo-box flex flex-col h-full bg-white">
      <div className="bg-neo-border text-white border-b-4 border-neo-border p-4 flex justify-between items-center">
        <h2 className="text-xl font-black uppercase">Class Roster</h2>
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

      {cancelNotice && (
        <div className="bg-neo-yellow border-b-4 border-neo-border px-4 py-2 font-black text-sm uppercase text-neo-border">
          {cancelNotice}
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
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        if (editingNotesId === student.id) {
                          setEditingNotesId(null);
                        } else {
                          setEditingNotesId(student.id);
                          setNotesValue(student.notes || '');
                        }
                      }}
                      className="p-1 border-2 border-neo-border bg-neo-yellow text-neo-border transition-colors"
                      title="Edit Notes"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleAbsent(student)}
                      className={`p-1 border-2 border-neo-border transition-colors ${
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

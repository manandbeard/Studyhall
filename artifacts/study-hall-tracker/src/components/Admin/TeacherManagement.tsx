import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { auth } from '@/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-utils';
import { Edit2, MailPlus, Save, X } from 'lucide-react';
import type { Teacher } from '@/lib/types';

export default function TeacherManagement() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', roomNumber: '', email: '' });
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', roomNumber: '', email: '' });
  const [inviteState, setInviteState] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'teacher'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const teacherData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Teacher));
      teacherData.sort((a: any, b: any) => a.name.localeCompare(b.name));
      setTeachers(teacherData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users', false);
    });

    return () => unsubscribe();
  }, []);

  const handleEdit = (teacher: any) => {
    setEditingId(teacher.id);
    setEditForm({ name: teacher.name, roomNumber: teacher.roomNumber || '', email: teacher.email || '' });
  };

  const handleSave = async (id: string) => {
    try {
      await updateDoc(doc(db, 'users', id), {
        name: editForm.name,
        roomNumber: editForm.roomNumber,
        email: editForm.email
      });
      setEditingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${id}`);
    }
  };

  const handleInviteTeacher = async () => {
    setInviteState(null);
    setInviting(true);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error('Authentication expired. Please sign out and sign back in.');
      }

      const response = await fetch('/api/admin/invite-teacher', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          email: inviteForm.email,
          name: inviteForm.name,
          roomNumber: inviteForm.roomNumber,
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const fallback =
          response.status === 401
            ? 'Session expired. Please sign in again.'
            : response.status === 403
              ? 'Admin permission required.'
              : response.status === 404
                ? 'Invite endpoint not found (404). The API server may not be running or reachable.'
                : response.status === 409
                  ? 'A teacher with that email already exists.'
                  : `Failed to invite teacher (HTTP ${response.status}).`;
        throw new Error(typeof body.error === 'string' ? body.error : fallback);
      }

      setInviteForm({ name: '', roomNumber: '', email: '' });
      setInviteState({
        tone: 'success',
        text: `Invite created for ${inviteForm.email.trim().toLowerCase()}. The placeholder will activate when they sign in.`,
      });
      setShowInviteForm(false);
    } catch (error) {
      setInviteState({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Failed to invite teacher.',
      });
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="neo-box flex flex-col h-[80vh] bg-white">
      <div className="p-4 border-b-4 border-neo-border bg-neo-yellow">
        <h2 className="text-xl font-black uppercase">Teacher Roster Management</h2>
        <p className="font-bold text-sm mt-1">Edit room numbers and names for active teachers.</p>
      </div>

      <div className="border-b-4 border-neo-border bg-gray-50 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-black uppercase">Invite Teacher</h3>
            <p className="text-sm font-bold text-gray-600">Create a placeholder teacher account by school email.</p>
          </div>
          <button
            onClick={() => setShowInviteForm((current) => !current)}
            className="neo-button bg-neo-blue text-white px-4 py-2 text-sm flex items-center gap-2"
          >
            <MailPlus className="w-4 h-4" />
            {showInviteForm ? 'Close Invite' : 'Add Teacher'}
          </button>
        </div>

        {inviteState && (
          <div className={`border-2 border-neo-border px-3 py-2 text-sm font-black ${
            inviteState.tone === 'success' ? 'bg-neo-green text-neo-border' : 'bg-neo-red text-white'
          }`}>
            {inviteState.text}
          </div>
        )}

        {showInviteForm && (
          <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1.5fr_1fr_auto] gap-3 items-end">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-black uppercase">Teacher Name</span>
              <input
                type="text"
                className="neo-input w-full py-2"
                value={inviteForm.name}
                onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                placeholder="Jane Smith"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-black uppercase">School Email</span>
              <input
                type="email"
                className="neo-input w-full py-2"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                placeholder="teacher@school.org"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-black uppercase">Room #</span>
              <input
                type="text"
                className="neo-input w-full py-2"
                value={inviteForm.roomNumber}
                onChange={(e) => setInviteForm({ ...inviteForm, roomNumber: e.target.value })}
                placeholder="TBD"
              />
            </label>
            <button
              onClick={handleInviteTeacher}
              disabled={inviting || !inviteForm.name.trim() || !inviteForm.email.trim()}
              className="neo-button bg-neo-yellow text-neo-border px-4 py-2 text-sm disabled:opacity-60"
            >
              {inviting ? 'Inviting...' : 'Send Invite'}
            </button>
          </div>
        )}
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-4 border-neo-border">
              <th className="p-2 font-black uppercase">Name</th>
              <th className="p-2 font-black uppercase">Email</th>
              <th className="p-2 font-black uppercase">Room #</th>
              <th className="p-2 font-black uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map(teacher => (
              <tr key={teacher.id} className="border-b-2 border-neo-border/20 hover:bg-gray-50">
                <td className="p-2 font-bold">
                  {editingId === teacher.id ? (
                    <input
                      type="text"
                      className="neo-input w-full py-1"
                      value={editForm.name}
                      onChange={e => setEditForm({...editForm, name: e.target.value})}
                    />
                  ) : teacher.name}
                  {teacher.isPlaceholder && <span className="ml-2 text-xs bg-neo-yellow text-neo-border px-1">Placeholder</span>}
                </td>
                <td className="p-2 text-sm">
                  {editingId === teacher.id ? (
                    <input
                      type="email"
                      className="neo-input w-full py-1"
                      value={editForm.email}
                      onChange={e => setEditForm({...editForm, email: e.target.value})}
                    />
                  ) : teacher.email}
                </td>
                <td className="p-2 font-bold">
                  {editingId === teacher.id ? (
                    <input
                      type="text"
                      className="neo-input w-24 py-1"
                      value={editForm.roomNumber}
                      onChange={e => setEditForm({...editForm, roomNumber: e.target.value})}
                    />
                  ) : (teacher.roomNumber || 'TBD')}
                </td>
                <td className="p-2 text-right">
                  {editingId === teacher.id ? (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleSave(teacher.id)} className="neo-button bg-neo-green p-2">
                        <Save className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="neo-button bg-neo-red text-white p-2">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => handleEdit(teacher)} className="neo-button bg-neo-blue text-white p-2">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {teachers.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-center font-bold text-gray-500">
                  No teachers have logged in yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

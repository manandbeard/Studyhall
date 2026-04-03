'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-utils';
import { Edit2, Save, X } from 'lucide-react';

export default function TeacherManagement() {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', roomNumber: '' });

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'teacher'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const teacherData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      teacherData.sort((a: any, b: any) => a.name.localeCompare(b.name));
      setTeachers(teacherData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, []);

  const handleEdit = (teacher: any) => {
    setEditingId(teacher.id);
    setEditForm({ name: teacher.name, roomNumber: teacher.roomNumber || '' });
  };

  const handleSave = async (id: string) => {
    try {
      await updateDoc(doc(db, 'users', id), {
        name: editForm.name,
        roomNumber: editForm.roomNumber
      });
      setEditingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${id}`);
    }
  };

  return (
    <div className="neo-box flex flex-col h-[80vh] bg-white">
      <div className="p-4 border-b-4 border-neo-border bg-neo-yellow">
        <h2 className="text-xl font-black uppercase">Teacher Roster Management</h2>
        <p className="font-bold text-sm mt-1">Edit room numbers and names for active teachers.</p>
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
                </td>
                <td className="p-2 text-sm">{teacher.email}</td>
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

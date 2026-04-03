'use client';

import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAuth } from '@/components/AuthProvider';
import { handleFirestoreError, OperationType } from '@/lib/firestore-utils';
import { Save, User, Phone, MapPin, Bell, Power } from 'lucide-react';

export default function TeacherSettings() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: user?.name || '',
    roomNumber: user?.roomNumber || '',
    phoneNumber: user?.phoneNumber || '',
    isAway: user?.isAway || false,
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSuccess(false);

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name: formData.name,
        roomNumber: formData.roomNumber,
        phoneNumber: formData.phoneNumber,
        isAway: formData.isAway,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="neo-box bg-white overflow-hidden">
      <div className="bg-neo-blue text-white p-4 border-b-4 border-neo-border">
        <h2 className="text-xl font-black uppercase flex items-center gap-2">
          <User className="w-6 h-6" />
          Teacher Settings
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-black uppercase text-sm text-gray-500 border-b-2 border-neo-border pb-1">Profile Info</h3>
            
            <div className="space-y-1">
              <label className="font-bold text-sm uppercase flex items-center gap-2">
                <User className="w-4 h-4" /> Display Name
              </label>
              <input 
                type="text" 
                className="neo-input w-full"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-sm uppercase flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Room Number
              </label>
              <input 
                type="text" 
                className="neo-input w-full"
                value={formData.roomNumber}
                onChange={(e) => setFormData({...formData, roomNumber: e.target.value})}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-sm uppercase flex items-center gap-2">
                <Phone className="w-4 h-4" /> Phone Number (Optional)
              </label>
              <input 
                type="tel" 
                className="neo-input w-full"
                placeholder="(555) 000-0000"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
              />
            </div>
          </div>

          {/* System Preferences */}
          <div className="space-y-4">
            <h3 className="font-black uppercase text-sm text-gray-500 border-b-2 border-neo-border pb-1">System Preferences</h3>
            
            <div className="neo-box p-4 bg-gray-50 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full border-2 border-neo-border ${formData.isAway ? 'bg-neo-red' : 'bg-neo-green'}`}>
                    <Power className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-black text-sm uppercase">Away Status</p>
                    <p className="text-xs font-bold text-gray-500">Stop receiving new student requests</p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, isAway: !formData.isAway})}
                  className={`neo-button px-4 py-1 text-xs font-black uppercase ${formData.isAway ? 'bg-neo-red text-white' : 'bg-gray-200'}`}
                >
                  {formData.isAway ? 'Away' : 'Active'}
                </button>
              </div>

              <div className="flex items-center justify-between opacity-50 cursor-not-allowed">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full border-2 border-neo-border bg-gray-200">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-black text-sm uppercase">Sound Alerts</p>
                    <p className="text-xs font-bold text-gray-500">Play sound on new requests (Pro feature)</p>
                  </div>
                </div>
                <div className="w-12 h-6 bg-gray-300 rounded-full border-2 border-neo-border"></div>
              </div>
            </div>

            <div className="p-4 bg-neo-yellow/10 border-2 border-dashed border-neo-yellow rounded-lg">
              <p className="text-xs font-bold text-neo-yellow-dark">
                Tip: Marking yourself as &quot;Away&quot; will hide you from the student selection list for other teachers.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t-4 border-neo-border flex justify-between items-center">
          {success && (
            <p className="text-neo-green font-black uppercase text-sm animate-bounce">
              Settings Saved Successfully!
            </p>
          )}
          <button 
            type="submit" 
            disabled={saving}
            className="neo-button bg-neo-green px-8 py-3 font-black uppercase flex items-center gap-2 ml-auto"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}

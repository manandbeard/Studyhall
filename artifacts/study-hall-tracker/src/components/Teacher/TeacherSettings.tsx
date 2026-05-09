import { useState, useEffect } from 'react';
import {
  doc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/firebase';
import { useAuth } from '@/components/AuthProvider';
import { handleFirestoreError, OperationType } from '@/lib/firestore-utils';
import { Save, User, Phone, MapPin, Bell, BellOff, Power, Users, RefreshCw } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';

export default function TeacherSettings() {
  const { user } = useAuth();
  const { soundMuted: liveMuted } = useNotifications();
  const [formData, setFormData] = useState({
    name: user?.name || '',
    roomNumber: user?.roomNumber || '',
    phoneNumber: user?.phoneNumber || '',
    isAway: user?.isAway || false,
    studyHallCapacity: user?.studyHallCapacity ?? 0,
    soundMuted: user?.soundMuted ?? false,
  });

  // Sync form fields when the user doc changes externally (e.g. from another device).
  // `saving` is intentionally excluded from deps: we only want to sync when the
  // server pushes a change, not when a local save is in flight.
  useEffect(() => {
    if (!user || saving) return;
    setFormData({
      name: user.name || '',
      roomNumber: user.roomNumber || '',
      phoneNumber: user.phoneNumber || '',
      isAway: user.isAway || false,
      studyHallCapacity: user.studyHallCapacity ?? 0,
      soundMuted: user.soundMuted ?? false,
    });
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [clearingAbsent, setClearingAbsent] = useState(false);
  const [clearAbsentSuccess, setClearAbsentSuccess] = useState(false);

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
        studyHallCapacity: formData.studyHallCapacity,
        soundMuted: formData.soundMuted,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClearAbsentFlags = async () => {
    if (!user) return;
    setClearingAbsent(true);
    setClearAbsentSuccess(false);
    try {
      const q = query(
        collection(db, 'students'),
        where('thirdPeriodTeacherId', '==', user.uid),
        where('isAbsent', '==', true),
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setClearAbsentSuccess(true);
        setTimeout(() => setClearAbsentSuccess(false), 3000);
        return;
      }
      const batch = writeBatch(db);
      for (const d of snap.docs) {
        batch.update(d.ref, { isAbsent: false });
      }
      await batch.commit();
      setClearAbsentSuccess(true);
      setTimeout(() => setClearAbsentSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'students/absent-reset');
    } finally {
      setClearingAbsent(false);
    }
  };

  const isMuted = formData.soundMuted;

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
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
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
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-sm uppercase flex items-center gap-2">
                <Users className="w-4 h-4" /> Study Hall Capacity
              </label>
              <input
                type="number"
                min="0"
                max="99"
                className="neo-input w-full"
                value={formData.studyHallCapacity}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    studyHallCapacity: Math.max(0, parseInt(e.target.value) || 0),
                  })
                }
              />
              <p className="text-xs font-bold text-gray-500">
                Max students allowed at once. Set to 0 for unlimited.
              </p>
            </div>
          </div>

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
                  onClick={() => setFormData({ ...formData, isAway: !formData.isAway })}
                  className={`neo-button px-4 py-1 text-xs font-black uppercase ${formData.isAway ? 'bg-neo-red text-white' : 'bg-gray-200'}`}
                >
                  {formData.isAway ? 'Away' : 'Active'}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full border-2 border-neo-border ${isMuted ? 'bg-gray-400' : 'bg-neo-blue'}`}>
                    {isMuted ? (
                      <BellOff className="w-4 h-4 text-white" />
                    ) : (
                      <Bell className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div>
                    <p className="font-black text-sm uppercase">Sound Alerts</p>
                    <p className="text-xs font-bold text-gray-500">
                      {isMuted ? 'All audio pings are muted' : 'Pings on new requests, arrivals & overdue'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, soundMuted: !formData.soundMuted })}
                  className={`neo-button px-4 py-1 text-xs font-black uppercase ${isMuted ? 'bg-gray-400 text-white' : 'bg-neo-blue text-white'}`}
                >
                  {isMuted ? 'Muted' : 'On'}
                </button>
              </div>
            </div>

            <div className="neo-box p-4 bg-gray-50 space-y-3">
              <h4 className="font-black uppercase text-sm">Daily Reset</h4>
              <p className="text-xs font-bold text-gray-600">
                Clear all absent flags for your roster. Use at the start of each school day.
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleClearAbsentFlags}
                  disabled={clearingAbsent}
                  className="neo-button bg-neo-yellow px-4 py-2 text-sm font-black uppercase flex items-center gap-2 disabled:opacity-60"
                >
                  <RefreshCw className={`w-4 h-4 ${clearingAbsent ? 'animate-spin' : ''}`} />
                  {clearingAbsent ? 'Clearing...' : 'Clear My Absent Flags'}
                </button>
                {clearAbsentSuccess && (
                  <span className="text-neo-green font-black text-sm uppercase animate-bounce">
                    Done!
                  </span>
                )}
              </div>
            </div>

            {liveMuted && (
              <div className="p-3 bg-neo-yellow/20 border-2 border-neo-yellow font-bold text-xs text-neo-border">
                Sound is currently muted. Save settings to persist the change.
              </div>
            )}

            <div className="p-4 bg-neo-yellow/10 border-2 border-dashed border-neo-yellow rounded-lg">
              <p className="text-xs font-bold text-neo-yellow-dark">
                Tip: Marking yourself as "Away" hides you from the student selection list for other teachers.
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

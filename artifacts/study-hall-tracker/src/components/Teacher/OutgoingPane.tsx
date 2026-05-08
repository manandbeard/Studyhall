import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAuth } from '@/components/AuthProvider';
import { handleFirestoreError, OperationType } from '@/lib/firestore-utils';
import { differenceInMinutes } from 'date-fns';

export default function OutgoingPane() {
  const { user } = useAuth();
  const [passes, setPasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'passes'),
      where('originTeacherId', '==', user.uid),
      where('status', 'in', ['pending', 'in_transit']),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const passData = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPasses(passData);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'passes');
      },
    );

    return () => unsubscribe();
  }, [user]);

  const handleSend = async (passId: string) => {
    try {
      await updateDoc(doc(db, 'passes', passId), {
        status: 'in_transit',
        departedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `passes/${passId}`);
    }
  };

  const isOverdue = (departedAt: string) => {
    if (!departedAt) return false;
    return differenceInMinutes(currentTime, new Date(departedAt)) >= 5;
  };

  return (
    <div className="neo-box flex flex-col h-full">
      <div className="bg-neo-yellow border-b-4 border-neo-border p-4">
        <h2 className="text-xl font-black uppercase">Outgoing (3rd Period)</h2>
      </div>
      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        {loading ? (
          <p className="font-bold text-gray-400 animate-pulse">Loading passes...</p>
        ) : passes.length === 0 ? (
          <p className="font-bold text-gray-500">No pending requests.</p>
        ) : (
          passes.map((pass) => {
            const overdue = pass.status === 'in_transit' && isOverdue(pass.departedAt);
            return (
              <div
                key={pass.id}
                className={`border-4 border-neo-border p-4 ${
                  pass.status === 'pending'
                    ? 'bg-white'
                    : overdue
                    ? 'bg-neo-red text-white animate-pulse'
                    : 'bg-neo-blue text-white'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <div>
                    <p className="font-black text-lg">{pass.studentName}</p>
                    <p className="font-bold text-sm">To: Room {pass.destinationRoom}</p>
                  </div>
                  {pass.status === 'pending' ? (
                    <button
                      onClick={() => handleSend(pass.id)}
                      className="neo-button bg-neo-green text-neo-border px-4 py-3 w-full sm:w-auto min-h-[48px]"
                    >
                      Send
                    </button>
                  ) : (
                    <span className="font-black uppercase tracking-widest">
                      {overdue ? 'OVERDUE' : 'In Transit'}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

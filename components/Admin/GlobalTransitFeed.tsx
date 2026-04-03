'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAuth } from '@/components/AuthProvider';
import { handleFirestoreError, OperationType } from '@/lib/firestore-utils';
import { differenceInMinutes } from 'date-fns';

export default function GlobalTransitFeed() {
  const { user } = useAuth();
  const [passes, setPasses] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every 30 seconds to recalculate overdue status
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'passes'),
      where('status', '==', 'in_transit')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const passData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPasses(passData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'passes');
    });

    return () => unsubscribe();
  }, [user]);

  const isOverdue = (departedAt: string) => {
    if (!departedAt) return false;
    const diff = differenceInMinutes(currentTime, new Date(departedAt));
    return diff >= 5;
  };

  const hasOverdue = passes.some(p => isOverdue(p.departedAt));

  return (
    <div className={`neo-box flex flex-col h-[80vh] transition-colors duration-500 ${hasOverdue ? 'bg-neo-red/10' : 'bg-white'}`}>
      <div className={`p-4 border-b-4 border-neo-border flex justify-between items-center ${hasOverdue ? 'bg-neo-red text-white animate-pulse' : 'bg-neo-blue text-white'}`}>
        <h2 className="text-xl font-black uppercase">In Transit Feed</h2>
        <div className="font-bold bg-neo-border text-white px-3 py-1 rounded-full">
          {passes.length} Active
        </div>
      </div>
      
      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        {passes.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="font-bold text-gray-500 text-xl">Halls are clear.</p>
          </div>
        ) : (
          passes.map(pass => {
            const overdue = isOverdue(pass.departedAt);
            return (
              <div 
                key={pass.id} 
                className={`border-4 border-neo-border p-4 flex justify-between items-center ${overdue ? 'bg-neo-red text-white shadow-[6px_6px_0px_0px_rgba(17,17,17,1)] animate-bounce' : 'bg-neo-yellow'}`}
              >
                <div>
                  <p className="font-black text-2xl">{pass.studentName}</p>
                  <p className="font-bold">Destination: Room {pass.destinationRoom}</p>
                  <p className="font-medium text-sm mt-1">
                    Departed: {new Date(pass.departedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </p>
                </div>
                {overdue && (
                  <div className="bg-white text-neo-red font-black px-4 py-2 border-4 border-neo-border rotate-3">
                    OVERDUE
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

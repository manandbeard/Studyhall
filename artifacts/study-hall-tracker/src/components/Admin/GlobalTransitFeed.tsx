import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAuth } from '@/components/AuthProvider';
import { handleFirestoreError, OperationType } from '@/lib/firestore-utils';
import type { Pass } from '@/lib/types';
import { differenceInMinutes } from 'date-fns';

export default function GlobalTransitFeed() {
  const { user } = useAuth();
  const [passes, setPasses] = useState<Pass[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

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
      const passData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pass));
      setPasses(passData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'passes', false);
    });

    return () => unsubscribe();
  }, [user]);

  const isOverdue = (departedAt: string | undefined) => {
    if (!departedAt) return false;
    return differenceInMinutes(currentTime, new Date(departedAt)) >= 5;
  };

  const minutesElapsed = (departedAt: string | undefined) => {
    if (!departedAt) return 0;
    return differenceInMinutes(currentTime, new Date(departedAt));
  };

  const hasOverdue = passes.some(p => isOverdue(p.departedAt));

  const emptyState = (
    <div className="h-full flex items-center justify-center py-16">
      <p className="font-bold text-gray-500 text-xl">Halls are clear.</p>
    </div>
  );

  return (
    <div className={`neo-box flex flex-col h-[80vh] transition-colors duration-500 ${hasOverdue ? 'bg-neo-red/10' : 'bg-white'}`}>
      <div className={`p-4 border-b-4 border-neo-border flex justify-between items-center ${hasOverdue ? 'bg-neo-red text-white animate-pulse' : 'bg-neo-blue text-white'}`}>
        <h2 className="text-xl font-black uppercase">In Transit Feed</h2>
        <div className="font-bold bg-neo-border text-white px-3 py-1 rounded-full">
          {passes.length} Active
        </div>
      </div>

      {passes.length === 0 ? (
        emptyState
      ) : (
        <>
          {/* Mobile: card-per-pass layout (hidden on sm+) */}
          <div className="sm:hidden p-3 flex-1 overflow-y-auto space-y-3">
            {passes.map(pass => {
              const overdue = isOverdue(pass.departedAt);
              const mins = minutesElapsed(pass.departedAt);
              return (
                <div
                  key={pass.id}
                  className={`border-4 border-neo-border p-3 ${overdue ? 'bg-neo-red text-white' : 'bg-neo-yellow'}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <p className="font-black text-lg leading-tight">{pass.studentName}</p>
                    {overdue && (
                      <span className="bg-white text-neo-red font-black text-xs px-2 py-1 border-2 border-neo-border shrink-0">
                        OVERDUE
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-sm mt-1">→ Room {pass.destinationRoom}</p>
                  <p className="font-medium text-xs mt-0.5">
                    Departed {new Date(pass.departedAt ?? '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {mins}m ago
                  </p>
                </div>
              );
            })}
          </div>

          {/* Desktop: table layout (hidden below sm) */}
          <div className="hidden sm:flex flex-1 overflow-y-auto flex-col">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-gray-50 border-b-4 border-neo-border">
                <tr>
                  <th className="text-left font-black uppercase text-xs px-4 py-3 border-r-2 border-neo-border">Student</th>
                  <th className="text-left font-black uppercase text-xs px-4 py-3 border-r-2 border-neo-border">Destination</th>
                  <th className="text-left font-black uppercase text-xs px-4 py-3 border-r-2 border-neo-border">Departed</th>
                  <th className="text-left font-black uppercase text-xs px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {passes.map(pass => {
                  const overdue = isOverdue(pass.departedAt);
                  const mins = minutesElapsed(pass.departedAt);
                  return (
                    <tr
                      key={pass.id}
                      className={`border-b-2 border-neo-border ${overdue ? 'bg-neo-red text-white animate-bounce' : 'bg-neo-yellow'}`}
                    >
                      <td className="px-4 py-3 font-black text-lg border-r-2 border-neo-border">{pass.studentName}</td>
                      <td className="px-4 py-3 font-bold border-r-2 border-neo-border">Room {pass.destinationRoom}</td>
                      <td className="px-4 py-3 font-medium border-r-2 border-neo-border">
                        {new Date(pass.departedAt ?? '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        <span className="text-xs ml-1 opacity-75">({mins}m)</span>
                      </td>
                      <td className="px-4 py-3">
                        {overdue ? (
                          <span className="bg-white text-neo-red font-black px-3 py-1 border-4 border-neo-border rotate-3 inline-block text-sm">
                            OVERDUE
                          </span>
                        ) : (
                          <span className="font-black uppercase tracking-wider text-sm">In Transit</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

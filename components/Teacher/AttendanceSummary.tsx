'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAuth } from '@/components/AuthProvider';
import { handleFirestoreError, OperationType } from '@/lib/firestore-utils';
import { differenceInMinutes } from 'date-fns';
import { Users, Clock, UserX } from 'lucide-react';

export default function AttendanceSummary() {
  const { user } = useAuth();
  const [rosterCount, setRosterCount] = useState(0);
  const [absentCount, setAbsentCount] = useState(0);
  const [outgoingActiveCount, setOutgoingActiveCount] = useState(0);
  const [incomingArrivedCount, setIncomingArrivedCount] = useState(0);
  const [tardyCount, setTardyCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user) return;

    // 1. Count total roster and absent students
    const qStudents = query(collection(db, 'students'), where('thirdPeriodTeacherId', '==', user.uid));
    const unsubscribeStudents = onSnapshot(qStudents, (snapshot) => {
      const studentData = snapshot.docs.map(doc => doc.data());
      setRosterCount(studentData.length);
      setAbsentCount(studentData.filter((s: any) => s.isAbsent).length);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'students');
    });

    // 2. Count outgoing active passes (pending or in_transit)
    const qOutgoing = query(
      collection(db, 'passes'),
      where('originTeacherId', '==', user.uid),
      where('status', 'in', ['pending', 'in_transit'])
    );
    const unsubscribeOutgoing = onSnapshot(qOutgoing, (snapshot) => {
      const outgoingPasses = snapshot.docs.map(doc => doc.data());
      setOutgoingActiveCount(outgoingPasses.length);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'passes');
    });

    // 3. Count incoming arrived and incoming tardy
    const qIncoming = query(
      collection(db, 'passes'),
      where('destinationTeacherId', '==', user.uid),
      where('status', 'in', ['pending', 'in_transit', 'arrived'])
    );
    const unsubscribeIncoming = onSnapshot(qIncoming, (snapshot) => {
      const incomingPasses = snapshot.docs.map(doc => doc.data());
      setIncomingArrivedCount(incomingPasses.filter((p: any) => p.status === 'arrived').length);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'passes');
    });

    // 4. Calculate total tardy (all in_transit > 5 mins where user is origin or destination)
    const qTardy = query(
      collection(db, 'passes'),
      where('status', '==', 'in_transit')
    );
    const unsubscribeTardy = onSnapshot(qTardy, (snapshot) => {
      const allInTransit = snapshot.docs.map(doc => doc.data());
      const now = new Date();
      const myTardy = allInTransit.filter((p: any) => {
        const isMine = p.originTeacherId === user.uid || p.destinationTeacherId === user.uid;
        if (!isMine) return false;
        if (!p.departedAt) return false;
        return differenceInMinutes(now, new Date(p.departedAt)) >= 5;
      });
      setTardyCount(myTardy.length);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'passes');
    });

    return () => {
      unsubscribeStudents();
      unsubscribeOutgoing();
      unsubscribeIncoming();
      unsubscribeTardy();
    };
  }, [user]);

  // Present = (Roster - Absent - OutgoingActive) + IncomingArrived
  const presentCount = (rosterCount - absentCount - outgoingActiveCount) + incomingArrivedCount;

  return (
    <div className="grid grid-cols-3 gap-4 mb-4">
      <div className="neo-box bg-neo-green p-4 flex flex-col items-center justify-center text-neo-border">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-5 h-5" />
          <span className="font-black uppercase text-xs">Present</span>
        </div>
        <span className="text-4xl font-black">{presentCount}</span>
      </div>

      <div className="neo-box bg-neo-red p-4 flex flex-col items-center justify-center text-white">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-5 h-5" />
          <span className="font-black uppercase text-xs">Tardy</span>
        </div>
        <span className="text-4xl font-black">{tardyCount}</span>
      </div>

      <div className="neo-box bg-gray-200 p-4 flex flex-col items-center justify-center text-gray-600">
        <div className="flex items-center gap-2 mb-1">
          <UserX className="w-5 h-5" />
          <span className="font-black uppercase text-xs">Absent</span>
        </div>
        <span className="text-4xl font-black">{absentCount}</span>
      </div>
    </div>
  );
}

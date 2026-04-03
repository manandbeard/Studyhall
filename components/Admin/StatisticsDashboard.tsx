'use client';

import { useState, useEffect } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-utils';
import { differenceInMinutes } from 'date-fns';

export default function StatisticsDashboard() {
  const [passes, setPasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsubscribeTeachers = onSnapshot(query(collection(db, 'users')), (snapshot) => {
      const teacherMap: Record<string, string> = {};
      snapshot.docs.forEach(doc => {
        teacherMap[doc.id] = doc.data().name;
      });
      setTeachers(teacherMap);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const q = query(collection(db, 'passes'));
    const unsubscribePasses = onSnapshot(q, (snapshot) => {
      const passData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPasses(passData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'passes');
    });

    return () => {
      unsubscribeTeachers();
      unsubscribePasses();
    };
  }, []);

  // Calculate stats
  const totalPasses = passes.length;
  const arrivedPasses = passes.filter(p => p.status === 'arrived');
  const inTransitPasses = passes.filter(p => p.status === 'in_transit');
  
  // Calculate average transit time for arrived passes
  let totalTransitMinutes = 0;
  let validTransitCount = 0;
  arrivedPasses.forEach(p => {
    if (p.departedAt && p.arrivedAt) {
      const diff = differenceInMinutes(new Date(p.arrivedAt), new Date(p.departedAt));
      if (diff >= 0) {
        totalTransitMinutes += diff;
        validTransitCount++;
      }
    }
  });
  const avgTransitTime = validTransitCount > 0 ? Math.round(totalTransitMinutes / validTransitCount) : 0;

  // Calculate overdue incidents
  const overdueIncidents = passes.filter(p => {
    if (p.status === 'in_transit' && p.departedAt) {
      return differenceInMinutes(new Date(), new Date(p.departedAt)) >= 5;
    }
    if (p.status === 'arrived' && p.departedAt && p.arrivedAt) {
      return differenceInMinutes(new Date(p.arrivedAt), new Date(p.departedAt)) >= 5;
    }
    return false;
  }).length;

  // Most popular destinations
  const destinationCounts = passes.reduce((acc: any, pass) => {
    const room = pass.destinationRoom || 'Unknown';
    acc[room] = (acc[room] || 0) + 1;
    return acc;
  }, {});
  const popularDestinations = Object.entries(destinationCounts)
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 5);

  // Frequent Flyers
  const studentCounts = passes.reduce((acc: any, pass) => {
    const name = pass.studentName || 'Unknown';
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});
  const frequentFlyers = Object.entries(studentCounts)
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 5);

  // Top Sending Teachers
  const sendingCounts = passes.reduce((acc: any, pass) => {
    const id = pass.originTeacherId;
    if (id) acc[id] = (acc[id] || 0) + 1;
    return acc;
  }, {});
  const topSenders = Object.entries(sendingCounts)
    .map(([id, count]) => [teachers[id] || 'Unknown Teacher', count])
    .sort((a: any, b: any) => (b[1] as number) - (a[1] as number))
    .slice(0, 5);

  // Top Receiving Teachers
  const receivingCounts = passes.reduce((acc: any, pass) => {
    const id = pass.destinationTeacherId;
    if (id) acc[id] = (acc[id] || 0) + 1;
    return acc;
  }, {});
  const topReceivers = Object.entries(receivingCounts)
    .map(([id, count]) => [teachers[id] || 'Unknown Teacher', count])
    .sort((a: any, b: any) => (b[1] as number) - (a[1] as number))
    .slice(0, 5);

  return (
    <div className="neo-box flex flex-col h-[80vh] bg-white">
      <div className="p-4 border-b-4 border-neo-border bg-neo-green text-neo-border">
        <h2 className="text-xl font-black uppercase">System Statistics</h2>
        <p className="font-bold text-sm mt-1">Overview of hall pass activity.</p>
      </div>
      
      <div className="p-4 flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="border-4 border-neo-border p-4 bg-gray-50 text-center">
            <p className="font-bold text-sm uppercase text-gray-500">Total Passes</p>
            <p className="text-4xl font-black">{totalPasses}</p>
          </div>
          <div className="border-4 border-neo-border p-4 bg-neo-blue text-white text-center">
            <p className="font-bold text-sm uppercase">In Transit</p>
            <p className="text-4xl font-black">{inTransitPasses.length}</p>
          </div>
          <div className="border-4 border-neo-border p-4 bg-neo-yellow text-neo-border text-center">
            <p className="font-bold text-sm uppercase">Avg Transit Time</p>
            <p className="text-4xl font-black">{avgTransitTime} <span className="text-lg">min</span></p>
          </div>
          <div className="border-4 border-neo-border p-4 bg-neo-red text-white text-center">
            <p className="font-bold text-sm uppercase">Overdue Incidents</p>
            <p className="text-4xl font-black">{overdueIncidents}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="font-black uppercase text-lg border-b-4 border-neo-border pb-2 mb-4">Frequent Flyers</h3>
            <ul className="space-y-2">
              {frequentFlyers.map(([name, count]: any, index) => (
                <li key={name} className="flex justify-between items-center border-2 border-neo-border p-2 bg-gray-50">
                  <span className="font-bold">#{index + 1} - {name}</span>
                  <span className="bg-neo-border text-white px-2 py-1 font-black text-sm">{count} passes</span>
                </li>
              ))}
              {frequentFlyers.length === 0 && <p className="font-bold text-gray-500">No data yet.</p>}
            </ul>
          </div>

          <div>
            <h3 className="font-black uppercase text-lg border-b-4 border-neo-border pb-2 mb-4">Most Popular Destinations</h3>
            <ul className="space-y-2">
              {popularDestinations.map(([room, count]: any, index) => (
                <li key={room} className="flex justify-between items-center border-2 border-neo-border p-2 bg-gray-50">
                  <span className="font-bold">#{index + 1} - Room {room}</span>
                  <span className="bg-neo-border text-white px-2 py-1 font-black text-sm">{count} passes</span>
                </li>
              ))}
              {popularDestinations.length === 0 && <p className="font-bold text-gray-500">No data yet.</p>}
            </ul>
          </div>

          <div>
            <h3 className="font-black uppercase text-lg border-b-4 border-neo-border pb-2 mb-4">Top Sending Teachers</h3>
            <ul className="space-y-2">
              {topSenders.map(([name, count]: any, index) => (
                <li key={name} className="flex justify-between items-center border-2 border-neo-border p-2 bg-gray-50">
                  <span className="font-bold">#{index + 1} - {name}</span>
                  <span className="bg-neo-border text-white px-2 py-1 font-black text-sm">{count} passes</span>
                </li>
              ))}
              {topSenders.length === 0 && <p className="font-bold text-gray-500">No data yet.</p>}
            </ul>
          </div>

          <div>
            <h3 className="font-black uppercase text-lg border-b-4 border-neo-border pb-2 mb-4">Top Receiving Teachers</h3>
            <ul className="space-y-2">
              {topReceivers.map(([name, count]: any, index) => (
                <li key={name} className="flex justify-between items-center border-2 border-neo-border p-2 bg-gray-50">
                  <span className="font-bold">#{index + 1} - {name}</span>
                  <span className="bg-neo-border text-white px-2 py-1 font-black text-sm">{count} passes</span>
                </li>
              ))}
              {topReceivers.length === 0 && <p className="font-bold text-gray-500">No data yet.</p>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

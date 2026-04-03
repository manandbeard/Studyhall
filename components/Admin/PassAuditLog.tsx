'use client';

import { useState, useEffect } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-utils';
import { differenceInMinutes } from 'date-fns';
import { Search } from 'lucide-react';

export default function PassAuditLog() {
  const [passes, setPasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');

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

    const unsubscribePasses = onSnapshot(query(collection(db, 'passes')), (snapshot) => {
      const passData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      // Sort descending by requestedAt
      passData.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
      setPasses(passData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'passes');
    });

    return () => {
      unsubscribeTeachers();
      unsubscribePasses();
    };
  }, []);

  const filteredPasses = passes.filter(p => {
    const searchLower = searchTerm.toLowerCase();
    const studentMatch = (p.studentName || '').toLowerCase().includes(searchLower);
    const originMatch = (teachers[p.originTeacherId] || '').toLowerCase().includes(searchLower);
    const destMatch = (teachers[p.destinationTeacherId] || '').toLowerCase().includes(searchLower);
    const statusMatch = (p.status || '').toLowerCase().includes(searchLower);
    return studentMatch || originMatch || destMatch || statusMatch;
  });

  return (
    <div className="neo-box flex flex-col h-[80vh] bg-white">
      <div className="p-4 border-b-4 border-neo-border bg-neo-blue text-white flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black uppercase">Pass Audit Log</h2>
          <p className="font-bold text-sm mt-1">Historical record of all hall passes.</p>
        </div>
        <div className="relative w-64 text-neo-border">
          <input 
            type="text" 
            placeholder="Search logs..." 
            className="neo-input w-full pl-10 py-2"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="w-5 h-5 absolute left-3 top-3 text-gray-500" />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-gray-100 border-b-4 border-neo-border">
            <tr>
              <th className="p-3 font-black uppercase">Date/Time</th>
              <th className="p-3 font-black uppercase">Student</th>
              <th className="p-3 font-black uppercase">Origin</th>
              <th className="p-3 font-black uppercase">Destination</th>
              <th className="p-3 font-black uppercase">Status</th>
              <th className="p-3 font-black uppercase">Transit Time</th>
            </tr>
          </thead>
          <tbody>
            {filteredPasses.map(pass => {
              let transitTime = '-';
              if (pass.departedAt && pass.arrivedAt) {
                transitTime = `${differenceInMinutes(new Date(pass.arrivedAt), new Date(pass.departedAt))} min`;
              } else if (pass.departedAt) {
                transitTime = `${differenceInMinutes(new Date(), new Date(pass.departedAt))} min (ongoing)`;
              }

              return (
                <tr key={pass.id} className="border-b-2 border-neo-border/20 hover:bg-gray-50">
                  <td className="p-3 text-sm font-bold">
                    {new Date(pass.requestedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="p-3 font-black">{pass.studentName}</td>
                  <td className="p-3 font-bold">{teachers[pass.originTeacherId] || 'Unknown'}</td>
                  <td className="p-3 font-bold">{teachers[pass.destinationTeacherId] || 'Unknown'} (Rm {pass.destinationRoom})</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 font-black text-xs uppercase border-2 border-neo-border ${
                      pass.status === 'arrived' ? 'bg-neo-green' : 
                      pass.status === 'in_transit' ? 'bg-neo-yellow' : 'bg-white'
                    }`}>
                      {pass.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-3 font-bold text-sm">{transitTime}</td>
                </tr>
              );
            })}
            {filteredPasses.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center font-bold text-gray-500">
                  No passes found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

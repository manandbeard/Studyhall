import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-utils';
import { differenceInMinutes } from 'date-fns';
import { ChevronDown, ChevronRight, BarChart2 } from 'lucide-react';
import { computeTeacherAnalytics, filterLast30Days, type TeacherAnalyticsResult } from '@/lib/analytics';

interface TeacherRecord {
  id: string;
  name: string;
  roomNumber?: string;
}

function MiniStat({ label, value, unit }: { label: string; value: number | string; unit?: string }) {
  return (
    <div className="border-2 border-neo-border p-2 text-center bg-gray-50 min-w-[80px]">
      <p className="font-bold text-xs uppercase text-gray-500 leading-tight">{label}</p>
      <p className="text-xl font-black leading-snug">
        {value}
        {unit && <span className="text-xs font-bold ml-0.5">{unit}</span>}
      </p>
    </div>
  );
}

function TopList({ items, label }: { items: { name: string; count: number }[]; label: string }) {
  if (items.length === 0) return <p className="text-xs font-bold text-gray-400 italic">{label}: none</p>;
  return (
    <div>
      <p className="font-black uppercase text-xs text-gray-500 mb-1">{label}</p>
      <ol className="space-y-1">
        {items.slice(0, 3).map((s, i) => (
          <li key={s.name} className="flex justify-between text-xs font-bold border border-neo-border px-2 py-1 bg-white">
            <span><span className="text-gray-400 mr-1">#{i + 1}</span>{s.name}</span>
            <span className="font-black">{s.count}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function TeacherRow({
  teacher,
  passes,
}: {
  teacher: TeacherRecord;
  passes: Record<string, unknown>[];
}) {
  const [expanded, setExpanded] = useState(false);

  const { incoming, outgoing, analytics } = useMemo(() => {
    const recent = filterLast30Days(passes);
    const inc = recent.filter((p) => p['destinationTeacherId'] === teacher.id);
    const out = recent.filter((p) => p['originTeacherId'] === teacher.id);
    return {
      incoming: inc,
      outgoing: out,
      analytics: computeTeacherAnalytics(inc, out) as TeacherAnalyticsResult,
    };
  }, [passes, teacher.id]);

  const totalRecent = incoming.length + outgoing.length;

  return (
    <div className="border-4 border-neo-border overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between p-3 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {expanded ? (
            <ChevronDown className="w-4 h-4 shrink-0 text-neo-blue" />
          ) : (
            <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" />
          )}
          <div className="min-w-0">
            <p className="font-black truncate">{teacher.name}</p>
            {teacher.roomNumber && (
              <p className="text-xs font-bold text-gray-500">Room {teacher.roomNumber}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <span className="text-xs font-black bg-neo-blue text-white px-2 py-0.5 border-2 border-neo-border">
            {incoming.length} in
          </span>
          <span className="text-xs font-black bg-neo-green text-neo-border px-2 py-0.5 border-2 border-neo-border">
            {outgoing.length} out
          </span>
          {totalRecent === 0 && (
            <span className="text-xs font-bold text-gray-400 italic">no activity (30d)</span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t-4 border-neo-border p-4 bg-gray-50 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h5 className="font-black uppercase text-xs text-neo-blue border-b-2 border-neo-blue mb-3 pb-1">
              Incoming (as destination) — 30 days
            </h5>
            {incoming.length === 0 ? (
              <p className="text-xs font-bold text-gray-400 italic">No incoming passes.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  <MiniStat label="Total" value={analytics.incomingCount} />
                  <MiniStat label="Avg Transit" value={analytics.avgTransitMin} unit="min" />
                </div>
                <TopList items={analytics.topRequestedStudents} label="Top requested students" />
              </div>
            )}
          </div>
          <div>
            <h5 className="font-black uppercase text-xs text-neo-green border-b-2 border-neo-green mb-3 pb-1">
              Outgoing (as origin) — 30 days
            </h5>
            {outgoing.length === 0 ? (
              <p className="text-xs font-bold text-gray-400 italic">No outgoing passes.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  <MiniStat label="Total" value={analytics.outgoingCount} />
                  <MiniStat label="Avg Away" value={analytics.avgAwayMin} unit="min" />
                  {analytics.overdueCount > 0 && (
                    <MiniStat label="Overdue" value={analytics.overdueCount} />
                  )}
                </div>
                <TopList items={analytics.topSentStudents} label="Top sent students" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function StatisticsDashboard() {
  const [passes, setPasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [teacherNames, setTeacherNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsubscribeTeachers = onSnapshot(
      query(collection(db, 'users')),
      (snapshot) => {
        const nameMap: Record<string, string> = {};
        const list: TeacherRecord[] = [];
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          nameMap[doc.id] = data.name;
          if (data.role === 'teacher' || data.role === 'admin') {
            list.push({ id: doc.id, name: data.name, roomNumber: data.roomNumber });
          }
        });
        list.sort((a, b) => a.name.localeCompare(b.name));
        setTeachers(list);
        setTeacherNames(nameMap);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'users');
      },
    );

    const unsubscribePasses = onSnapshot(
      query(collection(db, 'passes')),
      (snapshot) => {
        const passData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setPasses(passData);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'passes');
      },
    );

    return () => {
      unsubscribeTeachers();
      unsubscribePasses();
    };
  }, []);

  const totalPasses = passes.length;
  const arrivedPasses = passes.filter((p) => p.status === 'arrived');
  const inTransitPasses = passes.filter((p) => p.status === 'in_transit');

  let totalTransitMinutes = 0;
  let validTransitCount = 0;
  arrivedPasses.forEach((p) => {
    if (p.departedAt && p.arrivedAt) {
      const diff = differenceInMinutes(new Date(p.arrivedAt), new Date(p.departedAt));
      if (diff >= 0) {
        totalTransitMinutes += diff;
        validTransitCount++;
      }
    }
  });
  const avgTransitTime =
    validTransitCount > 0 ? Math.round(totalTransitMinutes / validTransitCount) : 0;

  const overdueIncidents = passes.filter((p) => {
    if (p.status === 'in_transit' && p.departedAt) {
      return differenceInMinutes(new Date(), new Date(p.departedAt)) >= 5;
    }
    if (p.status === 'arrived' && p.departedAt && p.arrivedAt) {
      return differenceInMinutes(new Date(p.arrivedAt), new Date(p.departedAt)) >= 5;
    }
    return false;
  }).length;

  const destinationCounts = passes.reduce((acc: any, pass) => {
    const room = pass.destinationRoom || 'Unknown';
    acc[room] = (acc[room] || 0) + 1;
    return acc;
  }, {});
  const popularDestinations = Object.entries(destinationCounts)
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 5);

  const studentCounts = passes.reduce((acc: any, pass) => {
    const name = pass.studentName || 'Unknown';
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});
  const frequentFlyers = Object.entries(studentCounts)
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 5);

  const sendingCounts = passes.reduce((acc: any, pass) => {
    const id = pass.originTeacherId;
    if (id) acc[id] = (acc[id] || 0) + 1;
    return acc;
  }, {});
  const topSenders = Object.entries(sendingCounts)
    .map(([id, count]) => [teacherNames[id] || 'Unknown Teacher', count])
    .sort((a: any, b: any) => (b[1] as number) - (a[1] as number))
    .slice(0, 5);

  const receivingCounts = passes.reduce((acc: any, pass) => {
    const id = pass.destinationTeacherId;
    if (id) acc[id] = (acc[id] || 0) + 1;
    return acc;
  }, {});
  const topReceivers = Object.entries(receivingCounts)
    .map(([id, count]) => [teacherNames[id] || 'Unknown Teacher', count])
    .sort((a: any, b: any) => (b[1] as number) - (a[1] as number))
    .slice(0, 5);

  const completedPasses = passes
    .filter((p) => p.status === 'completed')
    .map((p) => p as Record<string, unknown>);

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
            <p className="text-4xl font-black">
              {avgTransitTime} <span className="text-lg">min</span>
            </p>
          </div>
          <div className="border-4 border-neo-border p-4 bg-neo-red text-white text-center">
            <p className="font-bold text-sm uppercase">Overdue Incidents</p>
            <p className="text-4xl font-black">{overdueIncidents}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div>
            <h3 className="font-black uppercase text-lg border-b-4 border-neo-border pb-2 mb-4">
              Frequent Flyers
            </h3>
            <ul className="space-y-2">
              {frequentFlyers.map(([name, count]: any, index) => (
                <li
                  key={name}
                  className="flex justify-between items-center border-2 border-neo-border p-2 bg-gray-50"
                >
                  <span className="font-bold">
                    #{index + 1} - {name}
                  </span>
                  <span className="bg-neo-border text-white px-2 py-1 font-black text-sm">
                    {count} passes
                  </span>
                </li>
              ))}
              {frequentFlyers.length === 0 && (
                <p className="font-bold text-gray-500">No data yet.</p>
              )}
            </ul>
          </div>

          <div>
            <h3 className="font-black uppercase text-lg border-b-4 border-neo-border pb-2 mb-4">
              Most Popular Destinations
            </h3>
            <ul className="space-y-2">
              {popularDestinations.map(([room, count]: any, index) => (
                <li
                  key={room}
                  className="flex justify-between items-center border-2 border-neo-border p-2 bg-gray-50"
                >
                  <span className="font-bold">
                    #{index + 1} - Room {room}
                  </span>
                  <span className="bg-neo-border text-white px-2 py-1 font-black text-sm">
                    {count} passes
                  </span>
                </li>
              ))}
              {popularDestinations.length === 0 && (
                <p className="font-bold text-gray-500">No data yet.</p>
              )}
            </ul>
          </div>

          <div>
            <h3 className="font-black uppercase text-lg border-b-4 border-neo-border pb-2 mb-4">
              Top Sending Teachers
            </h3>
            <ul className="space-y-2">
              {topSenders.map(([name, count]: any, index) => (
                <li
                  key={name}
                  className="flex justify-between items-center border-2 border-neo-border p-2 bg-gray-50"
                >
                  <span className="font-bold">
                    #{index + 1} - {name}
                  </span>
                  <span className="bg-neo-border text-white px-2 py-1 font-black text-sm">
                    {count} passes
                  </span>
                </li>
              ))}
              {topSenders.length === 0 && (
                <p className="font-bold text-gray-500">No data yet.</p>
              )}
            </ul>
          </div>

          <div>
            <h3 className="font-black uppercase text-lg border-b-4 border-neo-border pb-2 mb-4">
              Top Receiving Teachers
            </h3>
            <ul className="space-y-2">
              {topReceivers.map(([name, count]: any, index) => (
                <li
                  key={name}
                  className="flex justify-between items-center border-2 border-neo-border p-2 bg-gray-50"
                >
                  <span className="font-bold">
                    #{index + 1} - {name}
                  </span>
                  <span className="bg-neo-border text-white px-2 py-1 font-black text-sm">
                    {count} passes
                  </span>
                </li>
              ))}
              {topReceivers.length === 0 && (
                <p className="font-bold text-gray-500">No data yet.</p>
              )}
            </ul>
          </div>
        </div>

        <div>
          <h3 className="font-black uppercase text-lg border-b-4 border-neo-border pb-2 mb-4 flex items-center gap-2">
            <BarChart2 className="w-5 h-5" />
            Per-Teacher Breakdown
            <span className="ml-2 text-xs font-bold text-gray-400 normal-case border border-gray-300 px-2 py-0.5">
              30-day completed passes · click to expand
            </span>
          </h3>
          {teachers.length === 0 ? (
            <p className="font-bold text-gray-500">No teachers found.</p>
          ) : (
            <div className="space-y-2">
              {teachers.map((teacher) => (
                <TeacherRow
                  key={teacher.id}
                  teacher={teacher}
                  passes={completedPasses}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

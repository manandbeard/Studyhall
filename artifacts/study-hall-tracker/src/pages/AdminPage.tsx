import { useAuth } from '@/components/AuthProvider';
import { useLocation, Link } from 'wouter';
import { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/firebase';
import GlobalTransitFeed from '@/components/Admin/GlobalTransitFeed';
import TeacherManagement from '@/components/Admin/TeacherManagement';
import StatisticsDashboard from '@/components/Admin/StatisticsDashboard';
import PassAuditLog from '@/components/Admin/PassAuditLog';
import SchoolWideImport from '@/components/Admin/SchoolWideImport';
import { Archive, AlertTriangle } from 'lucide-react';
import { FIRESTORE_BATCH_LIMIT } from '@/lib/constants';

const BATCH_SIZE = FIRESTORE_BATCH_LIMIT;

export default function AdminDashboard() {
  const { user, loading, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<'feed' | 'teachers' | 'stats' | 'audit' | 'import'>('feed');
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveResult, setArchiveResult] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) {
      setLocation('/');
    }
  }, [user, loading, setLocation]);

  if (loading || !user) return null;

  const handleArchiveDay = async () => {
    if (!archiveConfirm) {
      setArchiveConfirm(true);
      return;
    }

    setArchiving(true);
    setArchiveConfirm(false);
    setArchiveResult(null);

    try {
      const activePassStatuses = ['pending', 'in_transit', 'arrived'];
      const [passesSnap, studentsSnap] = await Promise.all([
        getDocs(query(collection(db, 'passes'), where('status', 'in', activePassStatuses))),
        getDocs(query(collection(db, 'students'), where('isAbsent', '==', true))),
      ]);
      const totalPasses = passesSnap.size;
      const now = new Date().toISOString();

      const teacherPassCounts: Record<string, number> = {};
      for (const passDoc of passesSnap.docs) {
        const data = passDoc.data();
        if (data.originTeacherId) {
          teacherPassCounts[data.originTeacherId] = (teacherPassCounts[data.originTeacherId] ?? 0) + 1;
        }
        if (data.destinationTeacherId && data.destinationTeacherId !== data.originTeacherId) {
          teacherPassCounts[data.destinationTeacherId] = (teacherPassCounts[data.destinationTeacherId] ?? 0) + 1;
        }
      }

      const [locksSnap, countersSnap] = await Promise.all([
        getDocs(collection(db, 'activeStudentPasses')),
        getDocs(collection(db, 'teacherActiveCount')),
      ]);

      let batch = writeBatch(db);
      let writeCount = 0;

      const flushBatch = async () => {
        if (writeCount > 0) { await batch.commit(); batch = writeBatch(db); writeCount = 0; }
      };
      const batchWrite = async (fn: (b: ReturnType<typeof writeBatch>) => void) => {
        fn(batch);
        writeCount++;
        if (writeCount >= BATCH_SIZE) await flushBatch();
      };

      for (const passDoc of passesSnap.docs) {
        await batchWrite(b => b.update(passDoc.ref, { status: 'completed', completedAt: now, archivedBy: 'daily_reset' }));
      }
      for (const lockDoc of locksSnap.docs) {
        await batchWrite(b => b.delete(lockDoc.ref));
      }
      for (const counterDoc of countersSnap.docs) {
        await batchWrite(b => b.set(counterDoc.ref, { count: 0 }));
      }
      for (const studentDoc of studentsSnap.docs) {
        await batchWrite(b => b.update(studentDoc.ref, { isAbsent: false }));
      }
      await flushBatch();

      await addDoc(collection(db, 'dailyArchives'), {
        date: new Date().toISOString().split('T')[0],
        archivedAt: now,
        totalPassesArchived: totalPasses,
        totalAbsentsCleared: studentsSnap.size,
        teacherPassCounts,
        archivedBy: user.uid,
      });

      setArchiveResult(
        `Day archived: ${totalPasses} pass${totalPasses !== 1 ? 'es' : ''} completed, ${studentsSnap.size} absent flag${studentsSnap.size !== 1 ? 's' : ''} cleared.`,
      );
      setTimeout(() => setArchiveResult(null), 8000);
    } catch (error) {
      console.error('Archive failed:', error);
      setArchiveResult('Archive failed. Please try again.');
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-neo-bg">
      <header className="border-b-4 border-neo-border bg-neo-border text-white p-4 flex justify-between items-center gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black uppercase">Admin Dashboard</h1>
          <p className="font-bold text-sm">Global Transit Monitor</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {archiveResult && (
            <span className="bg-neo-green text-neo-border border-2 border-neo-border px-3 py-1 font-black text-xs uppercase">
              {archiveResult}
            </span>
          )}

          {archiveConfirm ? (
            <div className="flex items-center gap-2 bg-neo-yellow border-2 border-neo-border px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-neo-border" />
              <span className="font-black text-neo-border text-xs uppercase">Archive entire day?</span>
              <button
                onClick={handleArchiveDay}
                disabled={archiving}
                className="neo-button bg-neo-red text-white px-3 py-1 text-xs font-black uppercase"
              >
                Yes, Archive
              </button>
              <button
                onClick={() => setArchiveConfirm(false)}
                className="neo-button bg-white text-neo-border px-3 py-1 text-xs font-black uppercase"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={handleArchiveDay}
              disabled={archiving}
              className="neo-button bg-neo-yellow text-neo-border px-4 py-2 text-sm flex items-center gap-2 font-black uppercase disabled:opacity-60"
            >
              <Archive className="w-4 h-4" />
              {archiving ? 'Archiving...' : 'Archive Day & Reset'}
            </button>
          )}

          <Link href="/teacher" className="neo-button bg-neo-blue text-white px-4 py-2 text-sm flex items-center">
            Teacher View
          </Link>
          <button onClick={signOut} className="neo-button bg-neo-red text-white px-4 py-2 text-sm">
            Sign Out
          </button>
        </div>
      </header>

      <div className="bg-white border-b-4 border-neo-border flex overflow-x-auto">
        {(['feed', 'teachers', 'stats', 'audit', 'import'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-black uppercase border-r-4 border-neo-border transition-colors whitespace-nowrap ${activeTab === tab ? 'bg-neo-yellow' : 'hover:bg-gray-100'}`}
          >
            {tab === 'feed' ? 'Live Feed' :
             tab === 'teachers' ? 'Teacher Roster' :
             tab === 'stats' ? 'Statistics' :
             tab === 'audit' ? 'Audit Log' : 'Bulk Import'}
          </button>
        ))}
      </div>

      <main className="flex-1 p-4 max-w-5xl mx-auto w-full">
        {activeTab === 'feed' && <GlobalTransitFeed />}
        {activeTab === 'teachers' && <TeacherManagement />}
        {activeTab === 'stats' && <StatisticsDashboard />}
        {activeTab === 'audit' && <PassAuditLog />}
        {activeTab === 'import' && <SchoolWideImport />}
      </main>
    </div>
  );
}

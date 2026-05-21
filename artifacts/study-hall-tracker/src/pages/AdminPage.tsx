import { useAuth } from '@/components/AuthProvider';
import { useLocation, Link } from 'wouter';
import { useEffect, useState } from 'react';
import { auth } from '@/firebase';
import GlobalTransitFeed from '@/components/Admin/GlobalTransitFeed';
import TeacherManagement from '@/components/Admin/TeacherManagement';
import StatisticsDashboard from '@/components/Admin/StatisticsDashboard';
import PassAuditLog from '@/components/Admin/PassAuditLog';
import SchoolWideImport from '@/components/Admin/SchoolWideImport';
import { Archive, AlertTriangle } from 'lucide-react';

const toObjectOrEmpty = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};

const toCountOrZero = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

export default function AdminDashboard() {
  const { user, loading, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<'feed' | 'teachers' | 'stats' | 'audit' | 'import'>('feed');
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveResult, setArchiveResult] = useState<string | null>(null);
  const [archiveResultTone, setArchiveResultTone] = useState<'success' | 'error'>('success');

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) {
      setLocation('/');
    }
  }, [user, loading, setLocation]);

  if (loading || !user) return null;
  const archiveResultClasses =
    archiveResultTone === 'success'
      ? 'bg-neo-green text-neo-border'
      : 'bg-neo-red text-white';

  const handleArchiveDay = async () => {
    if (!archiveConfirm) {
      setArchiveConfirm(true);
      return;
    }

    setArchiving(true);
    setArchiveConfirm(false);
    setArchiveResult(null);
    setArchiveResultTone('success');

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error('Authentication expired. Please sign out and sign back in.');
      }

      const response = await fetch('/api/admin/archive-day', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      const body = toObjectOrEmpty(await response.json().catch(() => ({})));
      if (!response.ok) {
        const fallback =
          response.status === 401
            ? 'Session expired. Please sign in again.'
            : response.status === 403
              ? 'Admin permission required for archive/reset.'
              : response.status === 404
                ? 'Archive endpoint not found (404). The API server may not be running or reachable.'
                : `Archive failed (HTTP ${response.status}). Please try again.`;
        throw new Error(typeof body.error === 'string' ? body.error : fallback);
      }

      const totalPasses = toCountOrZero(body.totalPassesArchived);
      const totalAbsents = toCountOrZero(body.totalAbsentsCleared);

      setArchiveResultTone('success');
      setArchiveResult(
        `Day archived: ${totalPasses} pass${totalPasses !== 1 ? 'es' : ''} completed, ${totalAbsents} absent flag${totalAbsents !== 1 ? 's' : ''} cleared.`,
      );
      setTimeout(() => setArchiveResult(null), 8000);
    } catch (error) {
      console.error('Archive failed:', error);
      const message = error instanceof Error ? error.message : 'Archive failed. Please try again.';
      setArchiveResultTone('error');
      setArchiveResult(message);
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
            <span className={`${archiveResultClasses} border-2 border-neo-border px-3 py-1 font-black text-xs uppercase`}>
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

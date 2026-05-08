import { useAuth } from '@/components/AuthProvider';
import { useLocation, Link } from 'wouter';
import { useEffect, useState } from 'react';
import OutgoingPane from '@/components/Teacher/OutgoingPane';
import IncomingPane from '@/components/Teacher/IncomingPane';
import RosterImport from '@/components/Teacher/RosterImport';
import TeacherSettings from '@/components/Teacher/TeacherSettings';
import AttendanceSummary from '@/components/Teacher/AttendanceSummary';
import RosterList from '@/components/Teacher/RosterList';
import TeacherAnalyticsPanel from '@/components/Teacher/TeacherAnalyticsPanel';
import { Settings, LayoutDashboard, BarChart2, LogOut, ShieldCheck } from 'lucide-react';

type Tab = 'dashboard' | 'analytics' | 'settings';

export default function TeacherDashboard() {
  const { user, loading, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  useEffect(() => {
    if (!loading && (!user || (user.role !== 'teacher' && user.role !== 'admin'))) {
      setLocation('/');
    }
  }, [user, loading, setLocation]);

  if (loading || !user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-neo-bg">
      <header className="border-b-4 border-neo-border bg-white px-3 py-2 sm:px-4 sm:py-3 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="min-w-0">
            <h1 className="text-base sm:text-2xl font-black uppercase leading-tight">Teacher Dashboard</h1>
            <p className="font-bold text-xs truncate text-gray-600">Room {user.roomNumber} · {user.name}</p>
          </div>
          {user.isAway && (
            <span className="bg-neo-red text-white px-2 py-0.5 font-black text-xs uppercase border-2 border-neo-border animate-pulse shrink-0">
              Away
            </span>
          )}
        </div>
        <button onClick={signOut} className="neo-button bg-neo-red text-white px-3 py-2 flex items-center gap-1.5 text-sm shrink-0 min-h-[44px]">
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline font-black uppercase">Sign Out</span>
        </button>
      </header>

      <nav className="bg-white border-b-4 border-neo-border overflow-x-auto sticky top-[57px] sm:top-[69px] z-10 snap-x snap-mandatory scrollbar-none">
        <div className="flex min-w-max">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`snap-start px-4 sm:px-6 py-3 font-black text-sm uppercase flex items-center gap-2 border-r-4 border-neo-border min-h-[48px] transition-colors ${activeTab === 'dashboard' ? 'bg-neo-yellow' : 'bg-white hover:bg-gray-50'}`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`snap-start px-4 sm:px-6 py-3 font-black text-sm uppercase flex items-center gap-2 border-r-4 border-neo-border min-h-[48px] transition-colors ${activeTab === 'analytics' ? 'bg-neo-yellow' : 'bg-white hover:bg-gray-50'}`}
          >
            <BarChart2 className="w-4 h-4 shrink-0" />
            Analytics
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`snap-start px-4 sm:px-6 py-3 font-black text-sm uppercase flex items-center gap-2 border-r-4 border-neo-border min-h-[48px] transition-colors ${activeTab === 'settings' ? 'bg-neo-yellow' : 'bg-white hover:bg-gray-50'}`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            Settings
          </button>
          {user.role === 'admin' && (
            <Link
              href="/admin"
              className="snap-start px-4 sm:px-6 py-3 font-black text-sm uppercase flex items-center gap-2 bg-neo-blue text-white min-h-[48px]"
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              Admin
            </Link>
          )}
        </div>
      </nav>

      <main className="flex-1 p-3 sm:p-4 flex flex-col gap-4 max-w-7xl mx-auto w-full">
        {activeTab === 'dashboard' && (
          <>
            <AttendanceSummary />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="flex flex-col gap-4">
                <OutgoingPane />
                <IncomingPane />
              </div>
              <div className="flex flex-col gap-4">
                <RosterList />
                <RosterImport />
              </div>
            </div>
          </>
        )}
        {activeTab === 'analytics' && <TeacherAnalyticsPanel />}
        {activeTab === 'settings' && <TeacherSettings />}
      </main>
    </div>
  );
}

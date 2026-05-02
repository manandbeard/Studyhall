import { useAuth } from '@/components/AuthProvider';
import { useLocation, Link } from 'wouter';
import { useEffect, useState } from 'react';
import OutgoingPane from '@/components/Teacher/OutgoingPane';
import IncomingPane from '@/components/Teacher/IncomingPane';
import RosterImport from '@/components/Teacher/RosterImport';
import TeacherSettings from '@/components/Teacher/TeacherSettings';
import AttendanceSummary from '@/components/Teacher/AttendanceSummary';
import RosterList from '@/components/Teacher/RosterList';
import { Settings, LayoutDashboard, LogOut } from 'lucide-react';

export default function TeacherDashboard() {
  const { user, loading, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings'>('dashboard');

  useEffect(() => {
    if (!loading && (!user || (user.role !== 'teacher' && user.role !== 'admin'))) {
      setLocation('/');
    }
  }, [user, loading, setLocation]);

  if (loading || !user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-neo-bg">
      <header className="border-b-4 border-neo-border bg-white p-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-black uppercase">Teacher Dashboard</h1>
            <p className="font-bold text-sm">Room: {user.roomNumber} | {user.name}</p>
          </div>
          {user.isAway && (
            <span className="bg-neo-red text-white px-3 py-1 font-black text-xs uppercase border-2 border-neo-border animate-pulse">
              Away
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab(activeTab === 'dashboard' ? 'settings' : 'dashboard')}
            className={`neo-button px-4 py-2 text-sm flex items-center gap-2 ${activeTab === 'settings' ? 'bg-neo-yellow' : 'bg-gray-100'}`}
          >
            {activeTab === 'dashboard' ? (
              <><Settings className="w-4 h-4" /> Settings</>
            ) : (
              <><LayoutDashboard className="w-4 h-4" /> Dashboard</>
            )}
          </button>
          {user.role === 'admin' && (
            <Link href="/admin" className="neo-button bg-neo-blue text-white px-4 py-2 text-sm flex items-center">
              Admin View
            </Link>
          )}
          <button onClick={signOut} className="neo-button bg-neo-red text-white px-4 py-2 text-sm flex items-center gap-2">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 flex flex-col gap-4 max-w-7xl mx-auto w-full">
        {activeTab === 'dashboard' ? (
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
        ) : (
          <TeacherSettings />
        )}
      </main>
    </div>
  );
}

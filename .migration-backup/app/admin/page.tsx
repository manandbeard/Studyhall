'use client';

import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import GlobalTransitFeed from '@/components/Admin/GlobalTransitFeed';
import TeacherManagement from '@/components/Admin/TeacherManagement';
import StatisticsDashboard from '@/components/Admin/StatisticsDashboard';
import PassAuditLog from '@/components/Admin/PassAuditLog';
import SchoolWideImport from '@/components/Admin/SchoolWideImport';

export default function AdminDashboard() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'feed' | 'teachers' | 'stats' | 'audit' | 'import'>('feed');

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading || !user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-neo-bg">
      <header className="border-b-4 border-neo-border bg-neo-border text-white p-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black uppercase">Admin Dashboard</h1>
          <p className="font-bold text-sm">Global Transit Monitor</p>
        </div>
        <div className="flex gap-2">
          <Link href="/teacher" className="neo-button bg-neo-blue text-white px-4 py-2 text-sm flex items-center">
            Teacher View
          </Link>
          <button onClick={signOut} className="neo-button bg-neo-red text-white px-4 py-2 text-sm">
            Sign Out
          </button>
        </div>
      </header>
      
      <div className="bg-white border-b-4 border-neo-border flex overflow-x-auto">
        <button 
          onClick={() => setActiveTab('feed')}
          className={`px-6 py-3 font-black uppercase border-r-4 border-neo-border transition-colors ${activeTab === 'feed' ? 'bg-neo-yellow' : 'hover:bg-gray-100'}`}
        >
          Live Feed
        </button>
        <button 
          onClick={() => setActiveTab('teachers')}
          className={`px-6 py-3 font-black uppercase border-r-4 border-neo-border transition-colors ${activeTab === 'teachers' ? 'bg-neo-yellow' : 'hover:bg-gray-100'}`}
        >
          Teacher Roster
        </button>
        <button 
          onClick={() => setActiveTab('stats')}
          className={`px-6 py-3 font-black uppercase border-r-4 border-neo-border transition-colors ${activeTab === 'stats' ? 'bg-neo-yellow' : 'hover:bg-gray-100'}`}
        >
          Statistics
        </button>
        <button 
          onClick={() => setActiveTab('audit')}
          className={`px-6 py-3 font-black uppercase border-r-4 border-neo-border transition-colors ${activeTab === 'audit' ? 'bg-neo-yellow' : 'hover:bg-gray-100'}`}
        >
          Audit Log
        </button>
        <button 
          onClick={() => setActiveTab('import')}
          className={`px-6 py-3 font-black uppercase border-r-4 border-neo-border transition-colors ${activeTab === 'import' ? 'bg-neo-yellow' : 'hover:bg-gray-100'}`}
        >
          Bulk Import
        </button>
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

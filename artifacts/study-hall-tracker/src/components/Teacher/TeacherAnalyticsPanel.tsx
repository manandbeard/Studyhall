import { useAuth } from '@/components/AuthProvider';
import { useTeacherAnalytics } from '@/hooks/useTeacherAnalytics';
import { RefreshCw, TrendingUp, Clock, Users, AlertCircle, BarChart2 } from 'lucide-react';
import type { TopStudent } from '@/lib/analytics';

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const BAR_H = 80;
const BAR_W = 30;
const BAR_GAP = 8;

function DowBarChart({ counts }: { counts: number[] }) {
  const max = Math.max(...counts, 1);
  const totalW = DOW_LABELS.length * (BAR_W + BAR_GAP) - BAR_GAP;

  return (
    <svg
      width={totalW}
      height={BAR_H + 28}
      aria-label="Requests by day of week"
      role="img"
      className="overflow-visible"
    >
      {DOW_LABELS.map((day, i) => {
        const h = counts[i] > 0 ? Math.max(4, Math.round((counts[i] / max) * BAR_H)) : 0;
        const x = i * (BAR_W + BAR_GAP);
        const y = BAR_H - h;
        const isWeekend = i === 0 || i === 6;
        return (
          <g key={day}>
            <rect
              x={x}
              y={0}
              width={BAR_W}
              height={BAR_H}
              fill={isWeekend ? '#f0f0ec' : '#F4F4F0'}
              stroke="#111111"
              strokeWidth="2"
            />
            {h > 0 && (
              <rect
                x={x}
                y={y}
                width={BAR_W}
                height={h}
                fill={isWeekend ? '#aaaaaa' : '#FFD500'}
                stroke="#111111"
                strokeWidth="2"
              />
            )}
            {counts[i] > 0 && (
              <text
                x={x + BAR_W / 2}
                y={y - 5}
                textAnchor="middle"
                fontSize="9"
                fontWeight="900"
                fill="#111111"
              >
                {counts[i]}
              </text>
            )}
            <text
              x={x + BAR_W / 2}
              y={BAR_H + 18}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill={isWeekend ? '#888888' : '#111111'}
            >
              {day}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function StatCard({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: number | string;
  unit?: string;
  color: string;
}) {
  return (
    <div className={`border-4 border-neo-border p-4 text-center ${color}`}>
      <p className="font-bold text-xs uppercase opacity-80 mb-1">{label}</p>
      <p className="text-3xl font-black leading-none">
        {value}
        {unit && <span className="text-base font-bold ml-1">{unit}</span>}
      </p>
    </div>
  );
}

function TopStudentList({ students, label }: { students: TopStudent[]; label: string }) {
  return (
    <div>
      <h4 className="font-black uppercase text-sm border-b-2 border-neo-border pb-1 mb-3 flex items-center gap-2">
        <Users className="w-4 h-4" />
        {label}
      </h4>
      {students.length === 0 ? (
        <p className="text-sm font-bold text-gray-400">No data yet.</p>
      ) : (
        <ol className="space-y-2">
          {students.map((s, i) => (
            <li
              key={s.name}
              className="flex items-center justify-between border-2 border-neo-border p-2 bg-gray-50"
            >
              <span className="font-bold text-sm">
                <span className="font-black text-gray-400 mr-2">#{i + 1}</span>
                {s.name}
              </span>
              <span className="bg-neo-border text-white px-2 py-0.5 font-black text-xs">
                {s.count}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function TeacherAnalyticsPanel() {
  const { user } = useAuth();
  const analytics = useTeacherAnalytics(user?.uid, 30);

  return (
    <div className="neo-box bg-white overflow-hidden">
      <div className="bg-neo-blue text-white p-4 border-b-4 border-neo-border flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black uppercase flex items-center gap-2">
            <BarChart2 className="w-6 h-6" />
            My Analytics
          </h2>
          <p className="font-bold text-sm opacity-80 mt-0.5">Rolling 30-day window — completed passes only</p>
        </div>
        <button
          onClick={analytics.refresh}
          disabled={analytics.loading}
          className="neo-button bg-white text-neo-border px-4 py-2 text-sm flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${analytics.loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {analytics.loading ? (
        <div className="p-12 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-neo-blue" />
          <p className="font-black uppercase text-gray-400">Loading analytics...</p>
        </div>
      ) : (
        <div className="p-6 space-y-10">
          <section>
            <h3 className="font-black uppercase text-lg border-b-4 border-neo-border pb-2 mb-5 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-neo-blue" />
              Incoming — As Study Hall / Destination
            </h3>

            {analytics.incomingCount === 0 ? (
              <div className="flex items-center gap-3 p-4 border-4 border-dashed border-gray-300 text-gray-400 font-bold">
                <AlertCircle className="w-5 h-5 shrink-0" />
                No completed incoming passes in the last 30 days.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <StatCard
                    label="Total Requests"
                    value={analytics.incomingCount}
                    color="bg-neo-blue text-white"
                  />
                  <StatCard
                    label="Avg Transit Time"
                    value={analytics.avgTransitMin}
                    unit="min"
                    color="bg-neo-yellow text-neo-border"
                  />
                  <StatCard
                    label="Unique Students"
                    value={analytics.topRequestedStudents.length}
                    color="bg-gray-100 text-neo-border"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <TopStudentList
                    students={analytics.topRequestedStudents}
                    label="Top Requested Students"
                  />

                  <div>
                    <h4 className="font-black uppercase text-sm border-b-2 border-neo-border pb-1 mb-3 flex items-center gap-2">
                      <BarChart2 className="w-4 h-4" />
                      Requests by Day of Week
                    </h4>
                    <DowBarChart counts={analytics.requestsByDow} />
                  </div>
                </div>
              </div>
            )}
          </section>

          <section>
            <h3 className="font-black uppercase text-lg border-b-4 border-neo-border pb-2 mb-5 flex items-center gap-2">
              <Clock className="w-5 h-5 text-neo-green" />
              Outgoing — As 3rd-Period Teacher
            </h3>

            {analytics.outgoingCount === 0 ? (
              <div className="flex items-center gap-3 p-4 border-4 border-dashed border-gray-300 text-gray-400 font-bold">
                <AlertCircle className="w-5 h-5 shrink-0" />
                No completed outgoing passes in the last 30 days.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <StatCard
                    label="Total Sent"
                    value={analytics.outgoingCount}
                    color="bg-neo-green text-neo-border"
                  />
                  <StatCard
                    label="Avg Away Time"
                    value={analytics.avgAwayMin}
                    unit="min"
                    color="bg-neo-yellow text-neo-border"
                  />
                  <StatCard
                    label="Overdue Trips"
                    value={analytics.overdueCount}
                    color={analytics.overdueCount > 0 ? 'bg-neo-red text-white' : 'bg-gray-100 text-neo-border'}
                  />
                </div>

                <TopStudentList
                  students={analytics.topSentStudents}
                  label="Top Sent Students"
                />
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

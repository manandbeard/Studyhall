import { differenceInMinutes } from 'date-fns';

export interface TopStudent {
  name: string;
  count: number;
}

export interface TeacherAnalyticsResult {
  incomingCount: number;
  avgTransitMin: number;
  topRequestedStudents: TopStudent[];
  requestsByDow: number[];
  outgoingCount: number;
  avgAwayMin: number;
  topSentStudents: TopStudent[];
  overdueCount: number;
}

export const EMPTY_ANALYTICS: TeacherAnalyticsResult = {
  incomingCount: 0,
  avgTransitMin: 0,
  topRequestedStudents: [],
  requestsByDow: [0, 0, 0, 0, 0, 0, 0],
  outgoingCount: 0,
  avgAwayMin: 0,
  topSentStudents: [],
  overdueCount: 0,
};

function topStudents(passes: Record<string, unknown>[], top = 5): TopStudent[] {
  const counts: Record<string, number> = {};
  for (const p of passes) {
    const name = p['studentName'] as string | undefined;
    if (name) counts[name] = (counts[name] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([name, count]) => ({ name, count }));
}

function avgMinutes(
  passes: Record<string, unknown>[],
  startField: string,
  endField: string,
): number {
  let total = 0;
  let count = 0;
  for (const p of passes) {
    const start = p[startField] as string | undefined;
    const end = p[endField] as string | undefined;
    if (start && end) {
      const diff = differenceInMinutes(new Date(end), new Date(start));
      if (diff >= 0) {
        total += diff;
        count++;
      }
    }
  }
  return count > 0 ? Math.round(total / count) : 0;
}

export function computeTeacherAnalytics(
  incomingPasses: Record<string, unknown>[],
  outgoingPasses: Record<string, unknown>[],
): TeacherAnalyticsResult {
  const avgTransitMin = avgMinutes(incomingPasses, 'departedAt', 'arrivedAt');

  const requestsByDow: number[] = [0, 0, 0, 0, 0, 0, 0];
  for (const p of incomingPasses) {
    const at = p['requestedAt'] as string | undefined;
    if (at) requestsByDow[new Date(at).getDay()]++;
  }

  const overdueCount = outgoingPasses.filter((p) => {
    const start = p['departedAt'] as string | undefined;
    const end = (p['arrivedAt'] ?? p['completedAt']) as string | undefined;
    if (!start || !end) return false;
    return differenceInMinutes(new Date(end), new Date(start)) >= 5;
  }).length;

  const avgAwayMin = avgMinutes(outgoingPasses, 'departedAt', 'completedAt');

  return {
    incomingCount: incomingPasses.length,
    avgTransitMin,
    topRequestedStudents: topStudents(incomingPasses),
    requestsByDow,
    outgoingCount: outgoingPasses.length,
    avgAwayMin,
    topSentStudents: topStudents(outgoingPasses),
    overdueCount,
  };
}

export function filterLast30Days(passes: Record<string, unknown>[]): Record<string, unknown>[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffISO = cutoff.toISOString();
  return passes.filter((p) => {
    const at = (p['completedAt'] ?? p['requestedAt']) as string | undefined;
    return at && at >= cutoffISO;
  });
}

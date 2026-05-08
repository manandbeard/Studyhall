import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/firebase';
import {
  computeTeacherAnalytics,
  EMPTY_ANALYTICS,
  filterLast30Days,
  type TeacherAnalyticsResult,
} from '@/lib/analytics';

interface UseTeacherAnalyticsReturn extends TeacherAnalyticsResult {
  loading: boolean;
  refresh: () => void;
}

export function useTeacherAnalytics(
  uid: string | undefined,
  days = 30,
): UseTeacherAnalyticsReturn {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<TeacherAnalyticsResult>(EMPTY_ANALYTICS);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetch = async () => {
      setLoading(true);
      try {
        const [destSnap, origSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, 'passes'),
              where('destinationTeacherId', '==', uid),
              where('status', '==', 'completed'),
            ),
          ),
          getDocs(
            query(
              collection(db, 'passes'),
              where('originTeacherId', '==', uid),
              where('status', '==', 'completed'),
            ),
          ),
        ]);

        if (cancelled) return;

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffISO = cutoff.toISOString();

        const incoming = destSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Record<string, unknown>)
          .filter((p) => {
            const at = (p['completedAt'] ?? p['requestedAt']) as string | undefined;
            return at && at >= cutoffISO;
          });

        const outgoing = origSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Record<string, unknown>)
          .filter((p) => {
            const at = (p['completedAt'] ?? p['requestedAt']) as string | undefined;
            return at && at >= cutoffISO;
          });

        setResult(computeTeacherAnalytics(incoming, outgoing));
      } catch (err) {
        console.error('useTeacherAnalytics fetch failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetch();
    return () => {
      cancelled = true;
    };
  }, [uid, days, tick]);

  return { ...result, loading, refresh: () => setTick((t) => t + 1) };
}

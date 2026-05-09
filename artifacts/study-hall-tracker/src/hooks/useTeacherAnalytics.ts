import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/firebase';
import {
  computeTeacherAnalytics,
  EMPTY_ANALYTICS,
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

    const loadAnalytics = async () => {
      setLoading(true);
      try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffISO = cutoff.toISOString();

        const [destSnap, origSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, 'passes'),
              where('destinationTeacherId', '==', uid),
              where('completedAt', '>=', cutoffISO),
            ),
          ),
          getDocs(
            query(
              collection(db, 'passes'),
              where('originTeacherId', '==', uid),
              where('completedAt', '>=', cutoffISO),
            ),
          ),
        ]);

        if (cancelled) return;

        const incoming = destSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Record<string, unknown>,
        );
        const outgoing = origSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Record<string, unknown>,
        );

        setResult(computeTeacherAnalytics(incoming, outgoing));
      } catch (err) {
        console.error('useTeacherAnalytics fetch failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadAnalytics();
    return () => {
      cancelled = true;
    };
  }, [uid, days, tick]);

  return { ...result, loading, refresh: () => setTick((t) => t + 1) };
}

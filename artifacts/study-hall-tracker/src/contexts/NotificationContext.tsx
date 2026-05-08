import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/firebase';
import { useAuth } from '@/components/AuthProvider';
import { differenceInMinutes } from 'date-fns';
import { useAudioPing, PingType } from '@/hooks/useAudioPing';
import { AlertCircle, Clock, X, Bell } from 'lucide-react';

export type ToastType = 'info' | 'overdue';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface NotificationContextType {
  toasts: Toast[];
  addToast: (message: string, type: ToastType) => void;
  dismissToast: (id: string) => void;
  playPing: (type: PingType) => void;
  soundMuted: boolean;
}

const NotificationContext = createContext<NotificationContextType>({
  toasts: [],
  addToast: () => {},
  dismissToast: () => {},
  playPing: () => {},
  soundMuted: false,
});

export const useNotifications = () => useContext(NotificationContext);

function ToastStack() {
  const { toasts, dismissToast } = useNotifications();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-xs w-full pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto border-4 border-neo-border shadow-[4px_4px_0_#1a1a1a] p-3 flex items-start gap-3 animate-slide-in ${
            toast.type === 'overdue'
              ? 'bg-neo-red text-white'
              : 'bg-neo-yellow text-neo-border'
          }`}
          role="alert"
        >
          <div className="shrink-0 mt-0.5">
            {toast.type === 'overdue' ? (
              <Clock className="w-5 h-5" />
            ) : (
              <Bell className="w-5 h-5" />
            )}
          </div>
          <p className="font-black text-sm uppercase flex-1 leading-snug">
            {toast.message}
          </p>
          <button
            onClick={() => dismissToast(toast.id)}
            className="shrink-0 hover:opacity-70 transition-opacity"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [soundMuted, setSoundMuted] = useState(false);
  const playPing = useAudioPing(soundMuted);

  const overdueTriggered = useRef<Set<string>>(new Set());
  const inTransitPassesRef = useRef<{ id: string; studentName: string; departedAt?: string; originTeacherId: string; destinationTeacherId: string }[]>([]);
  const pendingInitialized = useRef(false);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => {
      const next = [...prev, { id, message, type }];
      return next.slice(-3);
    });
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        setSoundMuted(snap.data()?.soundMuted ?? false);
      }
    });
    return unsub;
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return;
    pendingInitialized.current = false;

    const q = query(
      collection(db, 'passes'),
      where('destinationTeacherId', '==', user.uid),
      where('status', '==', 'pending'),
    );

    const unsub = onSnapshot(q, (snapshot) => {
      if (!pendingInitialized.current) {
        pendingInitialized.current = true;
        return;
      }
      for (const change of snapshot.docChanges()) {
        if (change.type === 'added') {
          const pass = change.doc.data();
          addToast(`New request: ${pass.studentName}`, 'info');
          playPing('request');
        }
      }
    });

    return unsub;
  }, [user?.uid, addToast, playPing]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'passes'), where('status', '==', 'in_transit'));
    const unsub = onSnapshot(q, (snapshot) => {
      inTransitPassesRef.current = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter(
          (p) =>
            p.originTeacherId === user.uid || p.destinationTeacherId === user.uid,
        );
    });
    return unsub;
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      const now = new Date();
      for (const pass of inTransitPassesRef.current) {
        if (!pass.departedAt) continue;
        const mins = differenceInMinutes(now, new Date(pass.departedAt));
        if (mins >= 5 && !overdueTriggered.current.has(pass.id)) {
          overdueTriggered.current.add(pass.id);
          addToast(`${pass.studentName} overdue (${mins} min in transit)`, 'overdue');
          playPing('overdue');
        }
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [user?.uid, addToast, playPing]);

  return (
    <NotificationContext.Provider
      value={{ toasts, addToast, dismissToast, playPing, soundMuted }}
    >
      {children}
      <ToastStack />
    </NotificationContext.Provider>
  );
}

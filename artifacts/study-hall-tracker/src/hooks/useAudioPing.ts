import { useRef, useCallback } from 'react';

export type PingType = 'request' | 'arrived' | 'overdue';

function playTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  gain = 0.25,
  type: OscillatorType = 'sine',
) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.type = type;
  osc.frequency.value = freq;
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

export function useAudioPing(soundMuted: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (!ctxRef.current) {
      try {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctxRef.current = new AC();
      } catch {
        return null;
      }
    }
    return ctxRef.current;
  }, []);

  const playPing = useCallback(
    (type: PingType) => {
      if (soundMuted) return;
      if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const ctx = getCtx();
      if (!ctx) return;

      const doPlay = () => {
        const now = ctx.currentTime;
        switch (type) {
          case 'request':
            playTone(ctx, 880, now, 0.12, 0.22);
            playTone(ctx, 1108, now + 0.13, 0.18, 0.18);
            break;
          case 'arrived':
            playTone(ctx, 523, now, 0.25, 0.22);
            playTone(ctx, 659, now + 0.08, 0.2, 0.16);
            break;
          case 'overdue':
            playTone(ctx, 330, now, 0.09, 0.28, 'square');
            playTone(ctx, 330, now + 0.14, 0.09, 0.28, 'square');
            playTone(ctx, 330, now + 0.28, 0.09, 0.28, 'square');
            break;
        }
      };

      if (ctx.state === 'suspended') {
        ctx.resume().then(doPlay).catch(() => {});
      } else {
        doPlay();
      }
    },
    [soundMuted, getCtx],
  );

  return playPing;
}

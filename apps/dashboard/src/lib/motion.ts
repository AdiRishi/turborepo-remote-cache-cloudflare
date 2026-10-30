import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

const subscribeToReducedMotion = (onChange: () => void) => {
  const query = matchMedia(REDUCED_MOTION);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
};

const usePrefersReducedMotion = () =>
  useSyncExternalStore(
    subscribeToReducedMotion,
    () => matchMedia(REDUCED_MOTION).matches,
    () => true,
  );

const TWEEN_MS = 900;

/**
 * Eases from the value shown last to `target` whenever it changes, and counts up from zero on mount, so
 * a new range visibly moves the numbers rather than swapping them.
 */
export function useTweened(target: number) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(reduced ? target : 0);
  const shownRef = useRef(shown);
  useEffect(() => {
    const from = shownRef.current;
    if (reduced || from === target) {
      shownRef.current = target;
      setShown(target);
      return undefined;
    }
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / TWEEN_MS);
      shownRef.current = from + (target - from) * (1 - (1 - progress) ** 4);
      setShown(shownRef.current);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [target, reduced]);
  return shown;
}

import { useEffect, useRef, useState } from 'react';

/** True once the element behind `ref` has been on screen, so an animation can wait for someone to watch. */
export const useSeen = <T extends Element>() => {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);
  return { ref, seen };
};

/**
 * Plays a timeline from 0 to `end` milliseconds once `playing` turns true, and starts over at the end. With
 * reduced motion, it jumps straight to the end and stays there.
 */
export const usePlayback = (end: number, { playing = true }: { playing?: boolean } = {}) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!playing) {
      return undefined;
    }
    if (globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setElapsed(end);
      return undefined;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      setElapsed((now - start) % end);
      frame = requestAnimationFrame(tick);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [end, playing]);

  return { elapsed };
};

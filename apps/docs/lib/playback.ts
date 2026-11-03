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
 * Plays a timeline from 0 to `end` milliseconds once `playing` turns true. It stops at the end and plays
 * again on `replay`, or starts over by itself with `loop`. With reduced motion, it jumps straight to the end.
 */
export const usePlayback = (
  end: number,
  { playing = true, loop = false }: { playing?: boolean; loop?: boolean } = {},
) => {
  const [elapsed, setElapsed] = useState(0);
  const [round, setRound] = useState(0);

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
      const next = loop ? (now - start) % end : Math.min(now - start, end);
      setElapsed(next);
      if (loop || next < end) {
        frame = requestAnimationFrame(tick);
      }
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [end, playing, loop, round]);

  const replay = () => {
    setRound((count) => count + 1);
  };

  return { elapsed, done: elapsed >= end, replay };
};


import { useRef, useCallback } from 'react';

export const useLongPress = (callback: () => void, speed: number = 100) => {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(() => {
    callback(); // Initial click
    delayRef.current = setTimeout(() => {
      timerRef.current = setInterval(() => {
        callback();
      }, speed);
    }, 500); // 500ms delay before continuous firing
  }, [callback, speed]);

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (delayRef.current) clearTimeout(delayRef.current);
    timerRef.current = null;
    delayRef.current = null;
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart: start,
    onTouchEnd: stop,
  };
};

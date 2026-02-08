
import { useRef, useCallback } from 'react';

export const useLongPress = (callback: () => void, speed: number = 100) => {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTouchRef = useRef(false);

  const start = useCallback(() => {
    callback();
    delayRef.current = setTimeout(() => {
      timerRef.current = setInterval(() => {
        callback();
      }, speed);
    }, 500);
  }, [callback, speed]);

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (delayRef.current) clearTimeout(delayRef.current);
    timerRef.current = null;
    delayRef.current = null;
  }, []);

  const onTouchStart = useCallback(() => {
    isTouchRef.current = true;
    start();
  }, [start]);

  const onMouseDown = useCallback(() => {
    // 触摸设备会先触发 touchstart 再合成 mousedown，跳过后者
    if (isTouchRef.current) {
      isTouchRef.current = false;
      return;
    }
    start();
  }, [start]);

  return {
    onMouseDown,
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart,
    onTouchEnd: stop,
  };
};

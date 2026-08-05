"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AutoRefreshState = {
  /** Increments on every refresh (manual or automatic). Use as a memo dep. */
  nonce: number;
  lastUpdated: Date;
  isAuto: boolean;
  intervalMs: number;
  /** Seconds until the next automatic refresh (0 when auto is off). */
  secondsToNext: number;
  setAuto: (on: boolean) => void;
  setIntervalMs: (ms: number) => void;
  refreshNow: () => void;
};

/**
 * Drives periodic "data refresh" for mock/live views. Purely client-side —
 * it bumps a nonce consumers can key derived data on, tracks the last
 * update time, and exposes a countdown to the next tick.
 */
export function useAutoRefresh(defaultIntervalMs = 15000, defaultAuto = false): AutoRefreshState {
  const [nonce, setNonce] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());
  const [isAuto, setIsAuto] = useState(defaultAuto);
  const [intervalMs, setIntervalMs] = useState(defaultIntervalMs);
  const [secondsToNext, setSecondsToNext] = useState(0);
  const deadlineRef = useRef<number>(0);

  const refreshNow = useCallback(() => {
    setNonce((n) => n + 1);
    setLastUpdated(new Date());
    deadlineRef.current = Date.now() + intervalMs;
    setSecondsToNext(Math.round(intervalMs / 1000));
  }, [intervalMs]);

  useEffect(() => {
    if (!isAuto) {
      setSecondsToNext(0);
      return;
    }
    deadlineRef.current = Date.now() + intervalMs;
    setSecondsToNext(Math.round(intervalMs / 1000));

    const tick = window.setInterval(() => {
      const remaining = deadlineRef.current - Date.now();
      if (remaining <= 0) {
        setNonce((n) => n + 1);
        setLastUpdated(new Date());
        deadlineRef.current = Date.now() + intervalMs;
        setSecondsToNext(Math.round(intervalMs / 1000));
      } else {
        setSecondsToNext(Math.ceil(remaining / 1000));
      }
    }, 1000);

    return () => window.clearInterval(tick);
  }, [isAuto, intervalMs]);

  return {
    nonce,
    lastUpdated,
    isAuto,
    intervalMs,
    secondsToNext,
    setAuto: setIsAuto,
    setIntervalMs,
    refreshNow,
  };
}

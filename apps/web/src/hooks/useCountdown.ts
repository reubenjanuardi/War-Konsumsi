'use client';

import { useState, useEffect, useRef } from 'react';

interface UseCountdownOptions {
  targetDate: string | null | undefined;
  serverTime?: string | null | undefined;
  onFinish?: () => void;
}

export interface CountdownResult {
  hours: string;
  minutes: string;
  seconds: string;
  totalSeconds: number;
  isFinished: boolean;
  formatted: string;
}

export function useCountdown({
  targetDate,
  serverTime,
  onFinish,
}: UseCountdownOptions): CountdownResult {
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const finishedTriggeredRef = useRef(false);

  // Compute offset between client clock and server clock
  const [clockOffset, setClockOffset] = useState(0);

  useEffect(() => {
    if (serverTime) {
      const serverMs = new Date(serverTime).getTime();
      const localMs = Date.now();
      setClockOffset(serverMs - localMs);
    }
  }, [serverTime]);

  const [timeLeft, setTimeLeft] = useState<{
    hours: string;
    minutes: string;
    seconds: string;
    totalSeconds: number;
    isFinished: boolean;
    formatted: string;
  }>(() => calculateTimeLeft(targetDate, clockOffset));

  useEffect(() => {
    if (!targetDate) {
      setTimeLeft({
        hours: '00',
        minutes: '00',
        seconds: '00',
        totalSeconds: 0,
        isFinished: true,
        formatted: '00:00:00',
      });
      return;
    }

    finishedTriggeredRef.current = false;

    const interval = setInterval(() => {
      const result = calculateTimeLeft(targetDate, clockOffset);
      setTimeLeft(result);

      if (result.isFinished && !finishedTriggeredRef.current) {
        finishedTriggeredRef.current = true;
        clearInterval(interval);
        if (onFinishRef.current) {
          onFinishRef.current();
        }
      }
    }, 1000);

    // Initial check
    const initial = calculateTimeLeft(targetDate, clockOffset);
    setTimeLeft(initial);
    if (initial.isFinished && !finishedTriggeredRef.current) {
      finishedTriggeredRef.current = true;
      clearInterval(interval);
      if (onFinishRef.current) {
        onFinishRef.current();
      }
    }

    return () => clearInterval(interval);
  }, [targetDate, clockOffset]);

  return timeLeft;
}

function calculateTimeLeft(targetDate: string | null | undefined, offset: number) {
  if (!targetDate) {
    return {
      hours: '00',
      minutes: '00',
      seconds: '00',
      totalSeconds: 0,
      isFinished: true,
      formatted: '00:00:00',
    };
  }

  const targetMs = new Date(targetDate).getTime();
  const currentMs = Date.now() + offset;
  const diffMs = targetMs - currentMs;

  if (diffMs <= 0) {
    return {
      hours: '00',
      minutes: '00',
      seconds: '00',
      totalSeconds: 0,
      isFinished: true,
      formatted: '00:00:00',
    };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const h = hours.toString().padStart(2, '0');
  const m = minutes.toString().padStart(2, '0');
  const s = seconds.toString().padStart(2, '0');

  return {
    hours: h,
    minutes: m,
    seconds: s,
    totalSeconds,
    isFinished: false,
    formatted: `${h}:${m}:${s}`,
  };
}

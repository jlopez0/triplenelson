"use client";

import { useEffect, useState } from "react";
import { differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds } from "date-fns";

interface CountdownProps {
  targetDate: string;
}

export function Countdown({ targetDate }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);
  const [isHere, setIsHere] = useState(false);

  useEffect(() => {
    const target = new Date(targetDate);
    const updateCountdown = () => {
      const now = new Date();

      if (now >= target) {
        setIsHere(true);
        setTimeLeft(null);
        return true;
      }

      setIsHere(false);
      setTimeLeft({
        d: differenceInDays(target, now),
        h: differenceInHours(target, now) % 24,
        m: differenceInMinutes(target, now) % 60,
        s: differenceInSeconds(target, now) % 60,
      });

      return false;
    };

    if (updateCountdown()) {
      return;
    }

    const timer = window.setInterval(() => {
      if (updateCountdown()) {
        window.clearInterval(timer);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [targetDate]);

  if (!timeLeft && !isHere) {
    return <div className="h-32 bg-white/5 animate-pulse" />;
  }

  if (isHere) {
    return (
      <div className="text-center py-20">
        <h2 className="font-display text-hero text-acid">
          TONIGHT
        </h2>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-6 w-full max-w-lg">
      <TimeUnit value={timeLeft!.d} label="DAYS" />
      <TimeUnit value={timeLeft!.h} label="HRS" />
      <TimeUnit value={timeLeft!.m} label="MIN" />
      <TimeUnit value={timeLeft!.s} label="SEC" />
    </div>
  );
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="border border-white/10 p-6 text-center space-y-3">
      <div className="font-display text-6xl md:text-7xl lg:text-8xl leading-none tabular-nums">
        {value.toString().padStart(2, '0')}
      </div>
      <div className="text-gray text-xs tracking-[0.2em] uppercase">
        {label}
      </div>
    </div>
  );
}

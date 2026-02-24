'use client';

import { useEffect, useState } from 'react';
import { getTimeLeft, type TimeLeft } from '@/lib/countdown';

interface HomeCountdownProps {
  initialTimeLeft: TimeLeft;
  targetTimestamp: number;
}

export function HomeCountdown({ initialTimeLeft, targetTimestamp }: HomeCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(initialTimeLeft);

  useEffect(() => {
    const updateCountdown = () => setTimeLeft(getTimeLeft(targetTimestamp));
    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1000);

    return () => window.clearInterval(interval);
  }, [targetTimestamp]);

  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4">
      <div className="rounded-2xl border border-zinc-800/60 bg-black/30 backdrop-blur-sm p-4 md:p-5 text-center group hover:border-zinc-700 transition-all">
        <div className="text-4xl md:text-5xl lg:text-6xl font-display font-bold group-hover:scale-110 transition-transform duration-300">
          {String(timeLeft.days).padStart(2, '0')}
        </div>
        <div className="text-[10px] md:text-xs uppercase tracking-widest text-zinc-600 mt-2">Dias</div>
      </div>

      <div className="rounded-2xl border border-zinc-800/60 bg-black/30 backdrop-blur-sm p-4 md:p-5 text-center group hover:border-zinc-700 transition-all">
        <div className="text-4xl md:text-5xl lg:text-6xl font-display font-bold group-hover:scale-110 transition-transform duration-300">
          {String(timeLeft.hours).padStart(2, '0')}
        </div>
        <div className="text-[10px] md:text-xs uppercase tracking-widest text-zinc-600 mt-2">Horas</div>
      </div>

      <div className="rounded-2xl border border-zinc-800/60 bg-black/30 backdrop-blur-sm p-4 md:p-5 text-center group hover:border-zinc-700 transition-all">
        <div className="text-4xl md:text-5xl lg:text-6xl font-display font-bold group-hover:scale-110 transition-transform duration-300">
          {String(timeLeft.minutes).padStart(2, '0')}
        </div>
        <div className="text-[10px] md:text-xs uppercase tracking-widest text-zinc-600 mt-2">Min</div>
      </div>

      <div className="rounded-2xl border border-zinc-800/60 bg-black/30 backdrop-blur-sm p-4 md:p-5 text-center group hover:border-zinc-700 transition-all">
        <div className="text-4xl md:text-5xl lg:text-6xl font-display font-bold group-hover:scale-110 transition-transform duration-300">
          {String(timeLeft.seconds).padStart(2, '0')}
        </div>
        <div className="text-[10px] md:text-xs uppercase tracking-widest text-zinc-600 mt-2">Seg</div>
      </div>
    </div>
  );
}

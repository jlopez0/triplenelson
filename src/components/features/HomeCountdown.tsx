'use client';

import { useEffect, useState } from 'react';
import { getTimeLeft, type TimeLeft } from '@/lib/countdown';

interface HomeCountdownProps {
  initialTimeLeft: TimeLeft;
  targetTimestamp: number;
}

const isZero = (t: TimeLeft) => t.days === 0 && t.hours === 0 && t.minutes === 0 && t.seconds === 0;

function NeonLive() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-2 text-center select-none">

      {/* Label superior */}
      <p className="text-[9px] md:text-[11px] uppercase tracking-[0.45em] text-cyan-400 font-bold"
        style={{ textShadow: "0 0 10px #0ff, 0 0 20px #0ff" }}>
        · Esta noche ·
      </p>

      {/* Texto principal con glitch y neón */}
      <div className="relative leading-[0.85]">
        {/* Layer glitch 1 — cyan */}
        <div aria-hidden className="absolute inset-0 text-center animate-glitch1 pointer-events-none"
          style={{ color: "#0ff", textShadow: "0 0 8px #0ff", filter: "blur(0.5px)" }}>
          <p className="font-display font-bold text-[56px] md:text-[72px] lg:text-[88px] tracking-tighter leading-[0.85]">YA ESTÁN</p>
          <p className="font-display font-bold text-[56px] md:text-[72px] lg:text-[88px] tracking-tighter leading-[0.85]">AQUÍ</p>
        </div>
        {/* Layer glitch 2 — magenta */}
        <div aria-hidden className="absolute inset-0 text-center animate-glitch2 pointer-events-none"
          style={{ color: "#f0f", textShadow: "0 0 8px #f0f", filter: "blur(0.5px)" }}>
          <p className="font-display font-bold text-[56px] md:text-[72px] lg:text-[88px] tracking-tighter leading-[0.85]">YA ESTÁN</p>
          <p className="font-display font-bold text-[56px] md:text-[72px] lg:text-[88px] tracking-tighter leading-[0.85]">AQUÍ</p>
        </div>
        {/* Texto real */}
        <p className="relative font-display font-bold text-[56px] md:text-[72px] lg:text-[88px] tracking-tighter leading-[0.85] text-white animate-neon-pulse"
          style={{ textShadow: "0 0 7px #fff, 0 0 20px #fff, 0 0 40px #0ff, 0 0 80px #0ff" }}>
          YA ESTÁN
        </p>
        <p className="relative font-display font-bold text-[56px] md:text-[72px] lg:text-[88px] tracking-tighter leading-[0.85] text-fuchsia-200 animate-neon-flicker"
          style={{ textShadow: "0 0 7px #fff, 0 0 20px #f0f, 0 0 60px #f0f, 0 0 100px #f0f" }}>
          AQUÍ
        </p>
      </div>

      {/* Badge "en vivo" */}
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
        </span>
        <span className="text-[10px] md:text-xs uppercase tracking-[0.35em] text-emerald-300 font-bold"
          style={{ textShadow: "0 0 8px #4ade80" }}>
          Triple Nelson · 20 Jun 2026
        </span>
      </div>
    </div>
  );
}

export function HomeCountdown({ initialTimeLeft, targetTimestamp }: HomeCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(initialTimeLeft);

  useEffect(() => {
    const update = () => setTimeLeft(getTimeLeft(targetTimestamp));
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [targetTimestamp]);

  if (isZero(timeLeft)) {
    return <NeonLive />;
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4">
      {[
        { value: timeLeft.days, label: 'Dias' },
        { value: timeLeft.hours, label: 'Horas' },
        { value: timeLeft.minutes, label: 'Min' },
        { value: timeLeft.seconds, label: 'Seg' },
      ].map(({ value, label }) => (
        <div key={label} className="rounded-2xl border border-zinc-800/60 bg-black/30 backdrop-blur-sm p-4 md:p-5 text-center group hover:border-zinc-700 transition-all">
          <div className="text-4xl md:text-5xl lg:text-6xl font-display font-bold group-hover:scale-110 transition-transform duration-300">
            {String(value).padStart(2, '0')}
          </div>
          <div className="text-[10px] md:text-xs uppercase tracking-widest text-zinc-600 mt-2">{label}</div>
        </div>
      ))}
    </div>
  );
}

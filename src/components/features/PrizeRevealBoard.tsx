"use client";

import { useEffect, useMemo, useState } from "react";

type PrizeMilestone = {
  id: string;
  label: string;
  revealAt: string;
  prize: string;
};

type Countdown = {
  hours: number;
  minutes: number;
  seconds: number;
};

function getCountdown(targetMs: number, nowMs: number): Countdown {
  const diff = Math.max(0, targetMs - nowMs);
  const totalSeconds = Math.floor(diff / 1000);

  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function formatDate(value: string): string {
  return new Date(value).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

export function PrizeRevealBoard({ milestones }: { milestones: PrizeMilestone[] }) {
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    setNowMs(Date.now());
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const sortedMilestones = useMemo(
    () => [...milestones].sort((a, b) => new Date(a.revealAt).getTime() - new Date(b.revealAt).getTime()),
    [milestones],
  );

  const hasMounted = nowMs !== null;
  const nextLocked = hasMounted
    ? sortedMilestones.find((item) => new Date(item.revealAt).getTime() > (nowMs ?? 0))
    : null;
  const countdown =
    hasMounted && nextLocked ? getCountdown(new Date(nextLocked.revealAt).getTime(), nowMs ?? 0) : null;

  return (
    <section className="rounded-2xl border border-zinc-800/80 bg-black/30 p-4 md:p-5 space-y-4">
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Premios</p>
        <h3 className="font-display text-xl md:text-2xl">Desbloqueos de la noche</h3>
      </div>

      {!hasMounted ? (
        <div className="rounded-xl border border-zinc-700/70 bg-black/40 p-3 md:p-4 space-y-3">
          <p className="text-xs text-zinc-400">Cargando siguiente desbloqueo...</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-zinc-800 bg-black/30 py-2 text-center">
              <div className="font-display text-2xl">--</div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">H</div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-black/30 py-2 text-center">
              <div className="font-display text-2xl">--</div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">Min</div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-black/30 py-2 text-center">
              <div className="font-display text-2xl">--</div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">Seg</div>
            </div>
          </div>
        </div>
      ) : nextLocked && countdown ? (
        <div className="rounded-xl border border-zinc-700/70 bg-black/40 p-3 md:p-4 space-y-3">
          <p className="text-xs text-zinc-400">
            Siguiente: <span className="text-white">{nextLocked.label}</span>
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-zinc-800 bg-black/30 py-2 text-center">
              <div className="font-display text-2xl">{String(countdown.hours).padStart(2, "0")}</div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">H</div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-black/30 py-2 text-center">
              <div className="font-display text-2xl">{String(countdown.minutes).padStart(2, "0")}</div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">Min</div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-black/30 py-2 text-center">
              <div className="font-display text-2xl">{String(countdown.seconds).padStart(2, "0")}</div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">Seg</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-200">
          Todos los premios estan desvelados.
        </div>
      )}

      <div className="space-y-2">
        {sortedMilestones.map((item) => {
          const unlocked = hasMounted && new Date(item.revealAt).getTime() <= (nowMs ?? 0);
          return (
            <div key={item.id} className="rounded-xl border border-zinc-800/80 bg-black/20 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-zinc-200">{item.label}</span>
                <span className="text-[10px] uppercase tracking-widest text-zinc-500">{formatDate(item.revealAt)}</span>
              </div>
              <p className={`mt-1 text-sm ${unlocked ? "text-emerald-300" : "text-zinc-500"}`}>
                {unlocked ? item.prize : "Premio oculto"}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

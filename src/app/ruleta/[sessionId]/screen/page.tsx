"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { AnimatePresence, motion } from "framer-motion";
import {
  getLeaderboard,
  listenPlayers,
  listenSession,
} from "@/lib/roulette/rtdb";
import {
  checkAllBetsIn,
  countActivePlayers,
  countBetsPlaced,
  getNumberColor,
} from "@/lib/roulette/logic";
import { RouletteWheel } from "@/components/roulette/RouletteWheel";
import type { RoulettePlayer, RouletteSession } from "@/lib/roulette/types";

const TOKEN_KEY = "tn_roulette_admin_token";
const ROUND_RESULT_DELAY_MS = 4000;
const RIEN_DURATION_MS = 2000;

// ─── API helpers ───────────────────────────────────────────────────────────

function getStoredToken(): string {
  try { return window.localStorage.getItem(TOKEN_KEY) ?? ""; } catch { return ""; }
}

async function callSpin(sessionId: string): Promise<void> {
  const token = getStoredToken();
  if (!token) {
    console.warn("[ruleta/screen] Sin token admin. Inicia sesión en /ruleta/admin primero.");
    return;
  }
  await fetch("/api/roulette/spin", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": token },
    body: JSON.stringify({ sessionId, phase: "spin" }),
  }).catch((e) => console.error("[ruleta/screen] spin error", e));
}

async function callReveal(sessionId: string): Promise<void> {
  const token = getStoredToken();
  if (!token) return;
  await fetch("/api/roulette/spin", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": token },
    body: JSON.stringify({ sessionId, phase: "reveal" }),
  }).catch((e) => console.error("[ruleta/screen] reveal error", e));
}

async function callNextRound(sessionId: string): Promise<void> {
  const token = getStoredToken();
  if (!token) return;
  await fetch("/api/roulette/next-round", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": token },
    body: JSON.stringify({ sessionId }),
  }).catch((e) => console.error("[ruleta/screen] next-round error", e));
}

// ─── Countdown display (solo visual, no controla el spin) ──────────────────

function useCountdownDisplay(session: RouletteSession | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (session?.status !== "betting_open") return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [session?.status]);

  if (!session?.currentRound || session.status !== "betting_open") {
    return { remainingMs: 0, progress: 0, remainingSec: 0 };
  }
  const totalMs = session.currentRound.timeLimit * 1000;
  const elapsed = now - session.currentRound.startedAt;
  const remainingMs = Math.max(0, totalMs - elapsed);
  return {
    remainingMs,
    remainingSec: Math.ceil(remainingMs / 1000),
    progress: Math.max(0, Math.min(1, remainingMs / totalMs)),
  };
}

// ─── Componente ────────────────────────────────────────────────────────────

export default function RouletteScreenPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  const [session, setSession] = useState<RouletteSession | null>(null);
  const [players, setPlayers] = useState<Record<string, RoulettePlayer>>({});
  const [origin, setOrigin] = useState("");
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [showRien, setShowRien] = useState(false);

  // Refs para el ciclo automático — nunca se resetean por re-render
  const spinTriggered = useRef<number | null>(null);   // round.index del último spin disparado
  const spinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextRoundTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextRoundTriggered = useRef<number | null>(null);
  const rienShown = useRef<number | null>(null);       // round.index del último "rien ne va plus" mostrado

  const joinUrl = origin ? `${origin}/ruleta/${sessionId}` : `/ruleta/${sessionId}`;
  const leaderboard = useMemo(() => getLeaderboard(players), [players]);
  const playerCount = Object.keys(players).length;
  const activeCount = countActivePlayers(players);
  const betsCount = countBetsPlaced(players);

  const { remainingMs, remainingSec, progress } = useCountdownDisplay(session);

  useEffect(() => { setOrigin(window.location.origin); }, []);

  useEffect(() => {
    const offSession = listenSession(sessionId, setSession);
    const offPlayers = listenPlayers(sessionId, setPlayers);
    return () => { offSession(); offPlayers(); };
  }, [sessionId]);

  // ── CICLO 1: betting_open → programar spin con setTimeout exacto ──────────
  // Se ejecuta UNA VEZ por ronda (cuando detectamos status=betting_open + index nuevo).
  // Usa setTimeout preciso en lugar de polling con now, evitando el problema de
  // doble disparo en StrictMode y el de "nunca llega a 0" por timing.
  useEffect(() => {
    if (!session || session.status !== "betting_open") {
      // Limpiar timer si salimos de betting_open
      if (spinTimer.current !== null) {
        clearTimeout(spinTimer.current);
        spinTimer.current = null;
      }
      return;
    }

    const round = session.currentRound;

    // Ya disparamos spin para esta ronda — no hacer nada más
    if (spinTriggered.current === round.index) return;

    // Limpiar cualquier timer anterior
    if (spinTimer.current !== null) {
      clearTimeout(spinTimer.current);
      spinTimer.current = null;
    }

    const elapsed = Date.now() - round.startedAt;
    const remaining = Math.max(0, round.timeLimit * 1000 - elapsed);

    function doSpin() {
      if (spinTriggered.current === round.index) return; // doble seguro
      spinTriggered.current = round.index;
      spinTimer.current = null;

      // Mostrar "RIEN NE VA PLUS" durante RIEN_DURATION_MS, luego llamar spin
      if (rienShown.current !== round.index) {
        rienShown.current = round.index;
        setShowRien(true);
        setTimeout(() => {
          setShowRien(false);
          void callSpin(sessionId);
        }, RIEN_DURATION_MS);
      } else {
        void callSpin(sessionId);
      }
    }

    if (remaining <= 0) {
      // El tiempo ya pasó (carga tardía de la página) → girar inmediatamente
      doSpin();
    } else {
      spinTimer.current = setTimeout(doSpin, remaining);
    }

    return () => {
      if (spinTimer.current !== null) {
        clearTimeout(spinTimer.current);
        spinTimer.current = null;
      }
    };
    // Solo dependemos del round.index y startedAt — no de `now`
  }, [session?.status, session?.currentRound?.index, session?.currentRound?.startedAt, sessionId]);

  // ── CICLO 2: allBetsIn → adelantar el giro inmediatamente ─────────────────
  useEffect(() => {
    if (!session || session.status !== "betting_open") return;
    if (!checkAllBetsIn(players)) return;

    const round = session.currentRound;
    if (spinTriggered.current === round.index) return; // ya en marcha

    // Cancelar el timer del countdown y disparar ya
    if (spinTimer.current !== null) {
      clearTimeout(spinTimer.current);
      spinTimer.current = null;
    }

    if (spinTriggered.current === round.index) return;
    spinTriggered.current = round.index;

    if (rienShown.current !== round.index) {
      rienShown.current = round.index;
      setShowRien(true);
      setTimeout(() => {
        setShowRien(false);
        void callSpin(sessionId);
      }, RIEN_DURATION_MS);
    } else {
      void callSpin(sessionId);
    }
  }, [players, session?.status, session?.currentRound?.index, sessionId]);

  // ── CICLO 3: result → next-round tras 4s ──────────────────────────────────
  useEffect(() => {
    if (!session || session.status !== "result") return;

    const roundIdx = session.currentRound.index;
    if (nextRoundTriggered.current === roundIdx) return;
    if (nextRoundTimer.current !== null) return;

    nextRoundTimer.current = setTimeout(() => {
      nextRoundTriggered.current = roundIdx;
      nextRoundTimer.current = null;
      void callNextRound(sessionId);
    }, ROUND_RESULT_DELAY_MS);

    return () => {
      if (nextRoundTimer.current !== null) {
        clearTimeout(nextRoundTimer.current);
        nextRoundTimer.current = null;
      }
    };
  }, [session?.status, session?.currentRound?.index, sessionId]);

  // ── Arrancar/parar animación de rueda ─────────────────────────────────────
  useEffect(() => {
    if (
      session?.status === "spinning" &&
      session.currentRound.result !== null &&
      session.currentRound.result !== undefined
    ) {
      setWheelSpinning(true);
    } else if (session?.status !== "spinning") {
      setWheelSpinning(false);
    }
  }, [session?.status, session?.currentRound?.result]);

  function handleStopSpinning() {
    setWheelSpinning(false);
    void callReveal(sessionId);
  }

  // ── Datos derivados ───────────────────────────────────────────────────────
  const round = session?.currentRound;
  const result = round?.result ?? null;

  const winners = useMemo(() => {
    if (!round || result === null) return [] as { id: string; name: string; delta: number }[];
    return Object.entries(players)
      .filter(([, p]) => (p.lastDelta ?? 0) > 0 && p.lastResultRound === round.index)
      .map(([id, p]) => ({ id, name: p.name, delta: p.lastDelta ?? 0 }))
      .sort((a, b) => b.delta - a.delta);
  }, [players, round, result]);

  const recentHistory = (session?.history ?? []).slice(-5);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen overflow-hidden bg-techno px-8 py-6 text-white">
      {/* Overlay RIEN NE VA PLUS */}
      <AnimatePresence>
        {showRien ? (
          <motion.div
            key="rien"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <motion.p
              initial={{ scale: 0.7, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="font-display text-6xl font-bold tracking-widest text-yellow-400 drop-shadow-[0_0_40px_rgba(251,191,36,0.8)] md:text-8xl"
              style={{ textShadow: "0 0 60px #fbbf24, 0 0 120px #f59e0b" }}
            >
              🎰 NO VA MÁS
            </motion.p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="mx-auto flex min-h-[calc(100vh-48px)] max-w-[1600px] flex-col">
        <header className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-cyan-300">Triple Nelson · Ruleta</p>
            <h1 className="font-display text-5xl font-bold tracking-tight">
              {session?.status === "lobby" ? "Lobby" : `Sesión ${sessionId}`}
            </h1>
          </div>
          <div className="rounded-lg border border-zinc-700 bg-black/60 px-5 py-3 text-right">
            <p className="font-mono text-4xl text-cyan-200">{sessionId}</p>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">código</p>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {/* ─── LOBBY ─── */}
          {session?.status === "lobby" ? (
            <motion.section key="lobby" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }}
              className="grid flex-1 gap-10 py-8 lg:grid-cols-[400px_1fr]">
              <div className="flex flex-col justify-center gap-5">
                <div className="rounded-lg border border-white/20 bg-white p-6">
                  <QRCodeSVG value={joinUrl} size={320} includeMargin />
                </div>
                <p className="break-all rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-4 py-3 font-mono text-lg text-cyan-100">
                  {joinUrl}
                </p>
                <p className="text-center text-sm text-zinc-400">Escanea para unirte · Esperando al host...</p>
              </div>
              <div className="flex flex-col justify-center">
                <p className="text-sm uppercase tracking-[0.4em] text-lime-300">Jugadores</p>
                <h2 className="mt-1 font-display text-8xl font-bold">{playerCount}</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Saldo inicial: <span className="font-mono text-cyan-200">{session.config.initialCredits}</span> créditos
                </p>
                <div className="mt-6 grid max-h-[55vh] grid-cols-2 gap-3 overflow-hidden xl:grid-cols-3">
                  {Object.entries(players).map(([id, p], i) => (
                    <motion.div key={id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: Math.min(i * 0.02, 0.3) }}
                      className="truncate rounded-lg border border-zinc-800 bg-black/50 px-4 py-3 text-xl font-semibold">
                      {p.name}
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.section>
          ) : null}

          {/* ─── BETTING / SPINNING ─── */}
          {session && (session.status === "betting_open" || session.status === "spinning") ? (
            <motion.section key="play" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="grid flex-1 gap-6 py-6 lg:grid-cols-[1fr_420px]">

              {/* Rueda */}
              <div className="flex flex-col items-center justify-center gap-4">
                <RouletteWheel
                  spinning={wheelSpinning}
                  prizeNumber={result}
                  onStopSpinning={handleStopSpinning}
                  size={500}
                />
                {session.status === "spinning" ? (
                  <motion.p animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1, repeat: Infinity }}
                    className="font-display text-4xl font-bold text-fuchsia-300">
                    Girando...
                  </motion.p>
                ) : null}
              </div>

              {/* Panel derecho */}
              <div className="flex flex-col gap-4">
                {session.status === "betting_open" ? (
                  <div className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 p-5">
                    <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
                      Ronda {round?.index ?? 0} · Apuestas abiertas
                    </p>
                    <p className={`mt-1 font-display text-7xl font-bold leading-none ${remainingSec <= 10 ? "text-rose-300" : ""}`}>
                      {remainingSec}s
                    </p>
                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-cyan-900/50">
                      <div
                        className={`h-full rounded-full transition-[width] ${remainingSec <= 10 ? "bg-rose-400" : "bg-cyan-300"}`}
                        style={{ width: `${progress * 100}%` }}
                      />
                    </div>
                    <p className="mt-3 text-xl text-zinc-200">
                      <span className="font-mono text-3xl text-cyan-200">{betsCount}</span>
                      <span className="text-zinc-400"> / {activeCount} apostaron</span>
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-fuchsia-400/40 bg-fuchsia-400/10 p-5">
                    <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-200">Girando la ruleta</p>
                    <p className="mt-1 font-display text-4xl font-bold">
                      {betsCount} apuestas · Ronda {round?.index ?? 0}
                    </p>
                  </div>
                )}

                {/* Historial */}
                <div className="rounded-xl border border-zinc-800 bg-black/50 p-4">
                  <p className="mb-3 text-xs uppercase tracking-[0.3em] text-zinc-400">Últimos resultados</p>
                  <div className="flex flex-wrap gap-2">
                    {recentHistory.length ? recentHistory.map((h) => (
                      <div key={`${h.round}-${h.result}`}
                        className="flex h-11 w-11 items-center justify-center rounded-full font-mono text-lg font-bold"
                        style={{
                          backgroundColor: h.color === "red" ? "#dc2626" : h.color === "green" ? "#16a34a" : "#1a1a1a",
                          color: "white",
                        }}>
                        {h.result}
                      </div>
                    )) : <p className="text-sm text-zinc-600">Sin historia.</p>}
                  </div>
                </div>

                {/* Ranking */}
                <div className="flex-1 rounded-xl border border-zinc-800 bg-black/50 p-4">
                  <p className="mb-3 text-xs uppercase tracking-[0.3em] text-lime-300">Ranking</p>
                  <div className="space-y-2">
                    {leaderboard.slice(0, 6).map((entry) => (
                      <div key={entry.playerId}
                        className={`flex items-center justify-between rounded-lg border px-3 py-2 ${entry.eliminated ? "border-rose-500/30 bg-rose-500/5 opacity-50" : "border-zinc-800 bg-black/40"}`}>
                        <span className="truncate text-lg">
                          <span className="mr-2 text-zinc-500">#{entry.rank}</span>{entry.name}
                        </span>
                        <span className="font-mono text-xl text-cyan-200">{entry.credits}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.section>
          ) : null}

          {/* ─── RESULT ─── */}
          {session?.status === "result" && result !== null ? (
            <motion.section key={`result-${round?.index}`} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="grid flex-1 gap-10 py-8 lg:grid-cols-[1fr_1fr] items-center">
              <div className="flex flex-col items-center justify-center">
                <p className="text-sm uppercase tracking-[0.4em] text-amber-300">Resultado · Ronda {round?.index}</p>
                <motion.div
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                  className="mt-6 flex h-64 w-64 items-center justify-center rounded-full border-8 font-display font-bold leading-none"
                  style={{
                    fontSize: "9rem",
                    backgroundColor: getNumberColor(result) === "red" ? "#dc2626" : getNumberColor(result) === "green" ? "#16a34a" : "#1a1a1a",
                    borderColor: getNumberColor(result) === "red" ? "#fca5a5" : getNumberColor(result) === "green" ? "#86efac" : "#52525b",
                    color: "#ffffff",
                  }}>
                  {result}
                </motion.div>
                <p className="mt-5 font-display text-3xl font-bold uppercase tracking-[0.2em]"
                  style={{ color: getNumberColor(result) === "red" ? "#ef4444" : getNumberColor(result) === "green" ? "#22c55e" : "#a1a1aa" }}>
                  {getNumberColor(result) === "red" ? "Rojo" : getNumberColor(result) === "green" ? "Verde · 0" : "Negro"}
                </p>
              </div>
              <div className="flex flex-col gap-5">
                <div className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-5">
                  <p className="mb-3 text-sm uppercase tracking-[0.3em] text-emerald-200">Ganadores</p>
                  {winners.length ? (
                    <div className="max-h-52 space-y-2 overflow-hidden">
                      {winners.slice(0, 5).map((w) => (
                        <motion.div key={w.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                          className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-black/40 px-4 py-3">
                          <span className="text-2xl font-bold">{w.name}</span>
                          <span className="font-mono text-2xl text-emerald-300">+{w.delta}</span>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xl text-zinc-400">Nadie acertó esta ronda.</p>
                  )}
                </div>
                <div className="rounded-xl border border-zinc-800 bg-black/50 p-5">
                  <p className="mb-3 text-sm uppercase tracking-[0.3em] text-lime-300">Top 5</p>
                  <div className="space-y-2">
                    {leaderboard.slice(0, 5).map((entry) => (
                      <div key={entry.playerId}
                        className={`flex items-center justify-between rounded-lg border px-4 py-2 ${entry.eliminated ? "border-rose-500/30 opacity-50" : "border-zinc-800 bg-black/40"}`}>
                        <span className="truncate text-2xl"><span className="mr-2 text-zinc-500">#{entry.rank}</span>{entry.name}</span>
                        <span className="font-mono text-2xl text-cyan-200">{entry.credits}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.section>
          ) : null}

          {/* ─── FINISHED ─── */}
          {session?.status === "finished" ? (
            <motion.section key="finished" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex flex-1 flex-col justify-center py-8">
              <p className="text-sm uppercase tracking-[0.4em] text-fuchsia-300">Partida finalizada</p>
              <h2 className="mt-2 font-display text-8xl font-bold">Podio</h2>
              <div className="mt-10 grid grid-cols-3 items-end gap-6">
                {[leaderboard[1], leaderboard[0], leaderboard[2]].map((entry, i) => {
                  const place = i === 0 ? 2 : i === 1 ? 1 : 3;
                  const heights = ["h-[280px]", "h-[400px]", "h-[210px]"];
                  return (
                    <motion.div key={entry?.playerId ?? place} initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.15, type: "spring", stiffness: 90 }} className="text-center">
                      <p className="mb-4 truncate text-5xl font-bold">{entry?.name ?? "--"}</p>
                      <div className={`${heights[i]} flex flex-col items-center justify-center rounded-xl border border-white/20 bg-white text-black`}>
                        <span className="font-display text-8xl font-bold">#{place}</span>
                        <span className="mt-3 font-mono text-4xl">{entry?.credits ?? 0}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              <div className="mt-10 grid max-h-[30vh] grid-cols-2 gap-2 overflow-hidden">
                {leaderboard.map((entry) => (
                  <div key={entry.playerId}
                    className={`flex items-center justify-between rounded-lg border px-4 py-2 text-xl ${entry.eliminated ? "border-rose-500/30 opacity-50" : "border-zinc-800 bg-black/40"}`}>
                    <span className="truncate"><span className="mr-2 text-zinc-500">#{entry.rank}</span>{entry.name}</span>
                    <span className="font-mono text-cyan-200">{entry.credits}</span>
                  </div>
                ))}
              </div>
            </motion.section>
          ) : null}
        </AnimatePresence>
      </div>
    </main>
  );
}

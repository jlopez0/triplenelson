"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  joinSession,
  listenPlayer,
  listenPlayers,
  listenSession,
  placeBets,
  getLeaderboard,
} from "@/lib/roulette/rtdb";
import { BET_LIMITS, BET_TYPE_LABELS, getNumberColor } from "@/lib/roulette/logic";
import { CasinoBettingUI } from "@/components/roulette/CasinoBettingUI";
import { RouletteWheel } from "@/components/roulette/RouletteWheel";
import type { Bet, RoulettePlayer, RouletteSession } from "@/lib/roulette/types";

function useCountdown(session: RouletteSession | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);
  if (!session?.currentRound || session.status !== "betting_open") return { remainingMs: 0, progress: 0 };
  const totalMs = session.currentRound.timeLimit * 1000;
  const elapsed = now - session.currentRound.startedAt;
  const remainingMs = Math.max(0, totalMs - elapsed);
  return { remainingMs, progress: Math.max(0, Math.min(1, remainingMs / totalMs)) };
}

export default function RoulettePlayerPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const storageKey = `tn_roulette_player_${sessionId}`;

  const [nickname, setNickname] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [player, setPlayer] = useState<RoulettePlayer | null>(null);
  const [session, setSession] = useState<RouletteSession | null>(null);
  const [players, setPlayers] = useState<Record<string, RoulettePlayer>>({});

  // Apuestas acumuladas localmente (se envían al confirmar)
  const [pendingBets, setPendingBets] = useState<Bet[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  // Rueda en móvil — solo visual, no controla el ciclo
  const [wheelSpinning, setWheelSpinning] = useState(false);

  const [joining, setJoining] = useState(false);

  const { remainingMs, progress } = useCountdown(session);
  const leaderboard = useMemo(() => getLeaderboard(players), [players]);
  const myRank = useMemo(() => leaderboard.find((e) => e.playerId === playerId) ?? null, [leaderboard, playerId]);
  const playerCount = Object.keys(players).length;
  const credits = player?.credits ?? 0;

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) setPlayerId(stored);
  }, [storageKey]);

  useEffect(() => listenSession(sessionId, setSession), [sessionId]);
  useEffect(() => listenPlayers(sessionId, setPlayers), [sessionId]);

  useEffect(() => {
    if (!playerId) { setPlayer(null); return; }
    return listenPlayer(sessionId, playerId, setPlayer);
  }, [sessionId, playerId]);

  // Reset apuestas locales al inicio de nueva ronda
  useEffect(() => {
    if (session?.status === "betting_open") {
      setPendingBets([]);
      setError("");
      setConfirming(false);
    }
  }, [session?.status, session?.currentRound?.index]);

  // Arrancar/parar rueda según status
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

  async function handleJoin(event: React.FormEvent) {
    event.preventDefault();
    setJoining(true);
    setError("");
    try {
      const id = await joinSession(sessionId, nickname);
      window.localStorage.setItem(storageKey, id);
      setPlayerId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo entrar.");
    } finally {
      setJoining(false);
    }
  }

  function handleAddBet(bet: Bet) {
    const totalIfAdded = pendingBets.reduce((s, b) => s + b.amount, 0) + bet.amount;
    if (totalIfAdded > credits) { setError("Saldo insuficiente."); return; }
    setError("");
    setPendingBets((prev) => [...prev, bet]);
  }

  function handleClearBets() {
    setPendingBets([]);
    setError("");
  }

  async function handleConfirmBets() {
    if (!playerId || !player || !pendingBets.length) return;
    if (player.eliminated || player.hasBet) return;
    if (session?.status !== "betting_open") return;

    setConfirming(true);
    setError("");
    try {
      await placeBets(sessionId, playerId, pendingBets);
    } catch (err) {
      setConfirming(false);
      setError(err instanceof Error ? err.message : "No se pudo enviar la apuesta.");
    }
  }

  // ── Loading ──
  if (session === undefined) return null;

  // ── Sesión no encontrada ──
  if (!session) {
    return (
      <main className="min-h-screen bg-techno px-5 py-8">
        <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
          <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">Ruleta</p>
          <h1 className="mt-2 font-display text-5xl font-bold">Sesión no encontrada</h1>
          <Link href="/" className="mt-8 rounded-md border border-zinc-700 px-5 py-4 text-center text-xs uppercase tracking-[0.22em] text-zinc-300">Volver</Link>
        </div>
      </main>
    );
  }

  // ── Join ──
  if (!playerId || !player) {
    return (
      <main className="min-h-screen bg-techno px-5 py-8">
        <form onSubmit={handleJoin} className="mx-auto flex min-h-[78vh] max-w-md flex-col justify-center">
          <p className="text-xs uppercase tracking-[0.32em] text-cyan-300">Sesión {sessionId}</p>
          <h1 className="mt-3 font-display text-6xl font-bold leading-none">Únete a la ruleta</h1>
          <p className="mt-3 text-zinc-400">Empezarás con <span className="font-mono text-cyan-200">{session.config.initialCredits}</span> créditos.</p>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20} placeholder="Tu nickname"
            className="mt-8 w-full rounded-lg border border-zinc-700 bg-black/70 px-5 py-5 text-xl outline-none focus:border-cyan-300" />
          {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
          <button type="submit" disabled={joining || !nickname.trim()}
            className="mt-5 min-h-[60px] rounded-lg bg-white px-5 py-4 text-sm font-bold uppercase tracking-[0.28em] text-black active:scale-[0.98] disabled:opacity-50">
            {joining ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </main>
    );
  }

  const round = session.currentRound;
  const result = round?.result ?? null;
  const resultColor = result !== null ? getNumberColor(result) : null;
  const lastDelta = player.lastDelta ?? 0;
  const playerBets = Array.isArray(player.bets) ? player.bets : [];

  return (
    <main className="h-dvh bg-techno flex flex-col overflow-hidden">
      <div className="flex flex-col h-full max-w-lg mx-auto w-full px-3 py-2">

        {/* Saldo */}
        <header className="shrink-0 flex items-center justify-between gap-3 border-b border-zinc-800 pb-2 mb-2">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.26em] text-zinc-500">Triple Nelson · Ruleta</p>
            <h1 className="truncate font-display text-xl font-semibold">{player.name}</h1>
          </div>
          <div className="text-right">
            <p className={`font-mono text-3xl font-bold ${player.eliminated ? "text-rose-300" : "text-cyan-200"}`}>{player.credits}</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">créditos</p>
          </div>
        </header>

        <AnimatePresence mode="wait" initial={false}>

          {/* ── LOBBY ── */}
          {session.status === "lobby" ? (
            <motion.section key="lobby" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex flex-1 flex-col justify-center py-8">
              <p className="text-xs uppercase tracking-[0.32em] text-cyan-300">Lobby</p>
              <h2 className="mt-3 font-display text-5xl font-bold leading-none">Esperando al host...</h2>
              <p className="mt-4 text-zinc-400">{playerCount} jugador{playerCount === 1 ? "" : "es"} en sala.</p>
              <div className="mt-6 grid grid-cols-2 gap-2">
                {Object.entries(players).slice(0, 12).map(([id, p]) => (
                  <div key={id} className="truncate rounded-md border border-zinc-800 bg-black/50 px-3 py-3 text-sm">{p.name}</div>
                ))}
              </div>
            </motion.section>
          ) : null}

          {/* ── BETTING OPEN ── */}
          {session.status === "betting_open" ? (
            <motion.section key={`bet-${round.index}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-1 flex-col min-h-0">

              {/* Countdown */}
              <div className="shrink-0 mb-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <div className={`h-full rounded-full transition-[width] ${remainingMs < 10000 ? "bg-rose-400" : "bg-cyan-300"}`} style={{ width: `${progress * 100}%` }} />
                </div>
                <div className="mt-0.5 flex justify-between text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                  <span>Ronda {round.index}</span>
                  <span className={remainingMs < 10000 ? "text-rose-300 font-bold" : ""}>{Math.ceil(remainingMs / 1000)}s</span>
                </div>
              </div>

              {player.eliminated ? (
                <div className="flex flex-1 items-center justify-center">
                  <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-5 text-center">
                    <p className="text-xl font-bold text-rose-200">Sin créditos</p>
                    <p className="mt-1 text-sm text-rose-300/70">Puedes seguir viendo la partida.</p>
                  </div>
                </div>
              ) : player.hasBet ? (
                <div className="flex flex-1 flex-col items-center justify-center">
                  <div className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-6 text-center w-full">
                    <p className="text-xl font-bold text-emerald-200">¡Apuestas confirmadas!</p>
                    <div className="mt-3 space-y-1">
                      {playerBets.map((b, i) => (
                        <p key={i} className="text-sm text-zinc-300">
                          <span className="text-white font-semibold">{BET_TYPE_LABELS[b.type]}{(b.type === "number" || b.type === "corner") && b.value !== null ? ` ${b.value}` : ""}</span>
                          {" · "}<span className="font-mono text-cyan-200">{b.amount}</span>
                          {" · "}<span className="text-zinc-500">x{BET_LIMITS[b.type].payout}</span>
                        </p>
                      ))}
                    </div>
                    <p className="mt-3 font-mono text-lg text-cyan-200">Total: {playerBets.reduce((s, b) => s + b.amount, 0)}</p>
                    <p className="mt-3 text-sm text-zinc-400 animate-pulse">Esperando a que gire la ruleta...</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-0 flex flex-col">
                  <CasinoBettingUI
                    credits={credits}
                    pendingBets={pendingBets}
                    onAdd={handleAddBet}
                    onClear={handleClearBets}
                    onConfirm={handleConfirmBets}
                    disabled={confirming}
                    confirming={confirming}
                  />
                  {error ? (
                    <p className="shrink-0 mt-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>
                  ) : null}
                </div>
              )}
            </motion.section>
          ) : null}

          {/* ── SPINNING ── */}
          {session.status === "spinning" ? (
            <motion.section key="spin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-1 flex-col items-center justify-center py-6 gap-4">
              <RouletteWheel
                spinning={wheelSpinning}
                prizeNumber={result}
                onStopSpinning={() => setWheelSpinning(false)}
                size={300}
              />
              <motion.p animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1, repeat: Infinity }}
                className="font-display text-3xl font-bold text-fuchsia-300">
                Girando...
              </motion.p>
              {playerBets.length > 0 ? (
                <div className="rounded-xl border border-zinc-700 bg-black/50 px-5 py-3 text-center w-full max-w-xs">
                  <p className="text-xs text-zinc-400 mb-1">Tus apuestas</p>
                  {playerBets.map((b, i) => (
                    <p key={i} className="text-sm text-zinc-300">
                      {BET_TYPE_LABELS[b.type]}{b.type === "number" && b.value !== null ? ` ${b.value}` : ""}
                      {" · "}<span className="font-mono text-cyan-200">{b.amount}</span>
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-400">No apostaste en esta ronda.</p>
              )}
            </motion.section>
          ) : null}

          {/* ── RESULT ── */}
          {session.status === "result" && result !== null ? (
            <motion.section key={`result-${round.index}`} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="flex flex-1 flex-col items-center justify-center py-6 gap-5">
              <div className="flex h-36 w-36 items-center justify-center rounded-full border-4 font-display text-6xl font-bold"
                style={{
                  backgroundColor: resultColor === "red" ? "#dc2626" : resultColor === "green" ? "#16a34a" : "#1a1a1a",
                  borderColor: resultColor === "red" ? "#fca5a5" : resultColor === "green" ? "#86efac" : "#52525b",
                  color: "#ffffff",
                }}>
                {result}
              </div>
              <div className="text-center">
                {lastDelta > 0 ? (
                  <><p className="font-display text-5xl font-bold text-emerald-300">+{lastDelta}</p><p className="text-lg text-emerald-300/70">créditos ganados 🎉</p></>
                ) : lastDelta < 0 ? (
                  <><p className="font-display text-5xl font-bold text-rose-300">{lastDelta}</p><p className="text-lg text-rose-300/70">créditos perdidos</p></>
                ) : (
                  <p className="font-display text-3xl font-bold text-zinc-400">Sin apuesta</p>
                )}
                <p className="mt-3 text-zinc-400">Saldo: <span className="font-mono text-xl text-cyan-200">{player.credits}</span></p>
              </div>
              <p className="text-sm text-zinc-500 animate-pulse">Nueva ronda en breve...</p>
            </motion.section>
          ) : null}

          {/* ── FINISHED ── */}
          {session.status === "finished" ? (
            <motion.section key="finished" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex flex-1 flex-col py-5">
              <p className="text-xs uppercase tracking-[0.32em] text-fuchsia-300">Partida finalizada</p>
              <div className="mt-4 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-5 py-6 text-center">
                <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">Tu resultado</p>
                <p className="mt-2 font-display text-7xl font-bold text-white">{player.credits}</p>
                <p className="mt-1 text-sm text-cyan-200">créditos</p>
                <p className="mt-3 text-2xl font-semibold text-zinc-300">#{myRank?.rank ?? "--"} de {playerCount}</p>
              </div>
              <p className="mt-6 mb-3 text-xs uppercase tracking-[0.28em] text-zinc-500">Clasificación final</p>
              <div className="space-y-2 overflow-y-auto max-h-64">
                {leaderboard.map((entry) => (
                  <div key={entry.playerId}
                    className={`flex items-center justify-between rounded-md border px-4 py-2 ${entry.playerId === playerId ? "border-cyan-300 bg-cyan-300/10 font-semibold" : "border-zinc-800 bg-black/50"} ${entry.eliminated ? "opacity-50" : ""}`}>
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

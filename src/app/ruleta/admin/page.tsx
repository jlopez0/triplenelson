"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  getLeaderboard,
  listenPlayers,
  listenSession,
} from "@/lib/roulette/rtdb";
import { BET_TYPE_LABELS, getNumberColor } from "@/lib/roulette/logic";
import type { RoulettePlayer, RouletteSession } from "@/lib/roulette/types";

const TOKEN_KEY = "tn_roulette_admin_token";
const SESSION_ID_KEY = "tn_roulette_admin_session";

function authHeaders(token: string): HeadersInit {
  return { "x-admin-token": token };
}

const STATUS_LABELS: Record<RouletteSession["status"], string> = {
  lobby: "Lobby",
  betting_open: "Apuestas abiertas",
  spinning: "Girando",
  result: "Resultado",
  finished: "Terminada",
};

const STATUS_COLORS: Record<RouletteSession["status"], string> = {
  lobby: "text-cyan-300 border-cyan-500/40 bg-cyan-500/10",
  betting_open: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  spinning: "text-fuchsia-300 border-fuchsia-500/40 bg-fuchsia-500/10",
  result: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  finished: "text-zinc-300 border-zinc-500/40 bg-zinc-500/10",
};

export default function RouletteAdminPage() {
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginError, setLoginError] = useState("");

  const [sessionId, setSessionId] = useState("");
  const [session, setSession] = useState<RouletteSession | null>(null);
  const [players, setPlayers] = useState<Record<string, RoulettePlayer>>({});
  const [initialCredits, setInitialCredits] = useState(2000);
  const [busy, setBusy] = useState("");
  const inFlightRef = useRef<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const leaderboard = useMemo(() => getLeaderboard(players), [players]);
  const playerCount = Object.keys(players).length;
  const activeCount = Object.values(players).filter((p) => !p.eliminated).length;
  const betsCount = Object.values(players).filter((p) => !p.eliminated && p.hasBet).length;

  useEffect(() => {
    const storedSession = window.localStorage.getItem(SESSION_ID_KEY) ?? "";
    if (storedSession) setSessionId(storedSession);

    const stored = window.localStorage.getItem(TOKEN_KEY) ?? "";
    if (!stored) {
      setAuthLoading(false);
      return;
    }
    setTokenInput(stored);
    void validateToken(stored);
  }, []);

  useEffect(() => {
    if (sessionId) {
      window.localStorage.setItem(SESSION_ID_KEY, sessionId);
    } else {
      window.localStorage.removeItem(SESSION_ID_KEY);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setSession(null);
      return;
    }
    return listenSession(sessionId, setSession);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setPlayers({});
      return;
    }
    return listenPlayers(sessionId, setPlayers);
  }, [sessionId]);

  // Multi-admin: al autenticarse, carga siempre la sesión activa si hay una,
  // independientemente de lo que haya en localStorage.
  useEffect(() => {
    if (isAuthed && activeSessionId) {
      setSessionId(activeSessionId);
    }
  }, [isAuthed, activeSessionId]);

  // Refrescar la sesión activa periódicamente por si otro admin la cambia.
  useEffect(() => {
    if (!isAuthed) return;
    const id = window.setInterval(() => void loadActiveSession(), 8000);
    return () => window.clearInterval(id);
  }, [isAuthed]);

  async function validateToken(value = tokenInput) {
    setAuthLoading(true);
    setLoginError("");
    try {
      const res = await fetch("/kahoot/api/auth", {
        headers: authHeaders(value.trim()),
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Token incorrecto.");
      window.localStorage.setItem(TOKEN_KEY, value.trim());
      setToken(value.trim());
      setIsAuthed(true);
      void loadActiveSession();
    } catch (err) {
      window.localStorage.removeItem(TOKEN_KEY);
      setIsAuthed(false);
      setLoginError(err instanceof Error ? err.message : "No se pudo validar.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function loadActiveSession() {
    try {
      const res = await fetch("/api/roulette/active-session", { cache: "no-store" });
      const payload = (await res.json()) as { sessionId: string | null };
      setActiveSessionId(payload.sessionId ?? null);
    } catch {
      // no-crítico
    }
  }

  async function setActiveSession(id: string | null) {
    setBusy("active");
    setError("");
    try {
      const res = await fetch("/api/roulette/active-session", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ sessionId: id }),
      });
      if (!res.ok) throw new Error("No se pudo actualizar la sesión activa.");
      setActiveSessionId(id);
      setMessage(
        id
          ? `Sesión ${id} activada. El botón ya es visible en la home.`
          : "Sesión desactivada. El botón en la home está oculto.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error activando sesión.");
    } finally {
      setBusy("");
    }
  }

  function logout() {
    window.localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setTokenInput("");
    setIsAuthed(false);
    setSessionId("");
  }

  async function handleCreateSession() {
    if (inFlightRef.current.has("create")) return;
    inFlightRef.current.add("create");
    setBusy("create");
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/roulette/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ initialCredits }),
      });
      const body = (await res.json()) as { sessionId?: string; message?: string; error?: string };
      if (!res.ok) throw new Error(body.message ?? body.error ?? "No se pudo crear la sesión.");
      const id = body.sessionId!;
      setSessionId(id);
      setMessage(`Sesión ${id} creada. Abre la pantalla y deja entrar jugadores.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la sesión.");
    } finally {
      inFlightRef.current.delete("create");
      setBusy("");
    }
  }

  async function handleStart() {
    if (!sessionId) return;
    if (inFlightRef.current.has("start")) return;
    inFlightRef.current.add("start");
    setBusy("start");
    setError("");
    try {
      const res = await fetch("/api/roulette/start-round", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ sessionId }),
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) throw new Error(body.message ?? body.error ?? "No se pudo iniciar la partida.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar la partida.");
    } finally {
      inFlightRef.current.delete("start");
      setBusy("");
    }
  }

  async function handleFinish() {
    if (!sessionId) return;
    if (inFlightRef.current.has("finish")) return;
    inFlightRef.current.add("finish");
    setBusy("finish");
    setError("");
    try {
      const res = await fetch("/api/roulette/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? "No se pudo finalizar.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo finalizar.");
    } finally {
      inFlightRef.current.delete("finish");
      setBusy("");
    }
  }

  if (authLoading) {
    return (
      <main className="min-h-screen bg-techno px-5 py-8">
        <div className="mx-auto max-w-md rounded-lg border border-zinc-800 bg-black/60 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-400">Validando host...</p>
        </div>
      </main>
    );
  }

  if (!isAuthed) {
    return (
      <main className="min-h-screen bg-techno flex items-center justify-center px-5">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void validateToken();
          }}
          className="w-full max-w-md rounded-lg border border-zinc-800 bg-black/70 p-6 shadow-2xl"
        >
          <Link href="/" className="font-display text-2xl font-bold tracking-tighter">
            TRIPLE NELSON
          </Link>
          <h1 className="mt-8 font-display text-4xl font-semibold tracking-tight">
            Ruleta Admin
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Acceso protegido con el token de admin.
          </p>
          <input
            value={tokenInput}
            onChange={(event) => setTokenInput(event.target.value)}
            placeholder="x-admin-token"
            type="password"
            className="mt-6 w-full rounded-md border border-zinc-700 bg-black px-4 py-3 text-sm outline-none focus:border-cyan-300"
          />
          {loginError ? <p className="mt-3 text-sm text-rose-300">{loginError}</p> : null}
          <button
            type="submit"
            className="mt-5 w-full rounded-md bg-white px-5 py-3 text-xs font-bold uppercase tracking-[0.28em] text-black transition hover:bg-cyan-200"
          >
            Entrar
          </button>
        </form>
      </main>
    );
  }

  const round = session?.currentRound;
  const result = round?.result ?? null;
  const resultColor =
    result !== null ? getNumberColor(result) : null;

  return (
    <main className="min-h-screen bg-techno px-4 py-5 md:px-8 md:py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-zinc-800 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/" className="font-display text-sm uppercase tracking-[0.35em] text-zinc-500">
              Triple Nelson
            </Link>
            <h1 className="font-display text-4xl font-bold tracking-tight md:text-6xl">
              Ruleta Control
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {sessionId ? (
              <>
                <Link
                  href={`/ruleta/${sessionId}/screen`}
                  target="_blank"
                  className="rounded-md border border-cyan-400/50 px-4 py-3 text-xs uppercase tracking-[0.24em] text-cyan-200 hover:bg-cyan-400/10"
                >
                  Pantalla
                </Link>
                <Link
                  href={`/ruleta/${sessionId}`}
                  target="_blank"
                  className="rounded-md border border-zinc-700 px-4 py-3 text-xs uppercase tracking-[0.24em] text-zinc-200 hover:bg-white/10"
                >
                  Unirse
                </Link>
              </>
            ) : null}
            <button
              type="button"
              onClick={logout}
              className="rounded-md border border-zinc-700 px-4 py-3 text-xs uppercase tracking-[0.24em] text-zinc-400 hover:text-white"
            >
              Salir
            </button>
          </div>
        </header>

        {message ? (
          <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </p>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-5 md:p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">Sesión</p>
            <h2 className="mt-1 font-display text-5xl font-bold">
              {sessionId || "Nueva"}
            </h2>

            <div className="mt-5 space-y-3">
              <label className="block text-xs uppercase tracking-[0.22em] text-zinc-400">
                Créditos iniciales por jugador
                <input
                  type="number"
                  min={100}
                  max={100000}
                  step={100}
                  value={initialCredits}
                  onChange={(event) => setInitialCredits(Number(event.target.value))}
                  className="mt-2 w-full rounded-md border border-zinc-700 bg-black/70 px-4 py-3 font-mono text-xl text-white"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCreateSession}
                  disabled={busy === "create"}
                  className="rounded-md bg-white px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] text-black disabled:opacity-40"
                >
                  Crear sesión
                </button>
                <input
                  value={sessionId}
                  onChange={(event) => setSessionId(event.target.value.trim())}
                  placeholder="Cargar sessionId"
                  className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-black/70 px-3 py-3 text-sm"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${activeSessionId ? "animate-pulse bg-emerald-400" : "bg-zinc-600"}`}
                  />
                  <span className="text-xs text-zinc-400">
                    {activeSessionId ? `Activa en home: ${activeSessionId}` : "Sin sesión activa en home"}
                  </span>
                </div>
                {activeSessionId && activeSessionId !== sessionId ? (
                  <button
                    type="button"
                    onClick={() => setSessionId(activeSessionId)}
                    className="rounded-md border border-cyan-500/60 px-3 py-2 text-xs uppercase tracking-[0.18em] text-cyan-200 hover:bg-cyan-500/10"
                  >
                    Controlar sesión activa
                  </button>
                ) : null}
                {sessionId && sessionId !== activeSessionId ? (
                  <button
                    type="button"
                    onClick={() => void setActiveSession(sessionId)}
                    disabled={busy === "active"}
                    className="rounded-md border border-emerald-500/60 px-3 py-2 text-xs uppercase tracking-[0.18em] text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-40"
                  >
                    Mostrar en home
                  </button>
                ) : null}
                {activeSessionId ? (
                  <button
                    type="button"
                    onClick={() => void setActiveSession(null)}
                    disabled={busy === "active"}
                    className="rounded-md border border-rose-500/40 px-3 py-2 text-xs uppercase tracking-[0.18em] text-rose-200 hover:bg-rose-500/10 disabled:opacity-40"
                  >
                    Ocultar de home
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-black/50 p-5 md:p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-300">Estado</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <h2 className="font-display text-4xl font-semibold capitalize">
                {session ? STATUS_LABELS[session.status] : "Sin sesión"}
              </h2>
              {session ? (
                <span
                  className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] ${STATUS_COLORS[session.status]}`}
                >
                  {STATUS_LABELS[session.status]}
                </span>
              ) : null}
            </div>
            {session ? (
              <p className="mt-2 text-sm text-zinc-400">
                Ronda {round?.index ?? 0} · {betsCount}/{activeCount} apuestas · {playerCount} jugadores
              </p>
            ) : null}

            {result !== null ? (
              <div className="mt-5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.22em] text-amber-200">Último resultado</p>
                <p
                  className="mt-1 font-display text-6xl font-bold"
                  style={{
                    color:
                      resultColor === "red"
                        ? "#ef4444"
                        : resultColor === "green"
                          ? "#22c55e"
                          : "#ffffff",
                  }}
                >
                  {result}
                </p>
              </div>
            ) : null}

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleStart}
                disabled={!session || session.status !== "lobby" || busy === "start"}
                className="rounded-md bg-white px-4 py-4 text-xs font-bold uppercase tracking-[0.2em] text-black disabled:opacity-40"
              >
                Iniciar partida
              </button>
              <button
                type="button"
                onClick={handleFinish}
                disabled={!session || session.status === "finished" || busy === "finish"}
                className="rounded-md border border-rose-400/60 px-4 py-4 text-xs uppercase tracking-[0.2em] text-rose-100 disabled:opacity-40"
              >
                Terminar partida
              </button>
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              El ciclo apuestas → ruleta → resultado es automático tras iniciar.
            </p>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-800 bg-black/50 p-5 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-lime-300">Jugadores</p>
              <h2 className="mt-1 font-display text-4xl font-semibold">
                {playerCount} {playerCount === 1 ? "jugador" : "jugadores"}
              </h2>
            </div>
            {sessionId ? (
              <p className="rounded-md border border-zinc-700 bg-black/50 px-3 py-2 font-mono text-xl text-cyan-200">
                {sessionId}
              </p>
            ) : null}
          </div>

          <div className="mt-5 grid gap-2 md:grid-cols-2">
            {leaderboard.map((entry) => {
              const player = players[entry.playerId];
              const bets = Array.isArray(player?.bets) ? player.bets : [];
              const totalBet = bets.reduce((s, b) => s + b.amount, 0);
              return (
                <motion.div
                  key={entry.playerId}
                  layout
                  className={`flex items-center justify-between gap-3 rounded-md border px-4 py-3 ${
                    entry.eliminated
                      ? "border-rose-500/30 bg-rose-500/5 opacity-60"
                      : "border-zinc-800 bg-black/40"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      <span className="mr-2 text-zinc-500">#{entry.rank}</span>
                      {entry.name}
                      {player?.hasBet ? (
                        <span className="ml-2 inline-flex rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-emerald-300">
                          Apostado
                        </span>
                      ) : null}
                    </p>
                    {bets.length ? (
                      <p className="mt-1 text-[11px] text-zinc-500">
                        {bets.length} apuesta{bets.length > 1 ? "s" : ""} ·{" "}
                        <span className="text-zinc-300">{totalBet}</span> créditos
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] text-zinc-600">Sin apuesta</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xl text-cyan-200">{entry.credits}</p>
                    {player?.lastDelta ? (
                      <p
                        className={`text-[10px] font-bold ${
                          player.lastDelta > 0 ? "text-emerald-300" : "text-rose-300"
                        }`}
                      >
                        {player.lastDelta > 0 ? "+" : ""}
                        {player.lastDelta}
                      </p>
                    ) : null}
                  </div>
                </motion.div>
              );
            })}
            {!leaderboard.length ? (
              <p className="rounded-md border border-zinc-800 bg-black/30 p-4 text-sm text-zinc-500">
                Esperando jugadores...
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

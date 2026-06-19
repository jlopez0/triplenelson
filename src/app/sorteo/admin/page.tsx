"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listenRaffleSession } from "@/lib/raffle/rtdb";
import type { DrawResult, RaffleSession } from "@/lib/raffle/types";

const TOKEN_KEY = "tn_admin_token";

export default function RaffleAdminPage() {
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [sessionId, setSessionId] = useState("raffle-1");
  const [session, setSession] = useState<RaffleSession | null>(null);

  const [isDemo, setIsDemo] = useState(false);
  const [jcoins, setJcoins] = useState(100);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Auth: misma lógica que kahoot/admin
  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) { setToken(saved); setIsAuthed(true); }
    const params = new URLSearchParams(window.location.search);
    setIsDemo(params.get("demo") === "1");
  }, []);

  function login() {
    const t = tokenInput.trim();
    if (!t) { setLoginError("Introduce el token."); return; }
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    setIsAuthed(true);
    setLoginError("");
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(""); setTokenInput(""); setIsAuthed(false);
  }

  // Suscribir al estado de la sesión
  useEffect(() => {
    if (!isAuthed || !sessionId) return;
    return listenRaffleSession(sessionId, setSession);
  }, [isAuthed, sessionId]);

  async function loadPool() {
    setLoading(true); setMessage(""); setError("");
    try {
      const res = await fetch("/api/raffle/load-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ sessionId, jcoins, demo: isDemo }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error ?? "Error al cargar el pool.");
      setMessage(`✓ ${payload.poolSize} papeletas cargadas · ${payload.uniqueParticipants} participantes únicos`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  async function draw() {
    setLoading(true); setMessage(""); setError("");
    try {
      const res = await fetch("/api/raffle/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ sessionId }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error ?? "Error al sortear.");
      setMessage(`🎉 Ganador #${payload.winner.draw}: ${payload.winner.winnerName}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  const history: DrawResult[] = session?.history
    ? Object.values(session.history)
    : [];

  const isSpinning = session?.status === "spinning";

  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-techno flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4">
          <div className="text-center">
            <Link href="/" className="font-display text-2xl font-bold tracking-tighter">TRIPLE NELSON</Link>
            <p className="text-zinc-500 text-sm mt-1">Sorteo JCoins — Admin</p>
          </div>
          <div className="card space-y-3">
            <input
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()}
              type="password"
              placeholder="Token de admin"
              className="w-full rounded-xl border border-zinc-700 bg-black/40 px-4 py-3 text-sm outline-none focus:border-zinc-400"
            />
            {loginError && <p className="text-sm text-rose-300">{loginError}</p>}
            <button onClick={login} className="btn-primary w-full py-3">Entrar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-techno">
      <header className="border-b border-zinc-800 bg-black/60 backdrop-blur-sm sticky top-0 z-50">
        <div className="container-pro py-4 flex items-center justify-between">
          <h1 className="font-display text-lg md:text-2xl">
            Sorteo JCoins
            {isDemo && <span className="ml-3 rounded bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-300 border border-amber-500/40">DEMO</span>}
          </h1>
          <div className="flex items-center gap-2">
            <Link href="/admin" className="btn-secondary text-[11px] md:text-xs px-3 py-2">
              ← Admin
            </Link>
            <button onClick={logout} className="text-[11px] text-zinc-500 hover:text-white uppercase tracking-wider px-1">
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="container-pro py-8 space-y-6 max-w-2xl">
        {error && <p className="text-sm text-rose-300 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">{error}</p>}
        {message && <p className="text-sm text-emerald-300 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">{message}</p>}

        {/* Sesión */}
        <section className="card space-y-4">
          <h2 className="font-display text-lg">Sesión</h2>
          <div className="flex gap-2">
            <input
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="ID de sesión (ej: raffle-1)"
              className="flex-1 rounded-xl border border-zinc-700 bg-black/40 px-3 py-2 text-sm outline-none focus:border-zinc-400"
            />
            <Link
              href={`/sorteo/${sessionId}/screen`}
              target="_blank"
              className="btn-secondary text-xs px-3 py-2 whitespace-nowrap"
            >
              Abrir pantalla ↗
            </Link>
          </div>
          {session && (
            <div className="flex gap-3 text-sm text-zinc-400">
              <span className="rounded-full border border-zinc-700 px-3 py-1">
                {session.poolSize ?? 0} papeletas
              </span>
              <span className="rounded-full border border-zinc-700 px-3 py-1">
                {session.uniqueParticipants ?? 0} participantes
              </span>
              <span className={`rounded-full border px-3 py-1 ${
                isSpinning
                  ? "border-amber-500/40 text-amber-300"
                  : session.status === "result"
                  ? "border-emerald-500/40 text-emerald-300"
                  : "border-zinc-700 text-zinc-400"
              }`}>
                {session.status}
              </span>
            </div>
          )}
        </section>

        {/* Controles */}
        <section className="card space-y-3">
          <h2 className="font-display text-lg">Controles</h2>
          <div className="flex items-center gap-3">
            <label className="text-sm text-zinc-400 whitespace-nowrap">JCoins a sortear</label>
            <input
              type="number"
              min={1}
              value={jcoins}
              onChange={(e) => setJcoins(Math.max(1, Number(e.target.value)))}
              className="w-32 rounded-xl border border-zinc-700 bg-black/40 px-3 py-2 text-center text-lg font-bold text-cyan-300 outline-none focus:border-cyan-400"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadPool}
              disabled={loading}
              className="btn-secondary flex-1 py-3 disabled:opacity-50"
            >
              {loading ? "Cargando..." : "Cargar participantes"}
            </button>
            <button
              onClick={draw}
              disabled={loading || isSpinning || !session?.poolSize}
              className="btn-primary flex-1 py-3 text-lg disabled:opacity-50"
            >
              🎰 Sortear
            </button>
          </div>
          {!session?.poolSize && (
            <p className="text-xs text-zinc-500 text-center">Carga los participantes antes de sortear.</p>
          )}
        </section>

        {/* Historial */}
        {history.length > 0 && (
          <section className="card space-y-3">
            <h2 className="font-display text-lg">Historial de ganadores</h2>
            <ol className="space-y-2">
              {[...history].reverse().map((d) => (
                <li key={d.draw} className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-black/30 px-4 py-2">
                  <span className="font-mono text-sm text-zinc-500 w-6 text-right">#{d.draw}</span>
                  <span className="font-bold text-white">{d.winnerName}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </main>
    </div>
  );
}

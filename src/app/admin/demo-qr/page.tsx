"use client";

import { useEffect, useState } from "react";

interface DemoTicket {
  ticketCode: string;
  buyerName: string | null;
  used: boolean;
  qr: string;
}

export default function DemoQrPage() {
  const [tickets, setTickets] = useState<DemoTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("tn_demo_pw");
    if (saved) { setPassword(saved); setIsAuthed(true); }
    else setLoading(false);
  }, []);

  useEffect(() => {
    if (isAuthed) void load();
  }, [isAuthed]);

  function authHeader() {
    return { authorization: `Basic ${btoa(`admin:${password}`)}` };
  }

  function login() {
    const pw = passwordInput.trim();
    if (!pw) return;
    localStorage.setItem("tn_demo_pw", pw);
    setPassword(pw);
    setIsAuthed(true);
  }

  async function load() {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/admin/demo-tickets", { headers: authHeader() });
      if (res.status === 401) { setError("Contraseña incorrecta."); setIsAuthed(false); setLoading(false); return; }
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { tickets: DemoTicket[] };
      setTickets(data.tickets);
    } catch {
      setError("Error al cargar tickets.");
    } finally {
      setLoading(false);
    }
  }

  async function seed() {
    setSeeding(true); setError("");
    try {
      const res = await fetch("/api/admin/seed-demo-tickets", {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ count: 30, reset: true }),
      });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setError("Error al generar tickets.");
    } finally {
      setSeeding(false);
    }
  }

  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-techno flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4">
          <h1 className="font-display text-2xl text-center">Demo QRs</h1>
          <div className="card space-y-3">
            <input
              type="password"
              placeholder="Password admin"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()}
              className="w-full rounded-xl border border-zinc-700 bg-black/40 px-4 py-3 text-sm outline-none focus:border-zinc-400"
            />
            <button onClick={login} className="btn-primary w-full py-3">Entrar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-techno">
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-black/70 backdrop-blur-sm">
        <div className="container-pro py-3 flex items-center justify-between">
          <h1 className="font-display text-lg">
            QRs Demo
            <span className="ml-2 rounded bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-300 border border-amber-500/40">DEMO</span>
          </h1>
          <div className="flex gap-2">
            <button onClick={seed} disabled={seeding} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50">
              {seeding ? "Generando..." : "↺ Regenerar"}
            </button>
            <button onClick={load} disabled={loading} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50">
              Recargar
            </button>
          </div>
        </div>
      </header>

      <main className="container-pro py-6">
        {error && <p className="mb-4 text-sm text-rose-300 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">{error}</p>}

        {loading ? (
          <p className="text-zinc-500 text-center py-20">Cargando...</p>
        ) : tickets.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <p className="text-zinc-500">No hay tickets demo todavía.</p>
            <button onClick={seed} disabled={seeding} className="btn-primary px-6 py-3">
              {seeding ? "Generando..." : "Generar 30 tickets demo"}
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs text-zinc-500 mb-4">
              {tickets.length} tickets ·{" "}
              <span className="text-rose-400">{tickets.filter(t => t.used).length} escaneados</span> ·{" "}
              <span className="text-emerald-400">{tickets.filter(t => !t.used).length} disponibles</span>
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {tickets.map((t) => (
                <div
                  key={t.ticketCode}
                  className={`rounded-2xl border p-3 text-center space-y-2 ${
                    t.used
                      ? "border-zinc-700/40 bg-zinc-900/30 opacity-40"
                      : "border-zinc-700 bg-black/40"
                  }`}
                >
                  <img src={t.qr} alt={t.ticketCode} className="w-full rounded-lg bg-white p-1" />
                  <p className="text-[11px] font-bold text-zinc-200 truncate">{t.buyerName ?? "—"}</p>
                  <p className="font-mono text-[8px] text-zinc-600 break-all leading-tight">{t.ticketCode}</p>
                  {t.used && <p className="text-[9px] text-rose-400 uppercase tracking-wider font-bold">✓ Escaneado</p>}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

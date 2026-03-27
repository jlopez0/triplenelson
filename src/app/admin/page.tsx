"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Receiver = {
  id: string;
  label: string;
  phone: string;
  isActive: boolean;
};

type AdminIntent = {
  id: string;
  eventId: string;
  paymentRef: string;
  quantity: number;
  receiverId: string;
  receiverLabel: string;
  receiverPhone: string;
  amountCents: number;
  currency: "EUR";
  status: "CREATED" | "USER_CONFIRMED" | "PAID" | "REJECTED" | "EXPIRED";
  createdAt: string;
  confirmedAt?: string;
  paidAt?: string;
  userKey: string;
  buyerName?: string;
  ticketType?: string;
  expiresAt: string;
  knowsBilly?: boolean;
};

const COOKIE_NAME = "tn_admin_auth";
const COOKIE_DAYS = 30;

function setCookie(value: string) {
  const expires = new Date(Date.now() + COOKIE_DAYS * 864e5).toUTCString();
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Strict`;
}

function getCookie(): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function clearCookie() {
  document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

function formatDate(value: string | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatMoney(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(amountCents / 100);
}

const STATUS_LABELS: Record<AdminIntent["status"], string> = {
  CREATED: "En espera",
  USER_CONFIRMED: "Por verificar",
  PAID: "Pagado",
  REJECTED: "Rechazado",
  EXPIRED: "Expirado",
};

const STATUS_CLASSES: Record<AdminIntent["status"], string> = {
  CREATED: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  USER_CONFIRMED: "text-sky-300 border-sky-500/40 bg-sky-500/10",
  PAID: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  REJECTED: "text-rose-300 border-rose-500/40 bg-rose-500/10",
  EXPIRED: "text-zinc-400 border-zinc-600/40 bg-zinc-600/10",
};

function StatusBadge({ status }: { status: AdminIntent["status"] }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${STATUS_CLASSES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function BuyerCell({ item }: { item: AdminIntent }) {
  const isFieles = item.ticketType === "ENTRADA FIELES";
  return (
    <td className="py-3 pr-3">
      {item.buyerName ? <div className="font-medium text-white">{item.buyerName}</div> : null}
      <div className="text-xs text-zinc-500">{item.userKey}</div>
      {item.ticketType ? (
        <div className={`text-[10px] mt-0.5 font-semibold ${isFieles ? "text-yellow-400" : "text-purple-400"}`}>
          {isFieles ? "★ " : ""}{item.ticketType}
        </div>
      ) : null}
    </td>
  );
}

export default function AdminPage() {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [receivers, setReceivers] = useState<Receiver[]>([]);
  const [allIntents, setAllIntents] = useState<AdminIntent[]>([]);
  const [receiverId, setReceiverId] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [testEmailTo, setTestEmailTo] = useState("");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "all">("pending");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [showManualModal, setShowManualModal] = useState(false);
  const [manualEmail, setManualEmail] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualQuantity, setManualQuantity] = useState(1);
  const [manualAmount, setManualAmount] = useState("");
  const [manualType, setManualType] = useState("ENTRADA FIELES");
  const [manualCustomType, setManualCustomType] = useState("");
  const [savingManual, setSavingManual] = useState(false);

  function buildAuthHeader(u: string, p: string): HeadersInit {
    return { authorization: `Basic ${window.btoa(`${u}:${p}`)}` };
  }

  function currentAuthHeader(): HeadersInit {
    const stored = getCookie();
    const [u, ...rest] = stored.split(":");
    return buildAuthHeader(u, rest.join(":"));
  }

  // On mount: check cookie and auto-login
  useEffect(() => {
    const stored = getCookie();
    if (!stored) return;
    const [u, ...rest] = stored.split(":");
    if (!u || !rest.length) return;
    setUser(u);
    setPassword(rest.join(":"));
    autoLogin(u, rest.join(":"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function autoLogin(u: string, p: string) {
    setLoginLoading(true);
    try {
      const res = await fetch("/api/admin/receivers", {
        headers: buildAuthHeader(u, p),
        cache: "no-store",
      });
      if (res.ok) {
        setIsAuthenticated(true);
      } else {
        clearCookie();
      }
    } catch {
      // network error, ignore
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      const res = await fetch("/api/admin/receivers", {
        headers: buildAuthHeader(user.trim(), password),
        cache: "no-store",
      });
      if (res.ok) {
        setCookie(`${user.trim()}:${password}`);
        setIsAuthenticated(true);
      } else {
        setLoginError("Usuario o contraseña incorrectos.");
      }
    } catch {
      setLoginError("Error de conexión.");
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogout() {
    clearCookie();
    setIsAuthenticated(false);
    setUser("");
    setPassword("");
    setAllIntents([]);
    setReceivers([]);
  }

  async function loadData() {
    if (!isAuthenticated) return;
    setLoading(true);
    setError("");

    const headers = currentAuthHeader();
    const query = new URLSearchParams();
    if (receiverId) query.set("receiverId", receiverId);
    if (paymentRef) query.set("paymentRef", paymentRef);
    if (from) query.set("from", new Date(from).toISOString());
    if (to) query.set("to", new Date(`${to}T23:59:59`).toISOString());

    try {
      const [receiversRes, intentsRes] = await Promise.all([
        fetch("/api/admin/receivers", { headers, cache: "no-store" }),
        fetch(`/api/admin/intents?${query.toString()}`, { headers, cache: "no-store" }),
      ]);

      if (receiversRes.status === 401 || intentsRes.status === 401) {
        clearCookie();
        setIsAuthenticated(false);
        return;
      }

      const receiversPayload = await receiversRes.json();
      const intentsPayload = await intentsRes.json();

      if (!receiversRes.ok) throw new Error(receiversPayload?.message ?? "Error cargando receptores.");
      if (!intentsRes.ok) throw new Error(intentsPayload?.message ?? "Error cargando intents.");

      setReceivers(receiversPayload.items as Receiver[]);
      setAllIntents(intentsPayload.items as AdminIntent[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando datos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, receiverId, paymentRef, from, to]);

  async function markPaid(intentId: string) {
    setError(""); setMessage("");
    try {
      const res = await fetch("/api/mark_paid", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...currentAuthHeader() },
        body: JSON.stringify({ intentId }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.message ?? "No se pudo marcar pagado.");
      const sent = payload?.emailDelivery?.sent ?? 0;
      setMessage(sent > 0 ? `✓ Pagado. Entradas enviadas por email (${sent}).` : "✓ Pagado. Email pendiente.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo marcar pagado.");
    }
  }

  async function rejectIntent(intentId: string) {
    setError(""); setMessage("");
    const reason = window.prompt("Motivo del rechazo (opcional):", "") ?? "";
    try {
      const res = await fetch("/api/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...currentAuthHeader() },
        body: JSON.stringify({ intentId, reason }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.message ?? "No se pudo rechazar.");
      setMessage("Intent rechazado.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo rechazar.");
    }
  }

  async function deleteIntentById(intentId: string, isPaid: boolean) {
    setError(""); setMessage("");
    if (!window.confirm(isPaid
      ? "⚠️ Este pago ya está PAGADO y se han enviado entradas. ¿Seguro que quieres borrarlo? Esta acción no se puede deshacer."
      : "¿Borrar este intent? Esta acción no se puede deshacer."
    )) return;
    if (isPaid && !window.confirm("Confirma de nuevo: vas a borrar un pago ya procesado.")) return;
    try {
      const res = await fetch(`/api/admin/intents/${intentId}`, {
        method: "DELETE",
        headers: { ...currentAuthHeader() },
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.message ?? "No se pudo borrar.");
      setMessage("Intent borrado.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar.");
    }
  }

  async function createManualPayment() {
    setError(""); setMessage("");
    setSavingManual(true);
    try {
      const amountCents = Math.round(parseFloat(manualAmount.replace(",", ".")) * 100);
      if (isNaN(amountCents) || amountCents < 0) throw new Error("Importe inválido.");
      const ticketType = manualType === "__custom__" ? manualCustomType.trim() : manualType;
      if (!ticketType) throw new Error("Indica el tipo de entrada.");
      const res = await fetch("/api/admin/intents", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...currentAuthHeader() },
        body: JSON.stringify({
          userKey: manualEmail.trim().toLowerCase(),
          buyerName: manualName.trim() || undefined,
          quantity: manualQuantity,
          amountCents,
          ticketType,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.message ?? "Error al crear pago.");
      const sent = payload?.emailDelivery?.sent ?? 0;
      setMessage(`✓ Pago manual creado. ${sent > 0 ? `Email enviado (${sent} entrada${sent !== 1 ? "s" : ""}).` : "Email pendiente."}`);
      setShowManualModal(false);
      setManualEmail(""); setManualName(""); setManualQuantity(1); setManualAmount(""); setManualType("ENTRADA FIELES"); setManualCustomType("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear pago.");
    } finally {
      setSavingManual(false);
    }
  }

  async function sendTestEmail() {
    setError(""); setMessage("");
    setSendingTestEmail(true);
    try {
      const res = await fetch("/api/admin/test_email", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...currentAuthHeader() },
        body: JSON.stringify({ to: testEmailTo.trim() }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.message ?? "No se pudo enviar.");
      setMessage(`Email de test enviado a ${payload.to}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error enviando test.");
    } finally {
      setSendingTestEmail(false);
    }
  }

  // Derived state
  const pending = useMemo(() => allIntents.filter((i) => i.status === "USER_CONFIRMED" || i.status === "CREATED"), [allIntents]);
  const paid = useMemo(() => allIntents.filter((i) => i.status === "PAID"), [allIntents]);
  const created = useMemo(() => allIntents.filter((i) => i.status === "CREATED"), [allIntents]);
  const rejected = useMemo(() => allIntents.filter((i) => i.status === "REJECTED"), [allIntents]);
  const expired = useMemo(() => allIntents.filter((i) => i.status === "EXPIRED"), [allIntents]);

  const totalTicketsSold = useMemo(() => paid.reduce((s, i) => s + i.quantity, 0), [paid]);
  const totalRevenue = useMemo(() => paid.reduce((s, i) => s + i.amountCents, 0), [paid]);
  const pendingRevenue = useMemo(() => pending.reduce((s, i) => s + i.amountCents, 0), [pending]);
  const fielesTickets = useMemo(() => paid.filter((i) => i.ticketType === "ENTRADA FIELES").reduce((s, i) => s + i.quantity, 0), [paid]);

  const byReceiver = useMemo(
    () =>
      paid.reduce<Record<string, { label: string; phone: string; tickets: number; revenue: number }>>(
        (acc, i) => {
          if (!acc[i.receiverId]) acc[i.receiverId] = { label: i.receiverLabel, phone: i.receiverPhone, tickets: 0, revenue: 0 };
          acc[i.receiverId].tickets += i.quantity;
          acc[i.receiverId].revenue += i.amountCents;
          return acc;
        },
        {},
      ),
    [paid],
  );

  // ─── Login screen ───────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-techno flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <Link href="/" className="font-display text-2xl font-bold tracking-tighter">TRIPLE NELSON</Link>
            <p className="text-zinc-500 text-sm mt-1">Panel de administración</p>
          </div>
          <form onSubmit={handleLogin} className="card space-y-4">
            <h2 className="font-display text-xl">Acceder</h2>
            <div className="space-y-3">
              <input
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="Usuario"
                autoComplete="username"
                required
                className="w-full rounded-xl border border-zinc-700 bg-black/40 px-4 py-3 text-sm outline-none focus:border-zinc-400"
              />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="Contraseña"
                autoComplete="current-password"
                required
                className="w-full rounded-xl border border-zinc-700 bg-black/40 px-4 py-3 text-sm outline-none focus:border-zinc-400"
              />
            </div>
            {loginError ? <p className="text-sm text-rose-300">{loginError}</p> : null}
            <button
              type="submit"
              disabled={loginLoading || !user.trim() || !password}
              className="btn-primary w-full py-3 disabled:opacity-60"
            >
              {loginLoading ? "Comprobando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ─── Admin panel ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-techno">
      <header className="border-b border-zinc-800 bg-black/60 backdrop-blur-sm sticky top-0 z-50">
        <div className="container-pro py-4 flex items-center justify-between">
          <h1 className="font-display text-lg md:text-2xl leading-tight">
            Panel Admin
            {loading && <span className="ml-2 text-xs text-zinc-500 font-sans">Cargando...</span>}
          </h1>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setShowManualModal(true)} className="btn-primary text-[11px] md:text-xs px-3 py-2">
              + Pago
            </button>
            <button type="button" onClick={loadData} disabled={loading} className="btn-secondary text-[11px] md:text-xs px-3 py-2 disabled:opacity-40">
              ↺
            </button>
            <button type="button" onClick={handleLogout} className="text-[11px] md:text-xs text-zinc-500 hover:text-white transition-colors uppercase tracking-wider px-1">
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="container-pro py-6 space-y-5">
        {error ? <p className="text-sm text-rose-300 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-300 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">{message}</p> : null}

        {/* KPIs */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 md:p-4">
            <div className="text-[9px] md:text-[10px] uppercase tracking-widest text-emerald-400 mb-1">Vendidas</div>
            <div className="font-display text-3xl md:text-4xl text-emerald-300">{totalTicketsSold}</div>
            <div className="text-[10px] md:text-xs text-zinc-500 mt-1">{paid.length} pedido{paid.length !== 1 ? "s" : ""}</div>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 md:p-4">
            <div className="text-[9px] md:text-[10px] uppercase tracking-widest text-emerald-500 mb-1">Ingresos</div>
            <div className="font-display text-xl md:text-2xl text-emerald-400 leading-tight">{formatMoney(totalRevenue, "EUR")}</div>
            <div className="text-[10px] md:text-xs text-zinc-500 mt-1">confirmados</div>
          </div>
          <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-3 md:p-4">
            <div className="text-[9px] md:text-[10px] uppercase tracking-widest text-sky-400 mb-1">Por verificar</div>
            <div className="font-display text-3xl md:text-4xl text-sky-300">{pending.length}</div>
            <div className="text-[10px] md:text-xs text-zinc-500 mt-1">{pending.reduce((s, i) => s + i.quantity, 0)} ent.</div>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 md:p-4">
            <div className="text-[9px] md:text-[10px] uppercase tracking-widest text-amber-400 mb-1">En espera</div>
            <div className="font-display text-3xl md:text-4xl text-amber-300">{created.length}</div>
            <div className="text-[10px] md:text-xs text-zinc-500 mt-1">{rejected.length} rech. · {expired.length} exp.</div>
          </div>
          <div className="col-span-2 sm:col-span-1 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-3 md:p-4">
            <div className="text-[9px] md:text-[10px] uppercase tracking-widest text-yellow-400 mb-1">★ Fieles</div>
            <div className="font-display text-3xl md:text-4xl text-yellow-300">{fielesTickets}</div>
            <div className="text-[10px] md:text-xs text-zinc-500 mt-1">entradas fieles</div>
          </div>
        </section>

        {/* Por receptor */}
        {Object.keys(byReceiver).length > 0 && (
          <section className="card space-y-3">
            <h2 className="font-display text-lg">Ingresos por receptor</h2>
            <div className="flex flex-wrap gap-2">
              {Object.values(byReceiver).map((r) => (
                <div key={r.phone} className="rounded-xl border border-zinc-700 bg-black/30 px-4 py-2 text-sm">
                  <span className="text-zinc-400">{r.label} · {r.phone}</span>
                  <span className="ml-3 font-bold text-white">{r.tickets} ent.</span>
                  <span className="ml-2 text-emerald-400">{formatMoney(r.revenue, "EUR")}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Filtros */}
        <section className="card space-y-3">
          <h2 className="font-display text-lg">Filtros</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <select value={receiverId} onChange={(e) => setReceiverId(e.target.value)} className="rounded-xl border border-zinc-700 bg-black/40 px-3 py-2 text-sm col-span-2 md:col-span-1">
              <option value="">Todos los receptores</option>
              {receivers.map((r) => (
                <option key={r.id} value={r.id}>{r.label} ({r.phone})</option>
              ))}
            </select>
            <input value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} placeholder="Código (TN...)" className="rounded-xl border border-zinc-700 bg-black/40 px-3 py-2 text-sm" />
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border border-zinc-700 bg-black/40 px-3 py-2 text-sm" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl border border-zinc-700 bg-black/40 px-3 py-2 text-sm" />
            <button type="button" className="btn-secondary text-xs py-2" onClick={loadData}>Refrescar</button>
          </div>
        </section>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className={`px-4 py-2 text-sm transition-colors ${activeTab === "pending" ? "text-white border-b-2 border-white -mb-px" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            Por verificar{" "}
            <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${pending.length > 0 ? "bg-amber-500/20 text-amber-300" : "bg-zinc-800 text-zinc-500"}`}>{pending.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 text-sm transition-colors ${activeTab === "all" ? "text-white border-b-2 border-white -mb-px" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            Todos{" "}
            <span className="ml-1 rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">{allIntents.length}</span>
          </button>
        </div>

        {/* Tab: Por verificar */}
        {activeTab === "pending" && (
          <section className="card">
            {pending.length === 0 ? (
              <p className="text-sm text-zinc-500 py-4 text-center">No hay pagos pendientes de verificar.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-zinc-500 border-b border-zinc-800 text-xs uppercase tracking-wider">
                      <th className="text-left py-2 pr-3">Código</th>
                      <th className="text-left py-2 pr-3">Comprador</th>
                      <th className="text-left py-2 pr-3">Ent.</th>
                      <th className="text-left py-2 pr-3">Importe</th>
                      <th className="text-left py-2 pr-3">Receptor</th>
                      <th className="text-left py-2 pr-3">Billy</th>
                      <th className="text-left py-2 pr-3">Confirmó</th>
                      <th className="text-left py-2 pr-3">Expira</th>
                      <th className="text-left py-2 pr-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((item) => (
                      <tr key={item.id} className="border-b border-zinc-900 hover:bg-zinc-900/30">
                        <td className="py-3 pr-3 font-mono text-sky-300 font-bold">
                          {item.paymentRef}
                          {item.status === "CREATED" && <div className="text-[10px] text-amber-400 mt-0.5">Sin confirmar</div>}
                        </td>
                        <BuyerCell item={item} />
                        <td className="py-3 pr-3 font-bold">{item.quantity}</td>
                        <td className="py-3 pr-3 text-emerald-300">{formatMoney(item.amountCents, item.currency)}</td>
                        <td className="py-3 pr-3">
                          <div>{item.receiverLabel}</div>
                          <div className="text-xs text-zinc-500">{item.receiverPhone}</div>
                        </td>
                        <td className="py-3 pr-3 text-xs">{item.knowsBilly === undefined ? "—" : item.knowsBilly ? "Sí" : "No"}</td>
                        <td className="py-3 pr-3 text-xs text-zinc-400">{item.status === "CREATED" ? "—" : formatDate(item.confirmedAt)}</td>
                        <td className="py-3 pr-3 text-xs text-zinc-500">{formatDate(item.expiresAt)}</td>
                        <td className="py-3 pr-3">
                          <div className="flex gap-2">
                            <button type="button" onClick={() => markPaid(item.id)} disabled={loading} className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-40">
                              ✓ Pagar
                            </button>
                            <button type="button" onClick={() => rejectIntent(item.id)} disabled={loading} className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/20 disabled:opacity-40">
                              ✗ Rechazar
                            </button>
                            <button type="button" onClick={() => deleteIntentById(item.id, false)} disabled={loading} className="rounded-lg border border-zinc-600/40 bg-zinc-700/20 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-700/40 disabled:opacity-40">
                              🗑
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Tab: Todos */}
        {activeTab === "all" && (
          <section className="card">
            {allIntents.length === 0 ? (
              <p className="text-sm text-zinc-500 py-4 text-center">No hay datos para los filtros actuales.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-zinc-500 border-b border-zinc-800 text-xs uppercase tracking-wider">
                      <th className="text-left py-2 pr-3">Estado</th>
                      <th className="text-left py-2 pr-3">Código</th>
                      <th className="text-left py-2 pr-3">Comprador</th>
                      <th className="text-left py-2 pr-3">Ent.</th>
                      <th className="text-left py-2 pr-3">Importe</th>
                      <th className="text-left py-2 pr-3">Receptor</th>
                      <th className="text-left py-2 pr-3">Billy</th>
                      <th className="text-left py-2 pr-3">Creado</th>
                      <th className="text-left py-2 pr-3">Confirmó</th>
                      <th className="text-left py-2 pr-3">Pagado</th>
                      <th className="text-left py-2 pr-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allIntents.map((item) => (
                      <tr key={item.id} className="border-b border-zinc-900 hover:bg-zinc-900/30">
                        <td className="py-3 pr-3"><StatusBadge status={item.status} /></td>
                        <td className="py-3 pr-3 font-mono font-bold text-zinc-200">{item.paymentRef}</td>
                        <BuyerCell item={item} />
                        <td className="py-3 pr-3 font-bold">{item.quantity}</td>
                        <td className="py-3 pr-3">{formatMoney(item.amountCents, item.currency)}</td>
                        <td className="py-3 pr-3">
                          <div>{item.receiverLabel}</div>
                          <div className="text-xs text-zinc-500">{item.receiverPhone}</div>
                        </td>
                        <td className="py-3 pr-3 text-xs">{item.knowsBilly === undefined ? "—" : item.knowsBilly ? "Sí" : "No"}</td>
                        <td className="py-3 pr-3 text-xs text-zinc-400">{formatDate(item.createdAt)}</td>
                        <td className="py-3 pr-3 text-xs text-zinc-400">{formatDate(item.confirmedAt)}</td>
                        <td className="py-3 pr-3 text-xs text-zinc-400">{formatDate(item.paidAt)}</td>
                        <td className="py-3 pr-3">
                          <div className="flex gap-2">
                            {(item.status === "USER_CONFIRMED" || item.status === "CREATED") && (
                              <>
                                <button type="button" onClick={() => markPaid(item.id)} disabled={loading} className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-40">✓</button>
                                <button type="button" onClick={() => rejectIntent(item.id)} disabled={loading} className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs text-rose-200 hover:bg-rose-500/20 disabled:opacity-40">✗</button>
                              </>
                            )}
                            <button type="button" onClick={() => deleteIntentById(item.id, item.status === "PAID")} disabled={loading} className="rounded-lg border border-zinc-600/40 bg-zinc-700/20 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-700/40 disabled:opacity-40">🗑</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Test email */}
        <section className="card space-y-3">
          <h2 className="font-display text-lg">Test Email</h2>
          <div className="flex gap-2">
            <input value={testEmailTo} onChange={(e) => setTestEmailTo(e.target.value)} placeholder="destino@correo.com" type="email" className="flex-1 rounded-xl border border-zinc-700 bg-black/40 px-3 py-2 text-sm outline-none focus:border-zinc-400" />
            <button type="button" onClick={sendTestEmail} disabled={sendingTestEmail || !testEmailTo.trim()} className="btn-secondary text-xs py-2 disabled:opacity-60">
              {sendingTestEmail ? "Enviando..." : "Enviar test"}
            </button>
          </div>
        </section>

      </main>

      {/* Modal: pago manual */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-950 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl">Pago manual</h2>
              <button type="button" onClick={() => setShowManualModal(false)} className="text-zinc-500 hover:text-white text-lg">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs uppercase tracking-widest text-zinc-500 mb-1 block">Email comprador *</label>
                <input
                  type="email"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  className="w-full rounded-xl border border-zinc-700 bg-black/40 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-zinc-500 mb-1 block">Nombre comprador</label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Nombre y apellido"
                  className="w-full rounded-xl border border-zinc-700 bg-black/40 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase tracking-widest text-zinc-500 mb-1 block">Entradas *</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={manualQuantity}
                    onChange={(e) => setManualQuantity(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                    className="w-full rounded-xl border border-zinc-700 bg-black/40 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-zinc-500 mb-1 block">Importe (€) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-zinc-700 bg-black/40 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-zinc-500 mb-1 block">Tipo de entrada *</label>
                <select
                  value={manualType}
                  onChange={(e) => setManualType(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-black/40 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                >
                  <option value="ENTRADA FIELES">ENTRADA FIELES</option>
                  <option value="ENTRADA NORMAL">ENTRADA NORMAL</option>
                  <option value="INVITACIÓN">INVITACIÓN</option>
                  <option value="__custom__">Otro (personalizado)</option>
                </select>
              </div>

              {manualType === "__custom__" && (
                <div>
                  <label className="text-xs uppercase tracking-widest text-zinc-500 mb-1 block">Tipo personalizado</label>
                  <input
                    type="text"
                    value={manualCustomType}
                    onChange={(e) => setManualCustomType(e.target.value)}
                    placeholder="Ej: PRESS, STAFF..."
                    className="w-full rounded-xl border border-zinc-700 bg-black/40 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                  />
                </div>
              )}
            </div>

            <p className="text-xs text-zinc-500">Se generarán las entradas y se enviará el email al comprador automáticamente.</p>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={createManualPayment}
                disabled={savingManual || !manualEmail.trim() || !manualAmount.trim()}
                className="btn-primary flex-1 text-sm py-3 disabled:opacity-50"
              >
                {savingManual ? "Creando..." : "Crear y enviar entradas"}
              </button>
              <button type="button" onClick={() => setShowManualModal(false)} className="btn-secondary text-sm py-3 px-5">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

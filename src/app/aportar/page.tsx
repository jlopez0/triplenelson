"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type IntentStatus = "CREATED" | "USER_CONFIRMED" | "PAID" | "REJECTED" | "EXPIRED";

type EventInfo = {
  id: string;
  name: string;
  fixedPriceCents: number;
  currency: "EUR";
};

type PublicIntent = {
  id: string;
  eventId: string;
  paymentRef: string;
  quantity: number;
  receiverPhone: string;
  amountCents: number;
  currency: "EUR";
  status: IntentStatus;
  expiresAt: string;
  confirmedAt?: string;
  paidAt?: string;
  ticketCodes?: string[];
};

type CreateIntentResponse = {
  reused: boolean;
  intentId: string;
  paymentRef: string;
  quantity: number;
  phone: string;
  receiverLabel?: string;
  amountCents: number;
  currency: "EUR";
  expiresAt: string;
  status: IntentStatus;
  eventId: string;
  eventName: string;
  contactEmail?: string;
};

const FINAL_STATUSES: IntentStatus[] = ["PAID", "REJECTED", "EXPIRED"];

function formatMoney(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountCents / 100);
}

function statusLabel(status: IntentStatus): string {
  if (status === "CREATED") return "Pendiente";
  if (status === "USER_CONFIRMED") return "Pendiente de confirmación";
  if (status === "PAID") return "Pagada";
  if (status === "REJECTED") return "Rechazada";
  return "Expirada";
}

function statusClass(status: IntentStatus): string {
  if (status === "CREATED") return "text-amber-300 border-amber-500/40 bg-amber-500/10";
  if (status === "USER_CONFIRMED") return "text-sky-300 border-sky-500/40 bg-sky-500/10";
  if (status === "PAID") return "text-emerald-300 border-emerald-500/40 bg-emerald-500/10";
  if (status === "REJECTED") return "text-rose-300 border-rose-500/40 bg-rose-500/10";
  return "text-zinc-300 border-zinc-500/40 bg-zinc-500/10";
}

async function safeCopy(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export default function AportarPage() {
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null);
  const [eventError, setEventError] = useState<string>("");

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [knowsBilly, setKnowsBilly] = useState<boolean | null>(null);
  const [intentData, setIntentData] = useState<CreateIntentResponse | null>(null);
  const [intent, setIntent] = useState<PublicIntent | null>(null);

  const [loadingIntent, setLoadingIntent] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const status = intent?.status ?? intentData?.status ?? null;
  const normalizedEmail = email.trim().toLowerCase();
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);

  useEffect(() => {
    let cancelled = false;

    async function loadEvent() {
      try {
        const response = await fetch("/api/events/default", { cache: "no-store" });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.message ?? "No se pudo cargar el evento.");
        }

        if (!cancelled) {
          setEventInfo(payload.event as EventInfo);
        }
      } catch (err) {
        if (!cancelled) {
          setEventError(err instanceof Error ? err.message : "No se pudo cargar el evento.");
        }
      }
    }

    loadEvent();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!intentData || !email.trim()) {
      return;
    }

    const shouldPoll = !status || !FINAL_STATUSES.includes(status);
    if (!shouldPoll) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch(
          `/api/intents/${intentData.intentId}?userKey=${encodeURIComponent(email.trim().toLowerCase())}`,
          { cache: "no-store" },
        );
        const payload = await response.json();
        if (!response.ok || cancelled) {
          return;
        }
        setIntent(payload.intent as PublicIntent);
      } catch {
        // Ignore polling errors to keep UX resilient.
      }
    };

    poll();
    const interval = window.setInterval(poll, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [intentData, email, status]);

  const expiresAtLabel = useMemo(() => {
    const expires = intent?.expiresAt ?? intentData?.expiresAt;
    if (!expires) return "";
    return new Date(expires).toLocaleString("es-ES");
  }, [intent?.expiresAt, intentData?.expiresAt]);

  const amountLabel = useMemo(() => {
    if (intentData) {
      return formatMoney(intentData.amountCents, intentData.currency);
    }
    if (eventInfo) {
      return formatMoney(eventInfo.fixedPriceCents * quantity, eventInfo.currency);
    }
    return "";
  }, [eventInfo, intentData, quantity]);

  async function handleCreateIntent() {
    setError("");
    setMessage("");
    setIntent(null);
    setIntentData(null);

    const normalizedUserKey = normalizedEmail;
    if (!normalizedUserKey) {
      setError("Introduce tu email.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedUserKey)) {
      setError("Email no valido.");
      return;
    }

    if (!name.trim()) {
      setError("Introduce tu nombre.");
      return;
    }

    if (knowsBilly === null) {
      setError("Indica si conoces a Billy.");
      return;
    }

    setLoadingIntent(true);
    try {
      const response = await fetch("/api/create_intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: eventInfo?.id,
          userKey: normalizedUserKey,
          buyerName: name.trim(),
          quantity,
          knowsBilly,
          ticketType: "ENTRADA NORMAL",
        }),
      });

      const payload = (await response.json()) as CreateIntentResponse & { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "No se pudo crear el intento.");
      }

      setIntentData(payload);
      setMessage(payload.reused ? "Intent existente reutilizado para este email y cantidad." : "Intent creado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el intento.");
    } finally {
      setLoadingIntent(false);
    }
  }

  async function handleConfirmSent() {
    if (!intentData) return;

    setConfirming(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/confirm_sent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intentId: intentData.intentId,
          userKey: email.trim().toLowerCase(),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message ?? "No se pudo confirmar el envio.");
      }

      setIntent(payload.intent as PublicIntent);
      setMessage("Aviso recibido. Estado cambiado a Confirmada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo confirmar el envio.");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="min-h-screen bg-techno">
      <header className="border-b border-zinc-800 bg-black/40 backdrop-blur-sm sticky top-0 z-50">
        <div className="container-pro py-4 md:py-5">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl md:text-2xl font-display font-bold tracking-tighter hover:text-zinc-300 transition-colors">
              TRIPLE NELSON
            </Link>
            <Link href="/" className="text-xs md:text-sm text-zinc-500 hover:text-white transition-colors uppercase tracking-wider">
              Volver
            </Link>
          </div>
        </div>
      </header>

      <main className="container-pro py-8 md:py-12 lg:py-16 space-y-8 md:space-y-10">
        <section className="card">
          <div className="space-y-3">
            <h1 className="font-display font-bold text-3xl md:text-5xl tracking-tight">Entraditas para la Triple Nelson</h1>
            <p className="text-zinc-400 text-sm md:text-base">
              Evento privado con precio fijo. Te daremos el numero de Bizum y un codigo para el asunto.
            </p>
            {eventError ? <p className="text-rose-300 text-sm">{eventError}</p> : null}
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            <div className="lg:col-span-2 space-y-3">
              <label className="block text-xs uppercase tracking-widest text-zinc-500">Nombre</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Tu nombre y apellido"
                type="text"
                required
                className="w-full rounded-xl border border-zinc-700 bg-black/40 px-4 py-3 text-sm md:text-base outline-none focus:border-zinc-400"
              />
              <label className="block text-xs uppercase tracking-widest text-zinc-500">Email</label>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tu.email@dominio.com"
                type="email"
                required
                pattern="^[^\s@]+@[^\s@]+\.[^\s@]+$"
                className="w-full rounded-xl border border-zinc-700 bg-black/40 px-4 py-3 text-sm md:text-base outline-none focus:border-zinc-400"
              />
              <label className="block text-xs uppercase tracking-widest text-zinc-500">Numero de entradas</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="rounded-xl border border-zinc-700 bg-black/40 px-5 py-3 text-lg font-bold text-zinc-300 hover:border-zinc-500 disabled:opacity-30"
                >
                  −
                </button>
                <span className="flex-1 rounded-xl border border-zinc-700 bg-black/40 px-4 py-3 text-center text-lg font-mono">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                  disabled={quantity >= 10}
                  className="rounded-xl border border-zinc-700 bg-black/40 px-5 py-3 text-lg font-bold text-zinc-300 hover:border-zinc-500 disabled:opacity-30"
                >
                  +
                </button>
              </div>
              {email.length > 0 && !isEmailValid ? (
                <p className="text-xs text-rose-300">Introduce un email valido para recibir tu QR.</p>
              ) : null}
              <label className="block text-xs uppercase tracking-widest text-zinc-500">¿Conoces a Billy?</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setKnowsBilly(true)}
                  className={`flex-1 rounded-xl border px-4 py-3 text-sm transition-colors ${
                    knowsBilly === true
                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                      : "border-zinc-700 bg-black/40 text-zinc-300 hover:border-zinc-500"
                  }`}
                >
                  Sí
                </button>
                <button
                  type="button"
                  onClick={() => setKnowsBilly(false)}
                  className={`flex-1 rounded-xl border px-4 py-3 text-sm transition-colors ${
                    knowsBilly === false
                      ? "border-rose-500 bg-rose-500/20 text-rose-200"
                      : "border-zinc-700 bg-black/40 text-zinc-300 hover:border-zinc-500"
                  }`}
                >
                  No
                </button>
              </div>
              <button
                type="button"
                onClick={handleCreateIntent}
                disabled={loadingIntent || !name.trim() || !isEmailValid || knowsBilly === null}
                className="btn-primary text-xs md:text-sm py-3 md:py-4 disabled:opacity-60"
              >
                {loadingIntent ? "Generando..." : "Generar instrucciones Bizum"}
              </button>
            </div>

            <div className="rounded-2xl border border-zinc-800/80 bg-black/30 p-4 space-y-2">
              <div className="text-xs uppercase tracking-widest text-zinc-500">Total Bizum</div>
              <div className="font-display text-3xl md:text-4xl">{amountLabel || "--"}</div>
              <div className="text-xs text-zinc-500">
                {eventInfo?.name ?? "Evento"} · {intentData?.quantity ?? quantity} entrada(s)
              </div>
            </div>
          </div>

          {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
          {message ? <p className="mt-4 text-sm text-emerald-300">{message}</p> : null}
        </section>

        {intentData ? (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <div className="card space-y-4">
              <h2 className="font-display text-2xl md:text-3xl">Datos de envio</h2>

              <div className="space-y-2">
                <div className="text-xs uppercase tracking-widest text-zinc-500">Telefono receptor</div>
                {intentData.receiverLabel ? (
                  <p className="text-xs text-zinc-400">Envia a <span className="font-semibold text-zinc-200">{intentData.receiverLabel}</span></p>
                ) : null}
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-xl border border-zinc-700 bg-black/30 px-4 py-3 font-mono text-lg">
                    {intentData.phone}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const copied = await safeCopy(intentData.phone);
                      setMessage(copied ? "Telefono copiado." : "No se pudo copiar.");
                    }}
                    className="btn-secondary text-[10px] md:text-xs px-4 py-3"
                  >
                    Copiar
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs uppercase tracking-widest text-zinc-500">Importe</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-xl border border-zinc-700 bg-black/30 px-4 py-3 font-mono text-lg">
                    {formatMoney(intentData.amountCents, intentData.currency)}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const copied = await safeCopy((intentData.amountCents / 100).toFixed(2));
                      setMessage(copied ? "Importe copiado." : "No se pudo copiar.");
                    }}
                    className="btn-secondary text-[10px] md:text-xs px-4 py-3"
                  >
                    Copiar
                  </button>
                </div>
                <p className="text-xs text-zinc-500">
                  {intentData.quantity} entrada(s) · {formatMoney(intentData.amountCents, intentData.currency)} total
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-xs uppercase tracking-widest text-zinc-500">Codigo para asunto/concepto</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-xl border border-zinc-700 bg-black/30 px-4 py-3 font-mono text-lg">
                    {intentData.paymentRef}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const copied = await safeCopy(intentData.paymentRef);
                      setMessage(copied ? "Codigo copiado." : "No se pudo copiar.");
                    }}
                    className="btn-secondary text-[10px] md:text-xs px-4 py-3"
                  >
                    Copiar
                  </button>
                </div>
                <p className="text-xs text-zinc-500">
                  Pon exactamente este codigo en el asunto/concepto del Bizum para poder rastrear tu pago.
                </p>
              </div>

              <p className="mt-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-200">
                Cuando el admin confirme el pago, recibirás {intentData.quantity === 1 ? "tu entrada" : `tus ${intentData.quantity} entradas`} en un único email en <span className="font-mono font-semibold">{normalizedEmail}</span>.
              </p>

              <button
                type="button"
                onClick={handleConfirmSent}
                disabled={confirming || FINAL_STATUSES.includes((intent?.status ?? intentData.status) as IntentStatus)}
                className="btn-primary text-xs md:text-sm py-3 md:py-4 disabled:opacity-60"
              >
                {confirming ? "Enviando..." : "Ya he enviado el Bizum"}
              </button>

              {status === "USER_CONFIRMED" ? (
                <div className="rounded-2xl border-2 border-amber-400/60 bg-amber-500/10 px-5 py-5 space-y-3">
                  <p className="font-display font-bold text-xl md:text-2xl text-amber-300 uppercase tracking-tight">
                    ⚠ Revisa la carpeta de SPAM
                  </p>
                  <p className="text-sm text-amber-200/80 leading-relaxed">
                    Cuando el administrador confirme tu pago, recibirás tus entradas por email. Es posible que el mensaje acabe en la carpeta de <strong>correo no deseado o spam</strong> — revísala antes de contactar.
                  </p>
                  <p className="text-xs text-zinc-400">
                    Enviando a <span className="font-mono">{normalizedEmail}</span>
                  </p>
                </div>
              ) : null}
            </div>

            <div className="card space-y-4">
              <h2 className="font-display text-2xl md:text-3xl">Estado del intento</h2>

              {status ? (
                <div className={`inline-flex rounded-full border px-4 py-2 text-xs uppercase tracking-widest ${statusClass(status)}`}>
                  {statusLabel(status)}
                </div>
              ) : null}

              <div className="space-y-2 text-sm text-zinc-400">
                <p>
                  <span className="text-zinc-500">Intent ID:</span> {intentData.intentId}
                </p>
                <p>
                  <span className="text-zinc-500">Codigo de seguimiento:</span> {intentData.paymentRef}
                </p>
                <p>
                  <span className="text-zinc-500">Entradas:</span> {intentData.quantity}
                </p>
                <p>
                  <span className="text-zinc-500">Expira:</span> {expiresAtLabel}
                </p>
                <p>
                  <span className="text-zinc-500">Transicion esperada:</span> Pendiente -&gt; Confirmada -&gt; Pagada
                </p>
              </div>

              {intent?.ticketCodes && intent.ticketCodes.length > 0 ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                  Tickets generados: <span className="font-mono">{intent.ticketCodes.join(", ")}</span>
                </div>
              ) : null}

              {status === "EXPIRED" ? (
                <button type="button" className="btn-secondary text-xs" onClick={handleCreateIntent}>
                  Crear nuevo intento
                </button>
              ) : null}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

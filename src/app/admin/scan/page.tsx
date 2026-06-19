"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import jsQR from "jsqr";
import {
  enqueueScan,
  getBootstrapInfo,
  isCodeKnown,
  isCodeUsedLocally,
  markUsedLocally,
  readQueue,
  removeFromQueue,
  saveBootstrap,
} from "@/lib/tickets/offline-store";
import type { TicketDoc, ValidationResult } from "@/lib/tickets/types";

const TOKEN_KEY = "tn_validator_token";
const VALIDATOR_NAME_KEY = "tn_validator_name";
const COOLDOWN_MS = 1500; // mismo código no se re-envía durante 1.5s
const SCAN_INTERVAL_MS = 100; // 10 fps de decodificación

type ScanStatus = "OK" | "DUPLICATE" | "NOT_FOUND" | "QUEUED";

interface ScanEntry {
  id: string;
  status: ScanStatus;
  ticketCode: string;
  ticket?: Partial<TicketDoc> | null;
  scannedAt: string;
  fromOffline?: boolean;
  message?: string;
}

function extractTicketCode(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{")) {
    try {
      const obj = JSON.parse(trimmed) as { ticketCode?: unknown };
      if (typeof obj.ticketCode === "string") return obj.ticketCode.trim().toUpperCase();
    } catch {
      // continúa
    }
  }
  const match = trimmed.toUpperCase().match(/TN-[A-F0-9]{10}/);
  return match ? match[0] : null;
}

function playFeedback(status: ScanStatus): void {
  // Sonidos vía Web Audio API (sin archivos, funciona offline).
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const beep = (freq: number, durationMs: number, when = 0) => {
      osc.frequency.setValueAtTime(freq, ctx.currentTime + when);
      gain.gain.setValueAtTime(0.001, ctx.currentTime + when);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + when + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + durationMs / 1000);
    };

    osc.start();
    if (status === "OK") {
      beep(1200, 120);
      osc.stop(ctx.currentTime + 0.15);
    } else if (status === "DUPLICATE" || status === "QUEUED") {
      beep(700, 100);
      beep(700, 100, 0.15);
      osc.stop(ctx.currentTime + 0.3);
    } else {
      beep(220, 350);
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch {
    // Ignoramos: algunos browsers requieren interacción previa para activar audio.
  }

  if ("vibrate" in navigator) {
    if (status === "OK") navigator.vibrate(50);
    else if (status === "DUPLICATE" || status === "QUEUED") navigator.vibrate([60, 50, 60]);
    else navigator.vibrate(220);
  }
}

export default function ScannerPage() {
  const [isDemo, setIsDemo] = useState(false);
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [validatorName, setValidatorName] = useState("");
  const [validatorNameInput, setValidatorNameInput] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginError, setLoginError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [history, setHistory] = useState<ScanEntry[]>([]);
  const [lastResult, setLastResult] = useState<ScanEntry | null>(null);
  const [online, setOnline] = useState(true);
  const [bootstrapInfo, setBootstrapInfo] = useState<{
    count: number;
    fetchedAt: string | null;
  }>({ count: 0, fetchedAt: null });
  const [queueSize, setQueueSize] = useState(0);
  const [paused, setPaused] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const recentCodesRef = useRef<Map<string, number>>(new Map());
  const pausedRef = useRef(false);

  // ── Estado inicial: token, nombre y modo demo desde URL/localStorage ──
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setIsDemo(params.get("demo") === "1");
    const storedToken = window.localStorage.getItem(TOKEN_KEY) ?? "";
    const storedName = window.localStorage.getItem(VALIDATOR_NAME_KEY) ?? "";
    setBootstrapInfo(getBootstrapInfo());
    setQueueSize(readQueue().length);
    setValidatorNameInput(storedName);
    setValidatorName(storedName);
    if (storedToken) {
      setTokenInput(storedToken);
      void validateToken(storedToken, storedName);
    } else {
      setAuthLoading(false);
    }
  }, []);

  // ── Online/offline status ──
  useEffect(() => {
    if (typeof window === "undefined") return;
    setOnline(navigator.onLine);
    const onOnline = () => {
      setOnline(true);
      void syncQueue();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // ── Sync paused ref ──
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  async function validateToken(value: string, name = validatorName) {
    setAuthLoading(true);
    setLoginError("");
    try {
      const demoParam = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1";
      const res = await fetch(`/api/scanner-bootstrap${demoParam ? "?demo=1" : ""}`, {
        headers: { "x-validator-token": value.trim() },
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Token incorrecto.");
      const data = (await res.json()) as { ticketCodes: string[]; count: number };
      window.localStorage.setItem(TOKEN_KEY, value.trim());
      if (name.trim()) {
        window.localStorage.setItem(VALIDATOR_NAME_KEY, name.trim());
      }
      saveBootstrap(data.ticketCodes);
      setBootstrapInfo(getBootstrapInfo());
      setToken(value.trim());
      setValidatorName(name.trim() || "validator");
      setIsAuthed(true);
    } catch (err) {
      window.localStorage.removeItem(TOKEN_KEY);
      setIsAuthed(false);
      setLoginError(err instanceof Error ? err.message : "Token incorrecto.");
    } finally {
      setAuthLoading(false);
    }
  }

  function logout() {
    stopCamera();
    window.localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setTokenInput("");
    setIsAuthed(false);
  }

  // ── Cámara ──
  const startCamera = useCallback(async () => {
    if (typeof window === "undefined") return;
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
    } catch (err) {
      setCameraError(
        err instanceof Error
          ? err.message
          : "No se pudo acceder a la cámara. Concede el permiso en el navegador.",
      );
      setScanning(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (scanTimerRef.current) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  }, []);

  // ── Procesar un QR detectado ──
  const handleQrPayload = useCallback(
    async (payload: string) => {
      const ticketCode = extractTicketCode(payload);

      // QR detectado pero sin formato de entrada Triple Nelson → feedback de error inmediato.
      if (!ticketCode) {
        const now = Date.now();
        const lastSeen = recentCodesRef.current.get("__invalid__");
        if (lastSeen && now - lastSeen < COOLDOWN_MS) return;
        recentCodesRef.current.set("__invalid__", now);
        const entry: ScanEntry = {
          id: `invalid-${now}`,
          status: "NOT_FOUND",
          ticketCode: payload.trim().slice(0, 40),
          scannedAt: new Date().toISOString(),
          message: "QR no reconocido. No es una entrada Triple Nelson.",
        };
        pushEntry(entry);
        playFeedback("NOT_FOUND");
        return;
      }

      // Cooldown: ignorar el mismo código durante COOLDOWN_MS.
      const now = Date.now();
      const lastSeen = recentCodesRef.current.get(ticketCode);
      if (lastSeen && now - lastSeen < COOLDOWN_MS) return;
      recentCodesRef.current.set(ticketCode, now);
      // Limpieza: olvida códigos viejos (cada N entradas).
      if (recentCodesRef.current.size > 100) {
        recentCodesRef.current.forEach((t, k) => {
          if (now - t > COOLDOWN_MS) recentCodesRef.current.delete(k);
        });
      }

      const scannedAt = new Date().toISOString();

      // ── Modo online ──
      if (navigator.onLine) {
        try {
          const res = await fetch("/api/validate-ticket", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-validator-token": token,
            },
            body: JSON.stringify({ qrPayload: ticketCode, validator: validatorName, demo: isDemo }),
          });
          const data = (await res.json()) as ValidationResult;
          const entry: ScanEntry = {
            id: `${ticketCode}-${now}`,
            status: data.status,
            ticketCode,
            ticket: data.ticket ?? null,
            scannedAt,
          };
          if (data.status === "OK") markUsedLocally(ticketCode);
          pushEntry(entry);
          playFeedback(data.status);
          return;
        } catch {
          // si el fetch falla, caemos al modo offline.
        }
      }

      // ── Modo offline ──
      const known = isCodeKnown(ticketCode);
      const alreadyUsed = isCodeUsedLocally(ticketCode);
      if (!known) {
        const entry: ScanEntry = {
          id: `${ticketCode}-${now}`,
          status: "NOT_FOUND",
          ticketCode,
          scannedAt,
          fromOffline: true,
          message: "Código desconocido (verificación offline).",
        };
        pushEntry(entry);
        playFeedback("NOT_FOUND");
        return;
      }
      if (alreadyUsed) {
        const entry: ScanEntry = {
          id: `${ticketCode}-${now}`,
          status: "DUPLICATE",
          ticketCode,
          scannedAt,
          fromOffline: true,
          message: "Ya marcado como usado en este dispositivo.",
        };
        pushEntry(entry);
        playFeedback("DUPLICATE");
        return;
      }

      // Aceptar offline y encolar para sincronizar.
      markUsedLocally(ticketCode);
      enqueueScan({ ticketCode, scannedAt, validator: validatorName });
      setQueueSize(readQueue().length);
      const entry: ScanEntry = {
        id: `${ticketCode}-${now}`,
        status: "QUEUED",
        ticketCode,
        scannedAt,
        fromOffline: true,
        message: "Aceptado offline. Se sincronizará al volver online.",
      };
      pushEntry(entry);
      playFeedback("OK");
    },
    [token, validatorName, isDemo],
  );

  function pushEntry(entry: ScanEntry) {
    setLastResult(entry);
    setHistory((prev) => [entry, ...prev].slice(0, 20));
  }

  // ── Loop de decodificación ──
  useEffect(() => {
    if (!scanning) return;

    const tick = () => {
      if (pausedRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;
      if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const code = jsQR(imageData.data, w, h, { inversionAttempts: "dontInvert" });
      if (code?.data) {
        void handleQrPayload(code.data);
      }
    };

    scanTimerRef.current = window.setInterval(tick, SCAN_INTERVAL_MS);
    return () => {
      if (scanTimerRef.current) {
        window.clearInterval(scanTimerRef.current);
        scanTimerRef.current = null;
      }
    };
  }, [scanning, handleQrPayload]);

  // ── Cleanup cámara al desmontar ──
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // ── Auto-arranque cuando se entra ──
  useEffect(() => {
    if (isAuthed && !scanning && !cameraError) {
      void startCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  // ── Sincronización de la cola offline ──
  const syncQueue = useCallback(async () => {
    if (!navigator.onLine || !token) return;
    const queue = readQueue();
    if (!queue.length) return;
    for (const item of queue) {
      try {
        const res = await fetch("/api/validate-ticket", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-validator-token": token },
          body: JSON.stringify({ qrPayload: item.ticketCode, validator: item.validator }),
        });
        if (res.ok) removeFromQueue(item.ticketCode);
      } catch {
        // dejamos para el siguiente intento
        break;
      }
    }
    setQueueSize(readQueue().length);
  }, [token]);

  useEffect(() => {
    if (online) void syncQueue();
  }, [online, syncQueue]);

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────

  if (authLoading) {
    return (
      <main className="min-h-screen bg-black px-5 py-8">
        <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Cargando...</p>
      </main>
    );
  }

  if (!isAuthed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void validateToken(tokenInput, validatorNameInput);
          }}
          className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6"
        >
          <Link href="/" className="font-display text-xl font-bold tracking-tighter text-white">
            TRIPLE NELSON
          </Link>
          <h1 className="mt-6 font-display text-3xl font-semibold text-white">Validación de entradas</h1>
          <p className="mt-2 text-sm text-zinc-400">Identifícate para empezar a escanear.</p>

          <label className="mt-6 block text-[10px] uppercase tracking-[0.28em] text-zinc-500">
            Token
          </label>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="x-validator-token"
            className="mt-2 w-full rounded-md border border-zinc-700 bg-black px-4 py-3 text-sm text-white outline-none focus:border-cyan-300"
            autoComplete="off"
          />

          <label className="mt-4 block text-[10px] uppercase tracking-[0.28em] text-zinc-500">
            Tu nombre (queda registrado en cada scan)
          </label>
          <input
            type="text"
            value={validatorNameInput}
            onChange={(e) => setValidatorNameInput(e.target.value)}
            placeholder="Ej: Javi · puerta principal"
            maxLength={40}
            className="mt-2 w-full rounded-md border border-zinc-700 bg-black px-4 py-3 text-sm text-white outline-none focus:border-cyan-300"
          />

          {loginError ? <p className="mt-3 text-sm text-rose-300">{loginError}</p> : null}

          <button
            type="submit"
            className="mt-6 w-full rounded-md bg-white px-5 py-3 text-xs font-bold uppercase tracking-[0.28em] text-black hover:bg-cyan-200"
          >
            Entrar
          </button>
        </form>
      </main>
    );
  }

  const statusColor =
    lastResult?.status === "OK" || lastResult?.status === "QUEUED"
      ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-200"
      : lastResult?.status === "DUPLICATE"
        ? "bg-amber-500/15 border-amber-400/40 text-amber-200"
        : lastResult?.status === "NOT_FOUND"
          ? "bg-rose-500/20 border-rose-400/40 text-rose-200"
          : "bg-zinc-800/40 border-zinc-700 text-zinc-300";

  return (
    <main className="flex min-h-screen flex-col bg-black text-white">
      {/* Header sticky */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-zinc-800 bg-black/85 px-3 py-2 backdrop-blur">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">
            Triple Nelson · Scanner
            {isDemo && <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300 border border-amber-500/40">DEMO</span>}
          </span>
          <span className="text-xs text-zinc-300">
            {validatorName} ·{" "}
            <span className={online ? "text-emerald-300" : "text-rose-300"}>
              {online ? "online" : "OFFLINE"}
            </span>
            {queueSize > 0 ? (
              <span className="ml-1 text-amber-300"> · {queueSize} pendientes</span>
            ) : null}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-zinc-300 hover:text-white"
          >
            {paused ? "Reanudar" : "Pausar"}
          </button>
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-zinc-400 hover:text-white"
          >
            Salir
          </button>
        </div>
      </header>

      {/* Cámara + overlay */}
      <section className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        {cameraError ? (
          <div className="relative max-w-xs rounded-lg border border-rose-500/40 bg-rose-500/15 p-4 text-center text-sm text-rose-100">
            <p className="font-semibold">No se pudo abrir la cámara</p>
            <p className="mt-2 text-xs">{cameraError}</p>
            <button
              type="button"
              onClick={startCamera}
              className="mt-3 rounded-md border border-rose-300/60 px-3 py-1.5 text-xs uppercase tracking-[0.2em]"
            >
              Reintentar
            </button>
          </div>
        ) : null}

        {/* Guía de escaneo */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className={`h-60 w-60 rounded-2xl border-4 transition-colors ${
              paused ? "border-zinc-600" : "border-white/70"
            }`}
            style={{
              boxShadow: paused
                ? "0 0 0 100vmax rgba(0,0,0,0.5)"
                : "0 0 0 100vmax rgba(0,0,0,0.35)",
            }}
          />
        </div>

        {/* Resultado más reciente (overlay flotante) */}
        {lastResult ? (
          <div
            key={lastResult.id}
            className={`absolute bottom-4 left-3 right-3 rounded-xl border p-3 backdrop-blur ${statusColor}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.28em] opacity-70">
                  {lastResult.status === "OK"
                    ? "✓ Acceso válido"
                    : lastResult.status === "QUEUED"
                      ? "✓ Aceptado offline"
                      : lastResult.status === "DUPLICATE"
                        ? "⚠ Ya usado"
                        : "✗ No válido"}
                </p>
                <p className="mt-0.5 truncate font-mono text-sm font-bold">
                  {lastResult.ticketCode}
                </p>
                {lastResult.ticket?.buyerName ? (
                  <p className="mt-1 truncate text-sm">
                    {lastResult.ticket.buyerName}
                  </p>
                ) : null}
                {lastResult.ticket?.buyerEmail ? (
                  <p className="truncate text-xs opacity-80">
                    {lastResult.ticket.buyerEmail}
                  </p>
                ) : null}
                {lastResult.ticket?.ticketType ? (
                  <p className="mt-0.5 text-xs opacity-80">
                    {lastResult.ticket.ticketType}
                    {typeof lastResult.ticket.amountCents === "number"
                      ? ` · ${(lastResult.ticket.amountCents / 100).toFixed(2)}€`
                      : ""}
                  </p>
                ) : null}
                {lastResult.status === "DUPLICATE" && lastResult.ticket?.usedAt ? (
                  <p className="mt-1 text-xs opacity-80">
                    Usado el {new Date(lastResult.ticket.usedAt).toLocaleString("es-ES")}
                    {lastResult.ticket.usedBy ? ` · ${lastResult.ticket.usedBy}` : ""}
                  </p>
                ) : null}
                {lastResult.message ? (
                  <p className="mt-1 text-xs opacity-80">{lastResult.message}</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {/* Histórico */}
      <section className="flex-1 overflow-y-auto border-t border-zinc-800 bg-zinc-950 p-3">
        <p className="mb-2 text-[10px] uppercase tracking-[0.28em] text-zinc-500">
          Últimos escaneos · Bootstrap: {bootstrapInfo.count} tickets
        </p>
        {history.length === 0 ? (
          <p className="text-sm text-zinc-500">Aún no hay escaneos.</p>
        ) : (
          <ul className="space-y-1.5">
            {history.map((entry) => {
              const color =
                entry.status === "OK" || entry.status === "QUEUED"
                  ? "border-emerald-400/30 bg-emerald-500/5"
                  : entry.status === "DUPLICATE"
                    ? "border-amber-400/30 bg-amber-500/5"
                    : "border-rose-400/30 bg-rose-500/5";
              return (
                <li
                  key={entry.id}
                  className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs ${color}`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono font-bold">{entry.ticketCode}</p>
                    {entry.ticket?.buyerName ? (
                      <p className="truncate text-zinc-300">{entry.ticket.buyerName}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-[10px] uppercase tracking-widest opacity-70">
                    {entry.status}
                    {entry.fromOffline ? " · offline" : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

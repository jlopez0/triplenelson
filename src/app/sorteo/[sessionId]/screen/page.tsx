"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import Link from "next/link";
import { listenRaffleSession } from "@/lib/raffle/rtdb";
import type { DrawResult, RaffleSession } from "@/lib/raffle/types";

const FALLBACK_NAMES = [
  "ALEJANDRO", "BEATRIZ", "CARLOS", "DIANA", "ELENA",
  "FERNANDO", "GLORIA", "HÉCTOR", "IRENE", "JAVIER",
  "LAURA", "MIGUEL", "NATALIA", "OSCAR", "PATRICIA",
  "RAFAEL", "SARA", "TOMÁS", "VERÓNICA", "XAVIER",
];

const ITEM_HEIGHT = 96;
const VISIBLE_ITEMS = 5;

function buildSlotList(winnerName: string, seed: number, names: string[]): string[] {
  const pool = names.length >= 5 ? names : FALLBACK_NAMES;
  // Doble barajado para distribución más aleatoria
  const shuffled = [...pool]
    .sort(() => Math.sin(seed) * Math.cos(Math.random() * seed) - 0.5)
    .sort(() => Math.random() - 0.5);
  const filler: string[] = [];
  while (filler.length < 140) {
    filler.push(...shuffled);
  }
  return [...filler.slice(0, 140), winnerName];
}

function SlotMachine({
  winnerName,
  participantNames,
  onDone,
}: {
  winnerName: string;
  participantNames: string[];
  onDone: () => void;
}) {
  const controls = useAnimation();
  const seed = useRef(Date.now()).current;
  const items = useMemo(
    () => buildSlotList(winnerName, seed, participantNames),
    [winnerName, seed, participantNames],
  );
  const winnerIndex = items.length - 1;

  useEffect(() => {
    const targetY = -(winnerIndex - Math.floor(VISIBLE_ITEMS / 2)) * ITEM_HEIGHT;

    void controls
      .start({
        y: targetY,
        transition: {
          duration: 12, // más tiempo para el drama
          ease: [0.04, 0.85, 0.15, 1], // arranca muy rápido, frena muy largo al final
        },
      })
      .then(onDone);
  }, [controls, winnerIndex, onDone]);

  return (
    <div
      className="relative mx-auto overflow-hidden rounded-2xl border-2 border-cyan-400/60 bg-black/70 shadow-[0_0_60px_rgba(34,211,238,0.15)]"
      style={{ width: "min(560px, 90vw)", height: ITEM_HEIGHT * VISIBLE_ITEMS }}
    >
      {/* Línea de selección con glow */}
      <div
        className="pointer-events-none absolute inset-x-0 z-10"
        style={{ top: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2), height: ITEM_HEIGHT }}
      >
        <div className="h-full border-y-2 border-cyan-400 bg-cyan-400/10 shadow-[0_0_20px_rgba(34,211,238,0.3)]" />
      </div>

      {/* Gradientes profundidad */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-32 bg-gradient-to-b from-black via-black/80 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-32 bg-gradient-to-t from-black via-black/80 to-transparent" />

      <motion.div animate={controls} initial={{ y: 0 }}>
        {items.map((name, i) => {
          const isWinner = i === winnerIndex;
          return (
            <div
              key={i}
              className="flex items-center justify-center font-display font-bold tracking-tight"
              style={{
                height: ITEM_HEIGHT,
                fontSize: "clamp(1.4rem, 3vw, 2.4rem)",
                color: isWinner ? "#22d3ee" : "white",
                opacity: isWinner ? 1 : 0.5,
              }}
            >
              {name}
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}

// Cuenta atrás 3-2-1 antes del slot
function Countdown({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (count <= 0) {
      onDone();
      return;
    }
    const id = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [count, onDone]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={count}
        initial={{ opacity: 0, scale: 2.5, filter: "blur(8px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, scale: 0.4, filter: "blur(4px)" }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="flex flex-col items-center justify-center gap-6"
      >
        <p className="text-sm uppercase tracking-[0.5em] text-zinc-400">Sorteando en</p>
        <span
          className="font-display font-bold text-cyan-300"
          style={{ fontSize: "clamp(8rem, 25vw, 18rem)", lineHeight: 1 }}
        >
          {count === 0 ? "¡YA!" : count}
        </span>
        {/* Pulso de fondo */}
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-full"
          animate={{ scale: [1, 1.6, 1], opacity: [0.15, 0, 0.15] }}
          transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
          style={{
            background: "radial-gradient(circle, rgba(34,211,238,0.2) 0%, transparent 70%)",
          }}
        />
      </motion.div>
    </AnimatePresence>
  );
}

export default function RaffleScreenPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  const [session, setSession] = useState<RaffleSession | null>(null);
  const [phase, setPhase] = useState<"idle" | "countdown" | "spinning" | "result">("idle");
  const prevStatusRef = useRef<string | null>(null);
  const prevDrawIndexRef = useRef<number>(-1);
  // El primer snapshot desde el RTDB refleja el estado actual, no una transición.
  // Lo usamos solo para sincronizar refs — nunca para lanzar la animación.
  const initializedRef = useRef(false);

  useEffect(() => {
    return listenRaffleSession(sessionId, (s) => {
      const newStatus = s?.status ?? null;
      const newDrawIndex = s?.currentDraw?.index ?? 0;

      if (!initializedRef.current) {
        // Primer snapshot: sincronizar estado sin animar.
        // Si ya estaba en "result" lo mostramos; si estaba en "spinning" o "idle",
        // quedamos en idle esperando la próxima acción del admin.
        initializedRef.current = true;
        prevStatusRef.current = newStatus;
        prevDrawIndexRef.current = newDrawIndex;
        if (newStatus === "result" && s?.currentDraw?.winnerName) {
          setPhase("result");
        } else {
          setPhase("idle");
        }
        setSession(s);
        return;
      }

      // A partir del segundo snapshot: reaccionar solo a transiciones reales
      if (
        newStatus === "spinning" &&
        (prevStatusRef.current !== "spinning" || newDrawIndex !== prevDrawIndexRef.current)
      ) {
        setPhase("countdown");
      } else if (newStatus === "result" && prevStatusRef.current !== "result") {
        setPhase("result");
      } else if (newStatus === "idle") {
        setPhase("idle");
      }

      prevStatusRef.current = newStatus;
      prevDrawIndexRef.current = newDrawIndex;
      setSession(s);
    });
  }, [sessionId]);

  const history: DrawResult[] = session?.history
    ? Object.values(session.history).slice(-5).reverse()
    : [];

  const winner = session?.currentDraw?.winnerName ?? null;
  const drawIndex = session?.currentDraw?.index ?? 0;

  return (
    <main className="h-[100dvh] overflow-hidden bg-techno text-white flex flex-col">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between border-b border-zinc-800 px-8 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-cyan-300">Triple Nelson · Sorteo</p>
          <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">JCoins</h1>
        </div>
        <div className="flex gap-4 text-right">
          {session?.jcoins ? (
            <div className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-5 py-3">
              <p className="font-mono text-2xl font-bold text-cyan-300">{session.jcoins}</p>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-600">JCoins</p>
            </div>
          ) : null}
          {session?.poolSize ? (
            <div className="rounded-lg border border-zinc-700 bg-black/60 px-5 py-3">
              <p className="font-mono text-2xl text-cyan-200">{session.poolSize}</p>
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">papeletas</p>
            </div>
          ) : null}
        </div>
      </header>

      {/* Cuerpo */}
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-8">
        <AnimatePresence mode="wait">

          {/* IDLE */}
          {phase === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center"
            >
              {session?.poolSize ? (
                <>
                  <motion.p
                    className="font-display font-bold text-zinc-700 md:text-8xl"
                    style={{ fontSize: "clamp(4rem, 15vw, 8rem)" }}
                    animate={{ opacity: [0.4, 0.7, 0.4] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  >
                    LISTO
                  </motion.p>
                  <p className="mt-4 text-zinc-500">
                    {session.poolSize} papeletas · {session.uniqueParticipants} participantes
                  </p>
                </>
              ) : (
                <motion.p
                  className="font-display font-bold text-zinc-700"
                  style={{ fontSize: "clamp(3rem, 10vw, 6rem)" }}
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  Esperando sorteo...
                </motion.p>
              )}
            </motion.div>
          )}

          {/* COUNTDOWN */}
          {phase === "countdown" && (
            <motion.div
              key={`countdown-${drawIndex}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative flex flex-col items-center justify-center w-full h-full"
            >
              <Countdown onDone={() => setPhase("spinning")} />
            </motion.div>
          )}

          {/* SPINNING */}
          {phase === "spinning" && winner && (
            <motion.div
              key={`spin-${drawIndex}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-6 w-full"
            >
              <p className="text-sm uppercase tracking-[0.4em] text-zinc-400">
                Sorteo #{drawIndex}
              </p>
              <SlotMachine
                key={`slot-${drawIndex}`}
                winnerName={winner}
                participantNames={session?.participantNames ?? []}
                onDone={() => setPhase("result")}
              />
            </motion.div>
          )}

          {/* RESULT */}
          {phase === "result" && winner && (
            <motion.div
              key={`result-${drawIndex}`}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 140, damping: 16 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center gap-6 text-center"
            >
              <p className="text-sm uppercase tracking-[0.4em] text-cyan-300">
                Sorteo #{drawIndex} · Ganador
              </p>

              {session?.jcoins ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 16 }}
                >
                  <p
                    className="font-display font-bold tracking-tighter text-cyan-300"
                    style={{ fontSize: "clamp(4rem, 14vw, 11rem)", lineHeight: 1 }}
                  >
                    {session.jcoins}
                    <span
                      className="ml-3 text-cyan-500"
                      style={{ fontSize: "clamp(1.5rem, 4vw, 3.5rem)" }}
                    >
                      JCoins
                    </span>
                  </p>
                </motion.div>
              ) : null}

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <p
                  className="font-display font-bold tracking-tighter text-white"
                  style={{ fontSize: "clamp(3.5rem, 10vw, 8rem)", lineHeight: 1 }}
                >
                  {winner}
                </p>
              </motion.div>

              {/* Confetti de partículas */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {Array.from({ length: 30 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute rounded-full"
                    style={{
                      width: 6 + (i % 4) * 4,
                      height: 6 + (i % 4) * 4,
                      left: `${5 + (i * 67) % 90}%`,
                      top: `${-5 + (i % 3) * 3}%`,
                      backgroundColor: ["#22d3ee", "#a78bfa", "#f59e0b", "#34d399", "#f43f5e"][i % 5],
                    }}
                    initial={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
                    animate={{
                      y: `${50 + (i * 29) % 60}vh`,
                      opacity: 0,
                      scale: 0.2,
                      rotate: (i % 2 === 0 ? 1 : -1) * (180 + i * 20),
                    }}
                    transition={{
                      duration: 2.5 + (i % 4) * 0.5,
                      delay: i * 0.04,
                      ease: "easeOut",
                    }}
                  />
                ))}
              </div>

              {/* Glow de fondo */}
              <motion.div
                className="pointer-events-none absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.4, 0] }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                style={{
                  background:
                    "radial-gradient(ellipse at center, rgba(34,211,238,0.15) 0%, transparent 70%)",
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Historial inferior */}
      {history.length > 0 && (
        <footer className="shrink-0 border-t border-zinc-800 px-8 py-4">
          <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-zinc-600">Anteriores</p>
          <div className="flex flex-wrap gap-2">
            {history.map((d) => (
              <span
                key={d.draw}
                className="rounded-full border border-zinc-700 bg-black/40 px-3 py-1 text-xs text-zinc-400"
              >
                #{d.draw} {d.winnerName}
              </span>
            ))}
          </div>
        </footer>
      )}
    </main>
  );
}

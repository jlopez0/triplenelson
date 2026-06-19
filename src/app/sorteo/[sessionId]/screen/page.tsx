"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import Link from "next/link";
import { listenRaffleSession } from "@/lib/raffle/rtdb";
import type { DrawResult, RaffleSession } from "@/lib/raffle/types";

// Nombres de relleno para la animación slot — se mezclan durante el giro
const FILLER_NAMES = [
  "ALEJANDRO", "BEATRIZ", "CARLOS", "DIANA", "ELENA",
  "FERNANDO", "GLORIA", "HÉCTOR", "IRENE", "JAVIER",
  "LAURA", "MIGUEL", "NATALIA", "OSCAR", "PATRICIA",
  "RAFAEL", "SARA", "TOMÁS", "VERÓNICA", "XAVIER",
];

const ITEM_HEIGHT = 96; // px — altura de cada nombre en el slot
const VISIBLE_ITEMS = 5; // cuántos nombres se ven a la vez

function buildSlotList(winnerName: string, seed: number): string[] {
  const shuffled = [...FILLER_NAMES].sort(() => Math.sin(seed + Math.random()) - 0.5);
  const filler: string[] = [];
  while (filler.length < 80) {
    filler.push(...shuffled);
  }
  return [...filler.slice(0, 80), winnerName];
}

function SlotMachine({ winnerName, onDone }: { winnerName: string; onDone: () => void }) {
  const controls = useAnimation();
  const seed = useRef(Date.now()).current;
  const items = useMemo(() => buildSlotList(winnerName, seed), [winnerName, seed]);
  const winnerIndex = items.length - 1;

  useEffect(() => {
    // El ganador queda centrado en la ventana
    const targetY = -(winnerIndex - Math.floor(VISIBLE_ITEMS / 2)) * ITEM_HEIGHT;

    void controls.start({
      y: targetY,
      transition: {
        duration: 8,
        ease: [0.08, 0.9, 0.2, 1], // arranca fuerte, frena dramáticamente al final
      },
    }).then(onDone);
  }, [controls, winnerIndex, onDone]);

  return (
    <div
      className="relative mx-auto overflow-hidden rounded-2xl border-2 border-cyan-400/50 bg-black/60"
      style={{ width: 480, height: ITEM_HEIGHT * VISIBLE_ITEMS }}
    >
      {/* Línea de selección */}
      <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2), height: ITEM_HEIGHT }}>
        <div className="h-full border-y-2 border-cyan-400 bg-cyan-400/10" />
      </div>

      {/* Gradientes superior e inferior para efecto de profundidad */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-black to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-t from-black to-transparent" />

      <motion.div animate={controls} initial={{ y: 0 }}>
        {items.map((name, i) => (
          <div
            key={i}
            className="flex items-center justify-center font-display font-bold tracking-tight text-white"
            style={{
              height: ITEM_HEIGHT,
              fontSize: "clamp(1.4rem, 3vw, 2.2rem)",
              opacity: i === winnerIndex ? 1 : 0.6,
            }}
          >
            {name}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

export default function RaffleScreenPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  const [session, setSession] = useState<RaffleSession | null>(null);
  const [showResult, setShowResult] = useState(false);
  const prevStatusRef = useRef<string | null>(null);

  useEffect(() => {
    return listenRaffleSession(sessionId, (s) => {
      // Cuando llega "spinning", reseteamos el resultado visible
      if (s?.status === "spinning" && prevStatusRef.current !== "spinning") {
        setShowResult(false);
      }
      prevStatusRef.current = s?.status ?? null;
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
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-8">
        <AnimatePresence mode="wait">
          {/* IDLE */}
          {(!session || session.status === "idle") && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              {session?.poolSize ? (
                <>
                  <p className="font-display text-6xl font-bold text-zinc-600 md:text-8xl">LISTO</p>
                  <p className="mt-4 text-zinc-500">
                    {session.poolSize} papeletas · {session.uniqueParticipants} participantes
                  </p>
                </>
              ) : (
                <p className="font-display text-5xl font-bold text-zinc-700">Esperando sorteo...</p>
              )}
            </motion.div>
          )}

          {/* SPINNING */}
          {session?.status === "spinning" && winner && !showResult && (
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
                key={drawIndex}
                winnerName={winner}
                onDone={() => setShowResult(true)}
              />
            </motion.div>
          )}

          {/* RESULT */}
          {(showResult || session?.status === "result") && winner && (
            <motion.div
              key={`result-${drawIndex}`}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 160, damping: 18 }}
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
                  transition={{ delay: 0.05, type: "spring", stiffness: 200, damping: 16 }}
                >
                  <p
                    className="font-display font-bold tracking-tighter text-cyan-300"
                    style={{ fontSize: "clamp(4rem, 14vw, 11rem)", lineHeight: 1 }}
                  >
                    {session.jcoins}
                    <span className="ml-3 text-cyan-500" style={{ fontSize: "clamp(1.5rem, 4vw, 3.5rem)" }}>JCoins</span>
                  </p>
                </motion.div>
              ) : null}

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <p
                  className="font-display font-bold tracking-tighter text-white"
                  style={{ fontSize: "clamp(3.5rem, 10vw, 8rem)", lineHeight: 1 }}
                >
                  {winner}
                </p>
              </motion.div>

              {/* Partículas simples con Framer Motion */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {Array.from({ length: 18 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute h-3 w-3 rounded-full"
                    style={{
                      left: `${10 + (i * 73) % 80}%`,
                      top: "10%",
                      backgroundColor: ["#22d3ee", "#a78bfa", "#f59e0b", "#34d399"][i % 4],
                    }}
                    initial={{ y: 0, opacity: 1, scale: 1 }}
                    animate={{
                      y: `${300 + (i * 37) % 400}px`,
                      opacity: 0,
                      scale: 0.3,
                      rotate: (i % 2 === 0 ? 1 : -1) * (120 + i * 15),
                    }}
                    transition={{ duration: 2 + (i % 3) * 0.4, delay: i * 0.06, ease: "easeOut" }}
                  />
                ))}
              </div>
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

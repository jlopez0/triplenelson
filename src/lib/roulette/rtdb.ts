"use client";

/**
 * PATRONES DE CONCURRENCIA — leer antes de modificar.
 *
 * 1. Cambios de status (lobby → betting_open, etc.) usan `runTransaction` para
 *    evitar race conditions entre dobles clicks o múltiples admins.
 *
 * 2. Creación de sessionId: `runTransaction` sobre el path completo de la sesión.
 *
 * 3. Generación de playerId: `crypto.randomUUID()` (NO `push().key`).
 *
 * 4. Listeners en el cliente: cada listener en su propio useEffect con cleanup.
 *
 * 5. `placeBets`: se valida en cliente, pero el cálculo de pagos es server-side
 *    en /api/roulette/spin con un lock idempotente sobre `currentRound/result`.
 */

import {
  get,
  onValue,
  ref,
  runTransaction,
  set,
  update,
  type Unsubscribe,
} from "firebase/database";
import { getRtdb } from "@/lib/kahoot/firebase-client";
import { validateBet } from "./logic";
import type {
  Bet,
  RouletteConfig,
  RoulettePlayer,
  RouletteSession,
} from "./types";

const ENV = process.env.NEXT_PUBLIC_FIREBASE_ENV ?? "dev";

function rp(path: string): string {
  return `${ENV}/roulette/${path}`;
}

function randomSessionId(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function createSession(config: {
  initialCredits: number;
}): Promise<string> {
  const db = getRtdb();
  const initialCredits = Math.max(
    100,
    Math.min(100000, Math.floor(config.initialCredits)),
  );

  for (let i = 0; i < 8; i += 1) {
    const sessionId = randomSessionId();
    const sessionRef = ref(db, rp(sessionId));
    const initial: RouletteSession = {
      status: "lobby",
      config: {
        initialCredits,
        createdAt: Date.now(),
      } satisfies RouletteConfig,
      currentRound: {
        index: 0,
        startedAt: 0,
        timeLimit: 30,
        result: null,
        color: null,
        allBetsIn: false,
      },
    };
    const result = await runTransaction(sessionRef, (current) => {
      if (current !== null) return; // ya existe — abortar
      return initial;
    });
    if (result.committed) return sessionId;
  }

  throw new Error("No se pudo crear sesión única.");
}

export async function joinSession(
  sessionId: string,
  playerName: string,
): Promise<string> {
  const name = playerName.trim().slice(0, 20);
  if (!name) throw new Error("Nickname vacío");

  const db = getRtdb();
  const sessionSnap = await get(ref(db, rp(sessionId)));
  if (!sessionSnap.exists()) throw new Error("Sesión no encontrada.");

  const session = sessionSnap.val() as RouletteSession;
  const initialCredits = session.config?.initialCredits ?? 1000;

  // playerId con crypto.randomUUID: unicidad garantizada sin colisiones.
  const playerId = (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `p_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const playerRef = ref(db, rp(`${sessionId}/players/${playerId}`));

  const payload: RoulettePlayer = {
    name,
    credits: initialCredits,
    hasBet: false,
    eliminated: false,
    joinedAt: Date.now(),
    bets: [],
  };
  await set(playerRef, payload);
  return playerId;
}

export async function placeBets(
  sessionId: string,
  playerId: string,
  bets: Bet[],
): Promise<void> {
  if (!bets.length) return;
  const db = getRtdb();
  const sessionSnap = await get(ref(db, rp(sessionId)));
  if (!sessionSnap.exists()) throw new Error("Sesión no encontrada.");

  const session = sessionSnap.val() as RouletteSession;
  if (session.status !== "betting_open") throw new Error("Las apuestas están cerradas.");

  const playerSnap = await get(ref(db, rp(`${sessionId}/players/${playerId}`)));
  if (!playerSnap.exists()) throw new Error("Jugador no encontrado.");
  const player = playerSnap.val() as RoulettePlayer;
  if (player.eliminated) throw new Error("Estás eliminado.");

  const totalAmount = bets.reduce((s, b) => s + b.amount, 0);
  if (totalAmount > player.credits) throw new Error("Saldo insuficiente para todas las apuestas.");

  const cleanBets: Bet[] = bets.map((b) => ({
    type: b.type,
    value: b.type === "number" ? b.value : null,
    amount: b.amount,
  }));

  await update(ref(db, rp(`${sessionId}/players/${playerId}`)), {
    hasBet: true,
    bets: cleanBets,
  });
}

export function listenSession(
  sessionId: string,
  callback: (session: RouletteSession | null) => void,
): Unsubscribe {
  const r = ref(getRtdb(), rp(sessionId));
  return onValue(r, (snap) => {
    callback(snap.exists() ? (snap.val() as RouletteSession) : null);
  }, (err) => { console.error("[ruleta] listenSession error:", err.message); });
}

export function listenPlayers(
  sessionId: string,
  callback: (players: Record<string, RoulettePlayer>) => void,
): Unsubscribe {
  const r = ref(getRtdb(), rp(`${sessionId}/players`));
  return onValue(r, (snap) => {
    callback(
      snap.exists() ? (snap.val() as Record<string, RoulettePlayer>) : {},
    );
  }, (err) => { console.error("[ruleta] listenPlayers error:", err.message); });
}

export function listenPlayer(
  sessionId: string,
  playerId: string,
  callback: (player: RoulettePlayer | null) => void,
): Unsubscribe {
  const r = ref(getRtdb(), rp(`${sessionId}/players/${playerId}`));
  return onValue(r, (snap) => {
    callback(snap.exists() ? (snap.val() as RoulettePlayer) : null);
  }, (err) => { console.error("[ruleta] listenPlayer error:", err.message); });
}

export async function startBettingRound(sessionId: string): Promise<void> {
  const db = getRtdb();
  const sessionRef = ref(db, rp(sessionId));
  const result = await runTransaction(
    sessionRef,
    (current: RouletteSession | null) => {
      if (!current) return current;
      if (current.status !== "lobby") return; // abortar: ya empezó
      return {
        ...current,
        status: "betting_open",
        currentRound: {
          index: 1,
          startedAt: Date.now(),
          timeLimit: 30,
          result: null,
          color: null,
          allBetsIn: false,
        },
      };
    },
  );
  if (!result.committed) {
    throw new Error("La partida ya ha empezado.");
  }
}

export function getLeaderboard(
  players: Record<string, RoulettePlayer>,
) {
  return Object.entries(players)
    .map(([playerId, player]) => ({
      playerId,
      name: player.name,
      credits: player.credits ?? 0,
      eliminated: player.eliminated ?? false,
      rank: 0,
    }))
    .sort(
      (a, b) =>
        b.credits - a.credits ||
        Number(a.eliminated) - Number(b.eliminated) ||
        a.name.localeCompare(b.name),
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

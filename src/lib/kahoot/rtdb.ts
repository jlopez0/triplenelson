"use client";

/**
 * PATRONES DE CONCURRENCIA — leer antes de modificar.
 *
 * 1. Cambios de status (lobby → question, etc.) usan `runTransaction` para evitar
 *    race conditions entre dobles clicks o múltiples admins. NUNCA usar `set()` o
 *    `update()` para transiciones de status sin transacción.
 *
 * 2. Creación de gameId: `runTransaction` sobre el path completo del juego —
 *    si dos clicks generan el mismo gameId aleatorio, solo uno gana.
 *
 * 3. Generación de playerId: `crypto.randomUUID()` (NO `push().key`, NO `Math.random()`).
 *    Esto garantiza unicidad sin depender de timestamps del servidor.
 *
 * 4. Listeners en el cliente: cada listener en su propio useEffect, con cleanup
 *    en el return. Nunca acoplar dos listeners distintos en el mismo useEffect.
 */

import {
  get,
  onValue,
  ref,
  runTransaction,
  serverTimestamp,
  set,
  update,
  type Unsubscribe,
} from "firebase/database";
import { getRtdb } from "./firebase-client";
import type {
  ActiveQuestion,
  AnswerIndex,
  GameAnswer,
  GamePlayer,
  GameState,
  LeaderboardEntry,
  QuizQuestion,
} from "./types";

const ENV = process.env.NEXT_PUBLIC_FIREBASE_ENV ?? "dev";

function gp(path: string): string {
  return `${ENV}/${path}`;
}

function randomGameId(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function toActiveQuestion(question: QuizQuestion): ActiveQuestion {
  return {
    text: question.text,
    imageUrl: question.imageUrl,
    options: question.options,
    timeLimit: question.timeLimit,
    startedAt: Date.now(),
  };
}

export async function setActiveGame(gameId: string | null): Promise<void> {
  await set(ref(getRtdb(), gp("activeGame")), gameId ?? null);
}

export async function getActiveGame(): Promise<string | null> {
  const snap = await get(ref(getRtdb(), gp("activeGame")));
  return snap.exists() ? (snap.val() as string) : null;
}

export function subscribeActiveGame(onChange: (gameId: string | null) => void): Unsubscribe {
  return onValue(ref(getRtdb(), gp("activeGame")), (snap) => {
    onChange(snap.exists() ? (snap.val() as string) : null);
  });
}

export function subscribeGame(
  gameId: string,
  onChange: (state: GameState | null) => void,
): Unsubscribe {
  const r = ref(getRtdb(), gp(`games/${gameId}`));
  return onValue(r, (snap) => {
    onChange(snap.exists() ? (snap.val() as GameState) : null);
  });
}

export function subscribeCorrectIndex(
  gameId: string,
  onChange: (correctIndex: number | null) => void,
): Unsubscribe {
  const r = ref(getRtdb(), gp(`games/${gameId}/currentQuestion/correctIndex`));
  return onValue(r, (snap) => {
    onChange(snap.exists() ? (snap.val() as number) : null);
  });
}

export function subscribePlayers(
  gameId: string,
  onChange: (players: Record<string, GamePlayer>) => void,
): Unsubscribe {
  const r = ref(getRtdb(), gp(`games/${gameId}/players`));
  return onValue(r, (snap) => {
    onChange(snap.exists() ? (snap.val() as Record<string, GamePlayer>) : {});
  });
}

export function subscribePlayer(
  gameId: string,
  playerId: string,
  onChange: (player: GamePlayer | null) => void,
): Unsubscribe {
  const r = ref(getRtdb(), gp(`games/${gameId}/players/${playerId}`));
  return onValue(r, (snap) => {
    onChange(snap.exists() ? (snap.val() as GamePlayer) : null);
  });
}

export function subscribeAnswersForQuestion(
  gameId: string,
  questionIndex: number,
  onChange: (answers: Record<string, GameAnswer>) => void,
): Unsubscribe {
  const r = ref(getRtdb(), gp(`games/${gameId}/answers/${questionIndex}`));
  return onValue(r, (snap) => {
    onChange(snap.exists() ? (snap.val() as Record<string, GameAnswer>) : {});
  });
}

export async function createGame(
  quizId: string,
  totalQuestions = 0,
): Promise<string> {
  const db = getRtdb();

  // Reintentar con IDs distintos hasta que la transacción committee uno único.
  for (let i = 0; i < 8; i += 1) {
    const gameId = randomGameId();
    const gameRef = ref(db, gp(`games/${gameId}`));
    const initial: GameState = {
      quizId,
      status: "lobby",
      currentQuestionIndex: -1,
      totalQuestions,
      currentQuestion: null,
      createdAt: Date.now(),
    };
    const result = await runTransaction(gameRef, (current) => {
      if (current !== null) return; // ya existe — abortar
      return initial;
    });
    if (result.committed) return gameId;
  }

  throw new Error("No se pudo crear una partida única.");
}

export async function joinGame(
  gameId: string,
  playerName: string,
): Promise<string> {
  const name = playerName.trim().slice(0, 20);
  if (!name) throw new Error("Nickname vacío");

  // playerId con crypto.randomUUID: unicidad garantizada sin colisiones.
  const playerId = (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `p_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const playerRef = ref(getRtdb(), gp(`games/${gameId}/players/${playerId}`));
  const payload: GamePlayer = {
    name,
    score: 0,
    answered: false,
    joinedAt: Date.now(),
  };
  await set(playerRef, payload);
  return playerId;
}

export async function submitAnswer(
  gameId: string,
  playerId: string,
  questionIndex: number,
  optionIndex: AnswerIndex,
  timeMs: number,
): Promise<void> {
  const db = getRtdb();
  const answerRef = ref(db, gp(`games/${gameId}/answers/${questionIndex}/${playerId}`));
  const result = await runTransaction(answerRef, (current) => {
    if (current) return undefined;
    return {
      optionIndex,
      timeMs: Math.max(0, Math.round(timeMs)),
      submittedAt: serverTimestamp() as unknown as number,
    } satisfies GameAnswer;
  });

  if (result.committed) {
    await update(ref(db), {
      [gp(`games/${gameId}/players/${playerId}/answered`)]: true,
    });
  }
}

export async function advanceQuestion(
  gameId: string,
  questionIndex: number,
  question: QuizQuestion,
): Promise<void> {
  await resetPlayersForQuestion(gameId);
  const gameRef = ref(getRtdb(), gp(`games/${gameId}`));
  await runTransaction(gameRef, (current: GameState | null) => {
    if (!current) return current;
    // Idempotente: si ya estamos en esta pregunta, no reescribir startedAt.
    if (
      current.status === "question" &&
      current.currentQuestionIndex === questionIndex
    ) {
      return current;
    }
    return {
      ...current,
      status: "question",
      currentQuestionIndex: questionIndex,
      currentQuestion: toActiveQuestion(question),
    };
  });
}

export async function showLeaderboard(gameId: string): Promise<void> {
  const gameRef = ref(getRtdb(), gp(`games/${gameId}`));
  await runTransaction(gameRef, (current: GameState | null) => {
    if (!current) return current;
    if (current.status === "leaderboard") return current;
    return { ...current, status: "leaderboard", currentQuestion: null };
  });
}

export async function finishGame(gameId: string): Promise<void> {
  const gameRef = ref(getRtdb(), gp(`games/${gameId}`));
  await runTransaction(gameRef, (current: GameState | null) => {
    if (!current) return current;
    if (current.status === "finished") return current;
    return { ...current, status: "finished", currentQuestion: null };
  });
}

export function getLeaderboardFromPlayers(
  players: Record<string, GamePlayer>,
): LeaderboardEntry[] {
  return Object.entries(players)
    .map(([playerId, player]) => ({
      playerId,
      name: player.name,
      score: player.score ?? 0,
      lastGain: player.lastGain ?? 0,
      rank: 0,
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

async function resetPlayersForQuestion(gameId: string): Promise<void> {
  const db = getRtdb();
  const playersRef = ref(db, gp(`games/${gameId}/players`));
  const snap = await get(playersRef);
  if (!snap.exists()) return;

  const players = snap.val() as Record<string, GamePlayer>;
  const updates: Record<string, unknown> = {};
  Object.keys(players).forEach((playerId) => {
    updates[`${playerId}/answered`] = false;
  });

  await update(playersRef, updates);
}

export { serverTimestamp };

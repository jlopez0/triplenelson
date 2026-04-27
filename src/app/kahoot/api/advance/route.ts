import { NextRequest, NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/bizum/http";
import { getAdminApp } from "@/lib/kahoot/firebase-admin";
import { requireKahootAdmin } from "@/lib/kahoot/admin-auth";
import { getQuiz } from "@/lib/kahoot/firestore";
import type { GameAnswer, GamePlayer, GameState } from "@/lib/kahoot/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENV = process.env.NEXT_PUBLIC_FIREBASE_ENV ?? "dev";
const BASE_POINTS = 500;
const SPEED_BONUS_MAX = 500;

export async function POST(request: NextRequest) {
  try {
    requireKahootAdmin(request);

    const body = (await request.json()) as {
      gameId: string;
      completedQuestionIndex: number;
    };

    const { gameId, completedQuestionIndex } = body;

    if (
      typeof gameId !== "string" ||
      !gameId.trim() ||
      typeof completedQuestionIndex !== "number" ||
      completedQuestionIndex < 0
    ) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "gameId y completedQuestionIndex son requeridos." },
        { status: 400 },
      );
    }

    const db = getAdminApp();
    const scoredRef = db.ref(`${ENV}/games/${gameId}/scoredQuestions/${completedQuestionIndex}`);

    // Idempotency lock: solo el primer llamante completa el scoring.
    const lockResult = await scoredRef.transaction((current) => {
      if (current !== null) return; // ya scoring — abortar
      return { scoredAt: Date.now() };
    });

    if (!lockResult.committed) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Leer respuestas, jugadores y estado del juego en paralelo.
    const [answersSnap, playersSnap, gameSnap] = await Promise.all([
      db.ref(`${ENV}/games/${gameId}/answers/${completedQuestionIndex}`).get(),
      db.ref(`${ENV}/games/${gameId}/players`).get(),
      db.ref(`${ENV}/games/${gameId}`).get(),
    ]);

    if (!gameSnap.exists()) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Partida no encontrada." },
        { status: 404 },
      );
    }

    const game = gameSnap.val() as GameState;
    const quiz = await getQuiz(game.quizId);
    if (!quiz) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Quiz no encontrado." },
        { status: 404 },
      );
    }

    const question = quiz.questions[completedQuestionIndex];
    if (!question) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "Índice de pregunta fuera de rango." },
        { status: 400 },
      );
    }

    const answers = answersSnap.exists()
      ? (answersSnap.val() as Record<string, GameAnswer>)
      : {};
    const players = playersSnap.exists()
      ? (playersSnap.val() as Record<string, GamePlayer>)
      : {};

    const startedAt = game.currentQuestion?.startedAt ?? Date.now();

    type Correct = { playerId: string; effectiveMs: number };
    const correct: Correct[] = [];

    for (const [playerId, answer] of Object.entries(answers)) {
      if (answer.optionIndex !== question.correctIndex) continue;
      const effectiveMs =
        typeof answer.submittedAt === "number" && Number.isFinite(startedAt)
          ? Math.max(0, answer.submittedAt - startedAt)
          : Math.max(0, answer.timeMs);
      correct.push({ playerId, effectiveMs });
    }

    correct.sort((a, b) => a.effectiveMs - b.effectiveMs);
    const n = correct.length;

    const gained = new Map<string, number>();
    correct.forEach(({ playerId }, rank) => {
      const speedBonus = n === 1
        ? SPEED_BONUS_MAX
        : Math.round(SPEED_BONUS_MAX * (1 - (rank / (n - 1)) * 0.8));
      gained.set(playerId, BASE_POINTS + speedBonus);
    });

    const scoreUpdates: Record<string, unknown> = {};
    for (const [playerId, player] of Object.entries(players)) {
      const pts = gained.get(playerId) ?? 0;
      scoreUpdates[`${ENV}/games/${gameId}/players/${playerId}/score`] = (player.score ?? 0) + pts;
      scoreUpdates[`${ENV}/games/${gameId}/players/${playerId}/lastGain`] = pts;
      scoreUpdates[`${ENV}/games/${gameId}/players/${playerId}/lastQuestionIndex`] = completedQuestionIndex;
    }

    if (Object.keys(scoreUpdates).length) {
      await db.ref().update(scoreUpdates);
    }

    await db
      .ref(`${ENV}/games/${gameId}/currentQuestion/correctIndex`)
      .set(question.correctIndex);

    return NextResponse.json({ ok: true, scored: Object.keys(scoreUpdates).length / 3 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

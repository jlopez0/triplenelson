import { NextRequest, NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/bizum/http";
import { getAdminApp } from "@/lib/kahoot/firebase-admin";
import { requireKahootAdmin } from "@/lib/kahoot/admin-auth";
import { getQuiz } from "@/lib/kahoot/firestore";
import type { GameState } from "@/lib/kahoot/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENV = process.env.NEXT_PUBLIC_FIREBASE_ENV ?? "dev";

export async function POST(request: NextRequest) {
  try {
    requireKahootAdmin(request);

    const body = (await request.json()) as { gameId: string };
    const { gameId } = body;

    if (typeof gameId !== "string" || !gameId.trim()) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "gameId requerido." },
        { status: 400 },
      );
    }

    const db = getAdminApp();
    const gameSnap = await db.ref(`${ENV}/games/${gameId}`).get();
    if (!gameSnap.exists()) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Partida no encontrada." },
        { status: 404 },
      );
    }

    const game = gameSnap.val() as GameState;
    if (game.status !== "question" || game.currentQuestionIndex < 0) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const quiz = await getQuiz(game.quizId);
    if (!quiz) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Quiz no encontrado." },
        { status: 404 },
      );
    }

    const question = quiz.questions[game.currentQuestionIndex];
    if (!question) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "Índice de pregunta fuera de rango." },
        { status: 400 },
      );
    }

    await db
      .ref(`${ENV}/games/${gameId}/currentQuestion/correctIndex`)
      .set(question.correctIndex);

    return NextResponse.json({ ok: true, correctIndex: question.correctIndex });
  } catch (error) {
    return toErrorResponse(error);
  }
}

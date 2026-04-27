import { NextRequest, NextResponse } from "next/server";
import {
  deleteQuiz,
  getQuiz,
  updateQuiz,
} from "@/lib/kahoot/firestore";
import { requireKahootAdmin, toKahootErrorResponse } from "@/lib/kahoot/admin-auth";
import type { QuizInput } from "@/lib/kahoot/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = {
  params: {
    quizId: string;
  };
};

export async function GET(request: NextRequest, context: Context) {
  try {
    requireKahootAdmin(request);
    const quiz = await getQuiz(context.params.quizId);
    if (!quiz) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Quiz no encontrado." },
        { status: 404 },
      );
    }
    return NextResponse.json({ quiz });
  } catch (error) {
    return toKahootErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    requireKahootAdmin(request);
    const body = (await request.json()) as QuizInput;
    const quiz = await updateQuiz(context.params.quizId, body);
    return NextResponse.json({ quiz });
  } catch (error) {
    return toKahootErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    requireKahootAdmin(request);
    await deleteQuiz(context.params.quizId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toKahootErrorResponse(error);
  }
}

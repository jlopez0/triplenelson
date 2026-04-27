import { NextRequest, NextResponse } from "next/server";
import { createQuiz, getQuizzes } from "@/lib/kahoot/firestore";
import { requireKahootAdmin, toKahootErrorResponse } from "@/lib/kahoot/admin-auth";
import type { QuizInput } from "@/lib/kahoot/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    requireKahootAdmin(request);
    const quizzes = await getQuizzes();
    return NextResponse.json({ quizzes });
  } catch (error) {
    return toKahootErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireKahootAdmin(request);
    const body = (await request.json()) as QuizInput;
    const quiz = await createQuiz(body);
    return NextResponse.json({ quiz });
  } catch (error) {
    return toKahootErrorResponse(error);
  }
}

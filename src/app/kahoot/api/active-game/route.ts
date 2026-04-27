import { NextRequest, NextResponse } from "next/server";
import { getAdminApp } from "@/lib/kahoot/firebase-admin";
import { requireKahootAdmin, toKahootErrorResponse } from "@/lib/kahoot/admin-auth";

export const runtime = "nodejs";

const ENV = process.env.NEXT_PUBLIC_FIREBASE_ENV ?? "dev";

function activeRef() {
  return getAdminApp().ref(`${ENV}/activeGame`);
}

export async function GET() {
  try {
    const snap = await activeRef().get();
    const gameId: string | null = snap.exists() ? (snap.val() as string) : null;
    return NextResponse.json({ gameId });
  } catch (error) {
    return toKahootErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireKahootAdmin(request);
    const body = (await request.json()) as { gameId?: string | null };
    const gameId = body.gameId?.trim() || null;
    await activeRef().set(gameId);
    return NextResponse.json({ ok: true, gameId });
  } catch (error) {
    return toKahootErrorResponse(error);
  }
}

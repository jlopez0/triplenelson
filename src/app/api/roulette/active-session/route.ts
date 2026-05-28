import { NextRequest, NextResponse } from "next/server";
import { getAdminApp } from "@/lib/kahoot/firebase-admin";
import { requireKahootAdmin, toKahootErrorResponse } from "@/lib/kahoot/admin-auth";

export const runtime = "nodejs";

const ENV = process.env.NEXT_PUBLIC_FIREBASE_ENV ?? "dev";

function activeRef() {
  return getAdminApp().ref(`${ENV}/activeRouletteSession`);
}

export async function GET() {
  try {
    const snap = await activeRef().get();
    const sessionId: string | null = snap.exists() ? (snap.val() as string) : null;
    return NextResponse.json({ sessionId });
  } catch (error) {
    return toKahootErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireKahootAdmin(request);
    const body = (await request.json()) as { sessionId?: string | null };
    const sessionId = body.sessionId?.trim() || null;
    await activeRef().set(sessionId);
    return NextResponse.json({ ok: true, sessionId });
  } catch (error) {
    return toKahootErrorResponse(error);
  }
}

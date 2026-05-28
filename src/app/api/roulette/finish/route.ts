import { NextRequest, NextResponse } from "next/server";
import { getAdminApp } from "@/lib/kahoot/firebase-admin";
import { requireKahootAdmin, toKahootErrorResponse } from "@/lib/kahoot/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENV = process.env.NEXT_PUBLIC_FIREBASE_ENV ?? "dev";

export async function POST(request: NextRequest) {
  try {
    requireKahootAdmin(request);

    const body = (await request.json()) as { sessionId?: string };
    const sessionId = body.sessionId;
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "sessionId requerido." },
        { status: 400 },
      );
    }

    const db = getAdminApp();
    const sessionRef = db.ref(`${ENV}/roulette/${sessionId}`);

    const tx = await sessionRef.transaction((current: { status?: string } | null) => {
      if (!current) return current;
      if (current.status === "finished") return current; // idempotente
      return { ...current, status: "finished" };
    });

    if (!tx.committed && !tx.snapshot?.exists()) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Sesión no encontrada." },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toKahootErrorResponse(error);
  }
}

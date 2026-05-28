import { NextRequest, NextResponse } from "next/server";
import { getAdminApp } from "@/lib/kahoot/firebase-admin";
import { requireKahootAdmin, toKahootErrorResponse } from "@/lib/kahoot/admin-auth";
import type { RoulettePlayer, RouletteSession } from "@/lib/roulette/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENV = process.env.NEXT_PUBLIC_FIREBASE_ENV ?? "dev";

function basePath(sessionId: string): string {
  return `${ENV}/roulette/${sessionId}`;
}

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
    const sessionRef = db.ref(basePath(sessionId));

    // Lock idempotente sobre status: solo el primer llamante avanza la ronda.
    const tx = await sessionRef.transaction((current: RouletteSession | null) => {
      if (!current) return current;
      if (current.status !== "result") return; // abortar: no es estado válido para avanzar
      return {
        ...current,
        status: "betting_open",
        currentRound: {
          index: (current.currentRound?.index ?? 0) + 1,
          startedAt: Date.now(),
          timeLimit: 30,
          result: null,
          color: null,
          allBetsIn: false,
        },
      };
    });

    if (!tx.committed) {
      // Otro llamante ya avanzó (o no estaba en "result"). Idempotente: OK skipped.
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Reset de apuestas por jugador — separado porque depende de qué jugadores existan ahora.
    const playersSnap = await db.ref(`${basePath(sessionId)}/players`).get();
    const players = playersSnap.exists()
      ? (playersSnap.val() as Record<string, RoulettePlayer>)
      : {};

    const updates: Record<string, unknown> = {};
    for (const playerId of Object.keys(players)) {
      const base = `${basePath(sessionId)}/players/${playerId}`;
      updates[`${base}/hasBet`] = false;
      updates[`${base}/bets`] = [];
    }
    if (Object.keys(updates).length) {
      await db.ref().update(updates);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toKahootErrorResponse(error);
  }
}

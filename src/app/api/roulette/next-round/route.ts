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
    const base = basePath(sessionId);

    // Lock idempotente: solo el primer llamante avanza desde "result".
    const lockRef = db.ref(`${base}/status`);
    const lockTx = await lockRef.transaction((current: string | null) => {
      if (current !== "result") return; // abortar
      return "advancing"; // estado temporal para bloquear otros llamantes
    });
    if (!lockTx.committed) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Leer players ANTES de escribir el nuevo status, para incluir hasBet=false
    // en el mismo update atómico — evita la ventana donde status=betting_open
    // pero hasBet sigue en true de la ronda anterior (lo que dispara checkAllBetsIn prematuramente).
    const [sessionSnap, playersSnap] = await Promise.all([
      db.ref(base).get(),
      db.ref(`${base}/players`).get(),
    ]);

    if (!sessionSnap.exists()) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    const session = sessionSnap.val() as RouletteSession;
    const players = playersSnap.exists()
      ? (playersSnap.val() as Record<string, RoulettePlayer>)
      : {};

    const nextIndex = (session.currentRound?.index ?? 0) + 1;

    // Un solo update atómico: nuevo status + nueva ronda + reset de apuestas.
    const updates: Record<string, unknown> = {
      [`${base}/status`]: "betting_open",
      [`${base}/currentRound`]: {
        index: nextIndex,
        startedAt: Date.now(),
        timeLimit: 30,
        result: null,
        color: null,
        allBetsIn: false,
      },
    };
    for (const playerId of Object.keys(players)) {
      updates[`${base}/players/${playerId}/hasBet`] = false;
      updates[`${base}/players/${playerId}/bets`] = [];
    }
    await db.ref().update(updates);

    return NextResponse.json({ ok: true, round: nextIndex });
  } catch (error) {
    return toKahootErrorResponse(error);
  }
}

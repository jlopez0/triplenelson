import { NextRequest, NextResponse } from "next/server";
import { getAdminApp } from "@/lib/kahoot/firebase-admin";
import { requireKahootAdmin, toKahootErrorResponse } from "@/lib/kahoot/admin-auth";
import type { RouletteSession } from "@/lib/roulette/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENV = process.env.NEXT_PUBLIC_FIREBASE_ENV ?? "dev";

export async function POST(req: NextRequest) {
  try {
    requireKahootAdmin(req);
    const { sessionId } = await req.json();
    if (!sessionId) return NextResponse.json({ error: "sessionId requerido." }, { status: 400 });

    const db = getAdminApp();
    const sessionRef = db.ref(`${ENV}/roulette/${sessionId}`);

    // Transacción idempotente: solo el primer llamante hace la transición lobby → betting_open.
    const tx = await sessionRef.transaction((current: RouletteSession | null) => {
      if (!current) return current;
      if (current.status !== "lobby") return; // abortar — ya empezó
      return {
        ...current,
        status: "betting_open",
        currentRound: {
          index: 1,
          startedAt: Date.now(),
          timeLimit: 30,
          result: null,
          color: null,
          allBetsIn: false,
        },
      };
    });

    if (!tx.committed) {
      const snap = tx.snapshot;
      if (!snap?.exists()) {
        return NextResponse.json({ error: "Sesión no encontrada." }, { status: 404 });
      }
      return NextResponse.json({ error: "La partida ya ha empezado." }, { status: 409 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toKahootErrorResponse(err);
  }
}

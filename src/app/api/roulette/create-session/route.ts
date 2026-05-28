import { NextRequest, NextResponse } from "next/server";
import { getAdminApp } from "@/lib/kahoot/firebase-admin";
import { requireKahootAdmin, toKahootErrorResponse } from "@/lib/kahoot/admin-auth";
import type { RouletteConfig, RouletteSession } from "@/lib/roulette/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENV = process.env.NEXT_PUBLIC_FIREBASE_ENV ?? "dev";

function randomSessionId(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: NextRequest) {
  try {
    requireKahootAdmin(req);
    const body = await req.json().catch(() => ({}));
    const initialCredits = Math.max(
      100,
      Math.min(100000, Math.floor(Number(body.initialCredits) || 1000)),
    );

    const db = getAdminApp();

    for (let i = 0; i < 8; i++) {
      const sessionId = randomSessionId();
      const sessionRef = db.ref(`${ENV}/roulette/${sessionId}`);
      const session: RouletteSession = {
        status: "lobby",
        config: { initialCredits, createdAt: Date.now() } satisfies RouletteConfig,
        currentRound: {
          index: 0,
          startedAt: 0,
          timeLimit: 30,
          result: null,
          color: null,
          allBetsIn: false,
        },
      };
      // Transacción: solo crea si no existe — evita pisar sesiones concurrentes.
      const tx = await sessionRef.transaction((current) => {
        if (current !== null) return; // abortar: ID ocupado
        return session;
      });
      if (tx.committed) {
        return NextResponse.json({ sessionId });
      }
    }

    return NextResponse.json({ error: "No se pudo generar ID único." }, { status: 500 });
  } catch (err) {
    return toKahootErrorResponse(err);
  }
}

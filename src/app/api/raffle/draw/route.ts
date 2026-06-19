import { NextRequest, NextResponse } from "next/server";
import { requireKahootAdmin, toKahootErrorResponse } from "@/lib/kahoot/admin-auth";
import { getAdminApp } from "@/lib/kahoot/firebase-admin";
import { pickWinner } from "@/lib/raffle/pool";
import { poolStore } from "@/lib/raffle/pool-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENV = process.env.NEXT_PUBLIC_FIREBASE_ENV ?? "dev";

export async function POST(request: NextRequest) {
  try {
    requireKahootAdmin(request);

    const body = (await request.json()) as { sessionId?: string };
    const sessionId = (body.sessionId ?? "").trim();
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId requerido." }, { status: 400 });
    }

    const papeletas = poolStore.get(sessionId);
    if (!papeletas || papeletas.length === 0) {
      return NextResponse.json(
        { error: "Pool no cargado. Pulsa 'Cargar participantes' primero." },
        { status: 400 },
      );
    }

    const winner = pickWinner(papeletas);
    const rtdb = getAdminApp();
    const sessionRef = rtdb.ref(`${ENV}/raffle/${sessionId}`);

    // Leer el índice actual
    const snap = await sessionRef.child("currentDraw/index").get();
    const currentIndex = snap.exists() ? (snap.val() as number) : 0;
    const nextIndex = currentIndex + 1;

    const drawResult = {
      draw: nextIndex,
      winnerName: winner.name,
      winnerIntentId: winner.intentId,
    };

    // Escribir en RTDB: spinning + ganador ya disponible (el cliente anima)
    await sessionRef.update({
      status: "spinning",
      "currentDraw/index": nextIndex,
      "currentDraw/winnerName": winner.name,
      "currentDraw/winnerIntentId": winner.intentId,
    });

    // Añadir al historial
    await sessionRef.child("history").push(drawResult);

    return NextResponse.json({ ok: true, winner: drawResult });
  } catch (error) {
    return toKahootErrorResponse(error);
  }
}

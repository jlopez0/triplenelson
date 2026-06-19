import { NextRequest, NextResponse } from "next/server";
import { requireKahootAdmin, toKahootErrorResponse } from "@/lib/kahoot/admin-auth";
import { getAdminApp } from "@/lib/kahoot/firebase-admin";
import { getDb } from "@/lib/bizum/firebase";
import { readDbSnapshot } from "@/lib/bizum/store";
import { buildPapeletas, countUniqueParticipants, type PaidTicket } from "@/lib/raffle/pool";
import { poolStore } from "@/lib/raffle/pool-store";
import type { TicketDoc } from "@/lib/tickets/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENV = process.env.NEXT_PUBLIC_FIREBASE_ENV ?? "dev";

function ticketsCollection(): string {
  return process.env.BIZUM_ENV === "dev" ? "tickets_dev" : "tickets";
}

export async function POST(request: NextRequest) {
  try {
    requireKahootAdmin(request);

    const body = (await request.json()) as { sessionId?: string; jcoins?: number; demo?: boolean };
    const sessionId = (body.sessionId ?? "").trim();
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId requerido." }, { status: 400 });
    }
    const jcoins = Math.max(1, Math.round(Number(body.jcoins ?? 100)));
    const demo = body.demo === true;

    // Leer tickets validados (used: true) de Firestore
    const collection = demo ? "tickets_demo" : ticketsCollection();
    const firestore = await getDb();
    const snap = await firestore
      .collection(collection)
      .where("used", "==", true)
      .get();

    const usedTickets = snap.docs.map((d) => d.data() as TicketDoc);

    // Construir mapa intentId → buyerName desde los intents PAID (fuente de verdad para el nombre)
    const db = await readDbSnapshot();
    const intentNameMap = new Map<string, string | null>(
      db.payment_intents
        .filter((i) => i.status === "PAID")
        .map((i) => [i.id, i.buyerName ?? null]),
    );

    // Una papeleta por ticket validado, nombre desde el intent
    const tickets: PaidTicket[] = usedTickets.map((t) => ({
      intentId: t.intentId,
      buyerName: intentNameMap.get(t.intentId) ?? t.buyerName ?? null,
    }));

    const papeletas = buildPapeletas(tickets);

    if (papeletas.length === 0) {
      return NextResponse.json(
        { error: "No hay entradas validadas en el escáner todavía." },
        { status: 400 },
      );
    }

    poolStore.set(sessionId, papeletas);

    const rtdb = getAdminApp();
    await rtdb.ref(`${ENV}/raffle/${sessionId}`).set({
      status: "idle",
      poolSize: papeletas.length,
      uniqueParticipants: countUniqueParticipants(papeletas),
      jcoins,
      currentDraw: { index: 0, winnerName: null, winnerIntentId: null },
      history: [],
    });

    return NextResponse.json({
      ok: true,
      sessionId,
      poolSize: papeletas.length,
      uniqueParticipants: countUniqueParticipants(papeletas),
    });
  } catch (error) {
    return toKahootErrorResponse(error);
  }
}

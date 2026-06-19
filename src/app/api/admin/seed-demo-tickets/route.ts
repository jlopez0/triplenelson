import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, toErrorResponse } from "@/lib/bizum/http";
import { getDb } from "@/lib/bizum/firebase";
import type { TicketDoc } from "@/lib/tickets/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEMO_NAMES = [
  "JAVI", "JEAN QUIROGA", "TRUJA", "DIVI", "ANTØNIK",
  "MEXE", "WA:DA", "LÁTIGO", "DJ LOMAS", "DJ ALI",
  "JIMBO", "TABU VIVAR", "KBNUX", "SARA", "CARLOS",
  "ELENA", "MIGUEL", "NATALIA", "OSCAR", "PATRICIA",
];

function randomHex(n: number): string {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join("");
}

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);

    const body = (await request.json().catch(() => ({}))) as { count?: number; reset?: boolean; used?: boolean };
    const count = Math.min(50, Math.max(1, Number(body.count ?? 20)));
    const reset = body.reset === true;
    const used = body.used !== false; // default true, pasar used:false para sin validar

    const db = await getDb();
    const col = db.collection("tickets_demo");

    if (reset) {
      const existing = await col.get();
      const batch = db.batch();
      existing.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    const now = new Date().toISOString();
    const batch = db.batch();
    const created: string[] = [];

    for (let i = 0; i < count; i++) {
      const ticketCode = `TN-${randomHex(10)}`;
      const name = DEMO_NAMES[i % DEMO_NAMES.length];
      const ticket: TicketDoc = {
        ticketCode,
        intentId: `demo-intent-${randomHex(6)}`,
        eventId: "triple-nelson-2026",
        buyerName: name,
        buyerEmail: `${name.toLowerCase().replace(/\s/g, "")}@demo.test`,
        ticketType: "DEMO",
        amountCents: 2000,
        position: 1,
        totalInIntent: 1,
        receiverId: "receiver-1",
        paidAt: now,
        used,
        usedAt: used ? now : null,
        usedBy: null,
      };
      batch.set(col.doc(ticketCode), ticket);
      created.push(ticketCode);
    }

    await batch.commit();

    return NextResponse.json({ ok: true, created: created.length, tickets: created });
  } catch (error) {
    return toErrorResponse(error);
  }
}

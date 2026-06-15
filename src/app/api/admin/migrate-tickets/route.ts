import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, toErrorResponse } from "@/lib/bizum/http";
import { readDbSnapshot } from "@/lib/bizum/store";
import { createTicketIfNotExists } from "@/lib/tickets/firestore";
import type { TicketDoc } from "@/lib/tickets/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Migración one-shot: lee todos los PaymentIntents PAID con ticketCodes,
 * crea (idempotente) un doc por ticket en la colección `tickets` / `tickets_dev`.
 *
 * Llamar con:
 *   curl -X POST -H "x-admin-token: ..." https://triplenelson.com/api/admin/migrate-tickets
 *
 * Idempotente: si los docs ya existen, los cuenta como `skipped`.
 */
export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);

    const db = await readDbSnapshot();
    let created = 0;
    let skipped = 0;
    let intentsProcessed = 0;
    const errors: Array<{ intentId: string; reason: string }> = [];

    for (const intent of db.payment_intents) {
      if (intent.status !== "PAID") continue;
      const codes = intent.ticketCodes ?? [];
      if (!codes.length) continue;
      intentsProcessed += 1;

      for (let i = 0; i < codes.length; i += 1) {
        const ticketCode = codes[i];
        const ticket: TicketDoc = {
          ticketCode,
          intentId: intent.id,
          eventId: intent.eventId,
          buyerName: intent.buyerName ?? null,
          buyerEmail: intent.userKey,
          ticketType: intent.ticketType ?? null,
          // amountCents en el intent es el total; dividimos entre quantity para precio unitario
          amountCents: Math.round(intent.amountCents / Math.max(1, intent.quantity)),
          position: i + 1,
          totalInIntent: codes.length,
          receiverId: intent.receiverId,
          paidAt: intent.paidAt ?? intent.updatedAt ?? intent.createdAt,
          used: false,
          usedAt: null,
          usedBy: null,
        };

        try {
          const wasCreated = await createTicketIfNotExists(ticket);
          if (wasCreated) created += 1;
          else skipped += 1;
        } catch (err) {
          errors.push({
            intentId: intent.id,
            reason: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      intentsProcessed,
      created,
      skipped,
      errors,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

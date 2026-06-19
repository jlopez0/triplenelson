import { getDb } from "@/lib/bizum/firebase";
import type { TicketDoc, ValidationResult } from "./types";

function collectionName(demo = false): string {
  if (demo) return "tickets_demo";
  return process.env.BIZUM_ENV === "dev" ? "tickets_dev" : "tickets";
}

export async function createTicketIfNotExists(ticket: TicketDoc): Promise<boolean> {
  const db = await getDb();
  const ref = db.collection(collectionName()).doc(ticket.ticketCode);
  try {
    await ref.create(ticket);
    return true;
  } catch (err: unknown) {
    // `create` falla si el doc ya existe — eso es lo que queremos para idempotencia.
    const code = (err as { code?: number | string })?.code;
    if (code === 6 || code === "already-exists") return false;
    throw err;
  }
}

export async function getTicket(ticketCode: string): Promise<TicketDoc | null> {
  const db = await getDb();
  const snap = await db.collection(collectionName()).doc(ticketCode).get();
  if (!snap.exists) return null;
  return snap.data() as TicketDoc;
}

export async function listAllTicketCodes(demo = false): Promise<string[]> {
  const db = await getDb();
  const snap = await db
    .collection(collectionName(demo))
    .select() // solo IDs, no payload — más rápido
    .get();
  return snap.docs.map((d) => d.id);
}

/**
 * Valida y marca el ticket como usado en una sola transacción atómica.
 * Si ya estaba usado devuelve DUPLICATE con datos para que el validador vea cuándo se usó.
 */
export async function validateAndMarkUsed(
  ticketCode: string,
  validator: string,
  demo = false,
): Promise<ValidationResult> {
  const db = await getDb();
  const ref = db.collection(collectionName(demo)).doc(ticketCode);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      return { status: "NOT_FOUND" as const };
    }
    const ticket = snap.data() as TicketDoc;

    if (ticket.used) {
      return { status: "DUPLICATE" as const, ticket };
    }

    const usedAt = new Date().toISOString();
    tx.update(ref, { used: true, usedAt, usedBy: validator });
    return {
      status: "OK" as const,
      ticket: { ...ticket, used: true, usedAt, usedBy: validator },
    };
  });
}

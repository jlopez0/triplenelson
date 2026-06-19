import type { Papeleta } from "./types";

export interface PaidTicket {
  intentId: string;
  buyerName: string | null;
}

/**
 * Cada doc en la colección `tickets` con status implícito PAID representa
 * una papeleta. Ya viene expandido: un intent con quantity=3 generó 3 docs.
 * Simplemente mapeamos 1 doc → 1 papeleta.
 */
export function buildPapeletas(tickets: PaidTicket[]): Papeleta[] {
  return tickets.map((t) => ({
    name: t.buyerName?.trim() || `Participante ${t.intentId.slice(-6)}`,
    intentId: t.intentId,
  }));
}

/**
 * Selección aleatoria criptográficamente segura.
 * NUNCA usa Math.random().
 */
export function pickWinner(papeletas: Papeleta[]): Papeleta {
  if (papeletas.length === 0) throw new Error("El pool está vacío.");

  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const index = array[0] % papeletas.length;
  return papeletas[index];
}

export function countUniqueParticipants(papeletas: Papeleta[]): number {
  return new Set(papeletas.map((p) => p.name.toLowerCase())).size;
}

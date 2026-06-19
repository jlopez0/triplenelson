import { NextRequest, NextResponse } from "next/server";
import { requireValidator, toValidatorErrorResponse } from "@/lib/tickets/auth";
import { listAllTicketCodes } from "@/lib/tickets/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Devuelve la lista completa de ticketCodes válidos para el modo offline.
 * El escáner la guarda en localStorage e IndexedDB.
 *
 * Para 76 tickets en prod, el payload es ~1KB. Sin paginación.
 */
export async function GET(request: NextRequest) {
  try {
    requireValidator(request);
    const demo = request.nextUrl.searchParams.get("demo") === "1";
    const codes = await listAllTicketCodes(demo);
    return NextResponse.json({
      ticketCodes: codes,
      fetchedAt: new Date().toISOString(),
      count: codes.length,
    });
  } catch (error) {
    return toValidatorErrorResponse(error);
  }
}

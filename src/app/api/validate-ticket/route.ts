import { NextRequest, NextResponse } from "next/server";
import { requireValidator, toValidatorErrorResponse } from "@/lib/tickets/auth";
import { validateAndMarkUsed } from "@/lib/tickets/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Extrae el ticketCode de un payload de QR.
 * Soporta dos formatos:
 *  - JSON: {"ticketCode":"TN-XXXXXXXXXX",...}
 *  - String plano: "TN-XXXXXXXXXX"
 */
function extractTicketCode(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("{")) {
    try {
      const obj = JSON.parse(trimmed) as { ticketCode?: unknown };
      if (typeof obj.ticketCode === "string") return obj.ticketCode.trim().toUpperCase();
    } catch {
      // continúa al fallback
    }
  }

  // Validar formato TN-XXXXXXXXXX
  const match = trimmed.toUpperCase().match(/TN-[A-F0-9]{10}/);
  return match ? match[0] : null;
}

export async function POST(request: NextRequest) {
  try {
    const actor = requireValidator(request);

    const body = (await request.json().catch(() => ({}))) as {
      qrPayload?: string;
      validator?: string;
    };

    const ticketCode = extractTicketCode(body.qrPayload ?? "");
    if (!ticketCode) {
      return NextResponse.json(
        { status: "NOT_FOUND", message: "QR sin código válido." },
        { status: 200 },
      );
    }

    const validatorLabel = (body.validator ?? "").toString().slice(0, 40) || actor;
    const result = await validateAndMarkUsed(ticketCode, validatorLabel);

    return NextResponse.json(result);
  } catch (error) {
    return toValidatorErrorResponse(error);
  }
}

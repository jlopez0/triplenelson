import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, toErrorResponse } from "@/lib/bizum/http";
import { getDb } from "@/lib/bizum/firebase";
import type { TicketDoc } from "@/lib/tickets/types";
import QRCode from "qrcode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    requireAdmin(request);
    const db = await getDb();
    const snap = await db.collection("tickets_demo").get();
    const tickets = await Promise.all(
      snap.docs.map(async (d) => {
        const t = d.data() as TicketDoc;
        const qr = await QRCode.toDataURL(JSON.stringify({ ticketCode: t.ticketCode }), {
          width: 220,
          margin: 1,
        });
        return { ticketCode: t.ticketCode, buyerName: t.buyerName, used: t.used, qr };
      }),
    );
    tickets.sort((a, b) => (a.buyerName ?? "").localeCompare(b.buyerName ?? ""));
    return NextResponse.json({ tickets });
  } catch (error) {
    return toErrorResponse(error);
  }
}

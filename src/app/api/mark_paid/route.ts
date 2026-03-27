import { NextRequest, NextResponse } from "next/server";
import { markPaid } from "@/lib/bizum/service";
import { getClientIp, requireAdmin, toErrorResponse } from "@/lib/bizum/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const adminKey = requireAdmin(request);
    const body = (await request.json()) as { intentId?: string };
    const result = await markPaid({
      intentId: body.intentId ?? "",
      adminKey,
      ip: getClientIp(request),
    });

    return NextResponse.json({
      ok: true,
      intent: result.intent,
      qrPayloads: result.qrPayloads,
      emailDelivery: result.emailDelivery,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

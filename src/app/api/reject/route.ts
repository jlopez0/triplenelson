import { NextRequest, NextResponse } from "next/server";
import { rejectIntent } from "@/lib/bizum/service";
import { getClientIp, requireAdmin, toErrorResponse } from "@/lib/bizum/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const adminKey = requireAdmin(request);
    const body = (await request.json()) as { intentId?: string; reason?: string };
    const intent = await rejectIntent({
      intentId: body.intentId ?? "",
      reason: body.reason,
      adminKey,
      ip: getClientIp(request),
    });

    return NextResponse.json({
      ok: true,
      intent,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

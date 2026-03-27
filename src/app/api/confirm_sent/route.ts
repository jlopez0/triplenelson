import { NextRequest, NextResponse } from "next/server";
import { confirmSent } from "@/lib/bizum/service";
import { getClientIp, toErrorResponse } from "@/lib/bizum/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { intentId?: string; userKey?: string };
    const intent = await confirmSent({
      intentId: body.intentId ?? "",
      userKey: body.userKey ?? "",
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

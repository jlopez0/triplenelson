import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, toErrorResponse } from "@/lib/bizum/http";
import { resendTicketsEmail } from "@/lib/bizum/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);
    const body = (await request.json()) as { intentId?: string };
    const intentId = (body.intentId ?? "").trim();
    if (!intentId) {
      return NextResponse.json({ error: "intentId requerido." }, { status: 400 });
    }
    const result = await resendTicketsEmail({ intentId });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return toErrorResponse(error);
  }
}

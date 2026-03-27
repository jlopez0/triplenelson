import { NextRequest, NextResponse } from "next/server";
import { deleteIntent, updateIntent } from "@/lib/bizum/service";
import { getClientIp, requireAdmin, toErrorResponse } from "@/lib/bizum/http";
import type { PaymentIntentStatus } from "@/lib/bizum/types";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ intentId: string }> }) {
  try {
    const adminKey = requireAdmin(request);
    const { intentId } = await params;
    const body = (await request.json()) as {
      userKey?: string;
      buyerName?: string;
      ticketType?: string;
      quantity?: number;
      amountCents?: number;
      receiverPhone?: string;
      status?: PaymentIntentStatus;
    };
    const intent = await updateIntent({ intentId, adminKey, ip: getClientIp(request), patch: body });
    return NextResponse.json({ ok: true, intent });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ intentId: string }> }) {
  try {
    const adminKey = requireAdmin(request);
    const { intentId } = await params;
    const result = await deleteIntent({
      intentId,
      adminKey,
      ip: getClientIp(request),
    });
    return NextResponse.json({ ok: true, id: result.id });
  } catch (error) {
    return toErrorResponse(error);
  }
}

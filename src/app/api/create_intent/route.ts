import { NextRequest, NextResponse } from "next/server";
import { createOrReuseIntent } from "@/lib/bizum/service";
import { getClientIp, toErrorResponse } from "@/lib/bizum/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { eventId?: string; userKey?: string; buyerName?: string; quantity?: number; knowsBilly?: boolean };
    const result = await createOrReuseIntent({
      eventId: body.eventId,
      userKey: body.userKey ?? "",
      buyerName: body.buyerName,
      quantity: body.quantity,
      knowsBilly: body.knowsBilly,
      ip: getClientIp(request),
    });

    return NextResponse.json({
      reused: result.reused,
      intentId: result.intent.id,
      paymentRef: result.intent.paymentRef,
      quantity: result.intent.quantity,
      phone: result.intent.receiverPhone,
      amount: Number((result.intent.amountCents / 100).toFixed(2)),
      amountCents: result.intent.amountCents,
      currency: result.intent.currency,
      expiresAt: result.intent.expiresAt,
      status: result.intent.status,
      eventId: result.event.id,
      eventName: result.event.name,
      contactEmail: process.env.BIZUM_CONTACT_EMAIL ?? "",
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

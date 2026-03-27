import { NextRequest, NextResponse } from "next/server";
import { listAdminIntents } from "@/lib/bizum/service";
import { requireAdmin, toErrorResponse } from "@/lib/bizum/http";
import type { PaymentIntentStatus } from "@/lib/bizum/types";

export const runtime = "nodejs";

const validStatuses: PaymentIntentStatus[] = [
  "CREATED",
  "USER_CONFIRMED",
  "PAID",
  "REJECTED",
  "EXPIRED",
];

export async function GET(request: NextRequest) {
  try {
    requireAdmin(request);
    const statusParam = request.nextUrl.searchParams.get("status") ?? undefined;
    const status = validStatuses.includes(statusParam as PaymentIntentStatus)
      ? (statusParam as PaymentIntentStatus)
      : undefined;

    const receiverId = request.nextUrl.searchParams.get("receiverId") ?? undefined;
    const paymentRef = request.nextUrl.searchParams.get("paymentRef") ?? undefined;
    const from = request.nextUrl.searchParams.get("from") ?? undefined;
    const to = request.nextUrl.searchParams.get("to") ?? undefined;

    const items = await listAdminIntents({ status, receiverId, paymentRef, from, to });
    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse(error);
  }
}

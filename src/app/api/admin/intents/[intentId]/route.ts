import { NextRequest, NextResponse } from "next/server";
import { deleteIntent } from "@/lib/bizum/service";
import { getClientIp, requireAdmin, toErrorResponse } from "@/lib/bizum/http";

export const runtime = "nodejs";

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

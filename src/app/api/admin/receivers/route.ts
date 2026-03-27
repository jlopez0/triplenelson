import { NextRequest, NextResponse } from "next/server";
import { listReceivers } from "@/lib/bizum/service";
import { requireAdmin, toErrorResponse } from "@/lib/bizum/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    requireAdmin(request);
    const items = await listReceivers();
    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse(error);
  }
}

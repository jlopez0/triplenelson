import { NextRequest, NextResponse } from "next/server";
import { requireKahootAdmin, toKahootErrorResponse } from "@/lib/kahoot/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    requireKahootAdmin(request);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toKahootErrorResponse(error);
  }
}

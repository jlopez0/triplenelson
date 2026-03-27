import { NextResponse } from "next/server";
import { getDefaultEvent } from "@/lib/bizum/service";
import { toErrorResponse } from "@/lib/bizum/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const event = await getDefaultEvent();
    return NextResponse.json({ event });
  } catch (error) {
    return toErrorResponse(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getIntentPublic } from "@/lib/bizum/service";
import { toErrorResponse } from "@/lib/bizum/http";

export const runtime = "nodejs";

type Context = {
  params: {
    intentId: string;
  };
};

export async function GET(request: NextRequest, context: Context) {
  try {
    const userKey = request.nextUrl.searchParams.get("userKey") ?? undefined;
    const intent = await getIntentPublic({
      intentId: context.params.intentId,
      userKey,
    });

    return NextResponse.json({ intent });
  } catch (error) {
    return toErrorResponse(error);
  }
}

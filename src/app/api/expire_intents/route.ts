import { NextRequest, NextResponse } from "next/server";
import { expireIntentsJob } from "@/lib/bizum/service";
import { toErrorResponse } from "@/lib/bizum/http";

export const runtime = "nodejs";

function verifyCronToken(request: NextRequest): string {
  const configured = process.env.BIZUM_CRON_TOKEN;
  if (!configured) {
    return "manual";
  }

  const token = request.headers.get("x-cron-token") ?? "";
  if (token !== configured) {
    throw new Error("UNAUTHORIZED_CRON");
  }

  return "cron";
}

export async function POST(request: NextRequest) {
  try {
    const actorKey = verifyCronToken(request);
    const result = await expireIntentsJob({ actorKey });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED_CRON") {
      return NextResponse.json(
        {
          error: "UNAUTHORIZED",
          message: "Invalid cron token.",
        },
        { status: 401 },
      );
    }
    return toErrorResponse(error);
  }
}

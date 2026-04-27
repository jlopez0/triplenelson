import { NextRequest, NextResponse } from "next/server";

const FALLBACK_ADMIN_TOKEN = "dev-admin-token";

export class KahootAuthError extends Error {
  statusCode = 401;

  constructor() {
    super("Admin token required.");
  }
}

export function requireKahootAdmin(request: NextRequest): string {
  const configuredToken = process.env.BIZUM_ADMIN_TOKEN ?? FALLBACK_ADMIN_TOKEN;
  const token =
    request.headers.get("x-admin-token") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    "";

  if (!token || token !== configuredToken) {
    throw new KahootAuthError();
  }

  return token;
}

export function toKahootErrorResponse(error: unknown) {
  if (error instanceof KahootAuthError) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: error.message },
      { status: error.statusCode },
    );
  }

  console.error("[kahoot] Unexpected error:", error);
  return NextResponse.json(
    { error: "INTERNAL_ERROR", message: "Unexpected error." },
    { status: 500 },
  );
}

import { NextRequest, NextResponse } from "next/server";
import { BizumServiceError } from "./service";

const FALLBACK_ADMIN_TOKEN = "dev-admin-token";

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function requireAdmin(request: NextRequest): string {
  const configuredUser = process.env.BIZUM_ADMIN_USER?.trim();
  const configuredPassword = process.env.BIZUM_ADMIN_PASSWORD ?? "";

  if (configuredUser && configuredPassword) {
    const authorization = request.headers.get("authorization") ?? "";
    const match = authorization.match(/^Basic\s+(.+)$/i);
    if (!match) {
      throw new BizumServiceError({
        code: "UNAUTHORIZED",
        statusCode: 401,
        message: "Admin credentials required.",
      });
    }

    let decoded = "";
    try {
      decoded = Buffer.from(match[1], "base64").toString("utf8");
    } catch {
      decoded = "";
    }

    const separator = decoded.indexOf(":");
    const username = separator >= 0 ? decoded.slice(0, separator) : "";
    const password = separator >= 0 ? decoded.slice(separator + 1) : "";

    if (username !== configuredUser || password !== configuredPassword) {
      throw new BizumServiceError({
        code: "UNAUTHORIZED",
        statusCode: 401,
        message: "Invalid admin credentials.",
      });
    }

    return username;
  }

  const configuredToken = process.env.BIZUM_ADMIN_TOKEN ?? FALLBACK_ADMIN_TOKEN;
  const token =
    request.headers.get("x-admin-token") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    "";

  if (!token || token !== configuredToken) {
    throw new BizumServiceError({
      code: "UNAUTHORIZED",
      statusCode: 401,
      message: "Admin token required.",
    });
  }

  return token;
}

export function toErrorResponse(error: unknown) {
  if (error instanceof BizumServiceError) {
    return NextResponse.json(
      {
        error: error.code,
        message: error.message,
        ...error.payload,
      },
      { status: error.statusCode },
    );
  }

  console.error("[bizum] Unexpected error:", error);
  return NextResponse.json(
    {
      error: "INTERNAL_ERROR",
      message: "Unexpected error.",
    },
    { status: 500 },
  );
}

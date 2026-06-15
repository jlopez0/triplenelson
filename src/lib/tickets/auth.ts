import { NextRequest, NextResponse } from "next/server";

export class ValidatorAuthError extends Error {
  statusCode = 401;
  constructor() {
    super("Validator token required.");
  }
}

/**
 * Auth helper para el escáner de tickets en puerta.
 * Acepta el token de validador o el de admin (fallback para superadmin).
 */
export function requireValidator(request: NextRequest): string {
  const validatorToken = process.env.BIZUM_VALIDATOR_TOKEN ?? "";
  const adminToken = process.env.BIZUM_ADMIN_TOKEN ?? "";

  const presented =
    request.headers.get("x-validator-token") ||
    request.headers.get("x-admin-token") ||
    request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim() ||
    "";

  if (!presented) throw new ValidatorAuthError();

  if (validatorToken && presented === validatorToken) return "validator";
  if (adminToken && presented === adminToken) return "admin";

  throw new ValidatorAuthError();
}

export function toValidatorErrorResponse(error: unknown) {
  if (error instanceof ValidatorAuthError) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: error.message },
      { status: error.statusCode },
    );
  }
  console.error("[tickets] Unexpected error:", error);
  return NextResponse.json(
    { error: "INTERNAL_ERROR", message: "Unexpected error." },
    { status: 500 },
  );
}

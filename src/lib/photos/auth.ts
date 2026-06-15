import { NextRequest, NextResponse } from "next/server";
import { isPhotoUploadEnabled, isAdminsOnly } from "./config";

export class PhotoAuthError extends Error {
  statusCode: number;
  code: string;
  constructor(code: string, message: string, statusCode = 401) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

/** Comprueba si el token presentado es el de admin (mismo patrón que Bizum). */
function isAdminToken(request: NextRequest): boolean {
  const adminToken = process.env.BIZUM_ADMIN_TOKEN ?? "";
  if (!adminToken) return false;

  const presented =
    request.headers.get("x-admin-token") ||
    request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim() ||
    "";

  return Boolean(presented) && presented === adminToken;
}

/**
 * Autoriza una SUBIDA de foto aplicando el doble gate.
 *
 *  1) Si la feature está apagada globalmente → 403 FEATURE_DISABLED.
 *  2) Si PHOTO_UPLOAD_ADMINS_ONLY=true → exige token admin.
 *  3) Si PHOTO_UPLOAD_ADMINS_ONLY=false → abierto a asistentes (futuro).
 *     De momento, mientras no haya identidad de asistente, devolvemos
 *     "uploader anónimo" — cuando se abra al público se enchufará aquí
 *     la verificación de identidad real (p.ej. token de entrada validada).
 *
 * Devuelve el identificador de quién sube ("admin" | "attendee").
 *
 * IMPORTANTE: la validación SIEMPRE es en backend; el frontend solo oculta UI.
 */
export function requirePhotoUploader(request: NextRequest): string {
  if (!isPhotoUploadEnabled()) {
    throw new PhotoAuthError(
      "FEATURE_DISABLED",
      "La subida de fotos no está disponible todavía.",
      403,
    );
  }

  if (isAdminsOnly()) {
    if (!isAdminToken(request)) {
      throw new PhotoAuthError(
        "UNAUTHORIZED",
        "Solo administradores pueden subir fotos por ahora.",
        401,
      );
    }
    return "admin";
  }

  // Feature abierta a todos. Si además es admin, lo marcamos como tal.
  return isAdminToken(request) ? "admin" : "attendee";
}

/**
 * Autoriza acciones de GESTIÓN (listar todo, borrar). Siempre solo admin,
 * independientemente de los flags de subida.
 */
export function requirePhotoAdmin(request: NextRequest): string {
  if (!isAdminToken(request)) {
    throw new PhotoAuthError("UNAUTHORIZED", "Se requiere token de admin.", 401);
  }
  return "admin";
}

export function toPhotoErrorResponse(error: unknown) {
  if (error instanceof PhotoAuthError) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: error.statusCode },
    );
  }
  console.error("[photos] Unexpected error:", error);
  return NextResponse.json(
    { error: "INTERNAL_ERROR", message: "Error inesperado." },
    { status: 500 },
  );
}

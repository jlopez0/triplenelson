import { NextRequest, NextResponse } from "next/server";
import {
  requirePhotoUploader,
  toPhotoErrorResponse,
  PhotoAuthError,
} from "@/lib/photos/auth";
import {
  isAllowedMime,
  getEventId,
  expectedKeyPrefix,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/photos/config";
import { createPhotoDoc } from "@/lib/photos/firestore";
import type { PhotoDoc } from "@/lib/photos/types";

export const runtime = "nodejs";

/**
 * Registra la metadata tras una subida exitosa a S3.
 * Vuelve a aplicar el gate y revalida MIME/tamaño/key para que un cliente
 * no pueda registrar metadata arbitraria saltándose el presign.
 */
export async function POST(request: NextRequest) {
  try {
    const uploadedBy = requirePhotoUploader(request);

    const body = (await request.json()) as Partial<PhotoDoc>;
    const id = (body.id ?? "").trim();
    const s3Key = (body.s3Key ?? "").trim();
    const mimeType = (body.mimeType ?? "").trim().toLowerCase();
    const size = Number(body.size ?? 0);
    const originalFileName = (body.originalFileName ?? "").trim().slice(0, 200);

    if (!id || !s3Key) {
      throw new PhotoAuthError("INVALID_INPUT", "Faltan id o s3Key.", 400);
    }
    // La key debe pertenecer al prefijo del entorno+evento+id — evita rutas arbitrarias.
    if (!s3Key.startsWith(expectedKeyPrefix(id))) {
      throw new PhotoAuthError("INVALID_KEY", "s3Key no válida.", 400);
    }
    if (!isAllowedMime(mimeType)) {
      throw new PhotoAuthError("INVALID_FORMAT", "Formato no permitido.", 400);
    }
    if (!Number.isFinite(size) || size <= 0 || size > MAX_FILE_SIZE_BYTES) {
      throw new PhotoAuthError("INVALID_SIZE", "Tamaño inválido.", 400);
    }

    const photo: PhotoDoc = {
      id,
      originalFileName: originalFileName || "foto",
      s3Key,
      mimeType,
      size,
      uploadedBy,
      createdAt: new Date().toISOString(),
      status: "active",
      eventId: getEventId(),
    };

    await createPhotoDoc(photo);

    return NextResponse.json({ ok: true, photo });
  } catch (error) {
    return toPhotoErrorResponse(error);
  }
}

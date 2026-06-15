import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  requirePhotoUploader,
  toPhotoErrorResponse,
  PhotoAuthError,
} from "@/lib/photos/auth";
import {
  isAllowedMime,
  extForMime,
  buildS3Key,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/photos/config";
import { createPresignedUpload, publicUrlForKey } from "@/lib/photos/s3";
import type { PresignRequest, PresignResponse } from "@/lib/photos/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    // Gate de seguridad (feature flag + admin). Validación SIEMPRE en backend.
    const uploadedBy = requirePhotoUploader(request);

    const body = (await request.json()) as Partial<PresignRequest>;
    const fileName = (body.fileName ?? "").trim();
    const mimeType = (body.mimeType ?? "").trim().toLowerCase();
    const size = Number(body.size ?? 0);

    // Validar MIME ANTES de firmar la URL.
    if (!mimeType || !isAllowedMime(mimeType)) {
      throw new PhotoAuthError(
        "INVALID_FORMAT",
        "Formato no permitido. Usa JPG, PNG, WEBP o HEIC.",
        400,
      );
    }

    // Validar tamaño ANTES de firmar la URL.
    if (!Number.isFinite(size) || size <= 0) {
      throw new PhotoAuthError("INVALID_SIZE", "Tamaño de archivo inválido.", 400);
    }
    if (size > MAX_FILE_SIZE_BYTES) {
      const mb = (MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0);
      throw new PhotoAuthError(
        "FILE_TOO_LARGE",
        `El archivo supera el máximo de ${mb} MB.`,
        400,
      );
    }

    // La key la construye el SERVIDOR. El cliente nunca dicta la ruta.
    // Incluye prefijo de entorno (photos/ vs photos-dev/) para separar dev/prod.
    const photoId = randomUUID();
    const ext = extForMime(mimeType);
    const s3Key = buildS3Key(photoId, ext);

    const { uploadUrl, expiresInSeconds } = await createPresignedUpload({
      key: s3Key,
      contentType: mimeType,
    });

    const response: PresignResponse & { uploadedBy: string; originalFileName: string } = {
      photoId,
      uploadUrl,
      s3Key,
      publicUrl: publicUrlForKey(s3Key),
      expiresInSeconds,
      uploadedBy,
      originalFileName: fileName || `foto.${ext}`,
    };

    return NextResponse.json(response);
  } catch (error) {
    return toPhotoErrorResponse(error);
  }
}

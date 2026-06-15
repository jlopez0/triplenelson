import { NextResponse } from "next/server";
import { isPhotoUploadEnabled } from "@/lib/photos/config";
import { listActivePhotos } from "@/lib/photos/firestore";
import { toPhotoErrorResponse } from "@/lib/photos/auth";

export const runtime = "nodejs";
export const revalidate = 0;

/**
 * Galería PÚBLICA: lista las fotos activas para que cualquier asistente
 * las vea. No requiere auth (lectura). Solo devuelve datos seguros
 * (URL pública, sin metadata sensible de quién subió).
 *
 * Si la feature está globalmente apagada, devolvemos lista vacía + flag,
 * para que la UI muestre el estado "galería no disponible todavía".
 */
export async function GET() {
  try {
    if (!isPhotoUploadEnabled()) {
      return NextResponse.json({ enabled: false, photos: [] });
    }

    const photos = await listActivePhotos();
    // Exponemos solo lo necesario para la galería pública.
    const publicPhotos = photos.map((p) => ({
      id: p.id,
      url: p.url,
      mimeType: p.mimeType,
      createdAt: p.createdAt,
      originalFileName: p.originalFileName,
    }));

    return NextResponse.json({ enabled: true, photos: publicPhotos });
  } catch (error) {
    return toPhotoErrorResponse(error);
  }
}

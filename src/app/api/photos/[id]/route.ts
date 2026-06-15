import { NextRequest, NextResponse } from "next/server";
import { requirePhotoAdmin, toPhotoErrorResponse } from "@/lib/photos/auth";
import { getPhotoDoc, markPhotoDeleted } from "@/lib/photos/firestore";
import { deleteObject } from "@/lib/photos/s3";

export const runtime = "nodejs";

/**
 * Elimina una foto: borra el objeto de S3 y marca el doc como deleted
 * (soft-delete, conservamos la metadata para trazabilidad).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    requirePhotoAdmin(request);
    const id = params.id;

    const photo = await getPhotoDoc(id);
    if (!photo) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Foto no encontrada." },
        { status: 404 },
      );
    }

    // Borrado físico en S3 (idempotente). Si falla, no marcamos deleted.
    await deleteObject(photo.s3Key);
    await markPhotoDeleted(id);

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return toPhotoErrorResponse(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requirePhotoAdmin, toPhotoErrorResponse } from "@/lib/photos/auth";
import { listActivePhotos } from "@/lib/photos/firestore";

export const runtime = "nodejs";

/** Lista las fotos activas. Gestión = solo admin. */
export async function GET(request: NextRequest) {
  try {
    requirePhotoAdmin(request);
    const photos = await listActivePhotos();
    return NextResponse.json({ photos });
  } catch (error) {
    return toPhotoErrorResponse(error);
  }
}

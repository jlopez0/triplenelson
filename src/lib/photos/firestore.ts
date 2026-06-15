import { getDb } from "@/lib/bizum/firebase";
import { getPhotosCollection } from "./config";
import { publicUrlForKey } from "./s3";
import type { PhotoDoc } from "./types";

/** Registra los metadatos de una foto recién subida. */
export async function createPhotoDoc(photo: PhotoDoc): Promise<void> {
  const db = await getDb();
  await db.collection(getPhotosCollection()).doc(photo.id).set(photo);
}

export async function getPhotoDoc(id: string): Promise<PhotoDoc | null> {
  const db = await getDb();
  const snap = await db.collection(getPhotosCollection()).doc(id).get();
  if (!snap.exists) return null;
  return snap.data() as PhotoDoc;
}

/** Lista las fotos activas (más recientes primero) con su URL pública. */
export async function listActivePhotos(): Promise<PhotoDoc[]> {
  const db = await getDb();
  const snap = await db
    .collection(getPhotosCollection())
    .where("status", "==", "active")
    .get();

  const docs = snap.docs
    .map((d) => d.data() as PhotoDoc)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return docs.map((photo) => ({ ...photo, url: publicUrlForKey(photo.s3Key) }));
}

/** Soft-delete: marca como deleted (no borra el doc). */
export async function markPhotoDeleted(id: string): Promise<PhotoDoc | null> {
  const db = await getDb();
  const ref = db.collection(getPhotosCollection()).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const photo = snap.data() as PhotoDoc;
  await ref.update({ status: "deleted" });
  return { ...photo, status: "deleted" };
}

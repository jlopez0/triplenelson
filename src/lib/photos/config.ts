/**
 * Configuración y feature flags del sistema de fotos.
 *
 * Doble gate de seguridad:
 *  - FEATURE_PHOTO_UPLOAD_ENABLED=false  → nadie puede subir (apagado global).
 *  - PHOTO_UPLOAD_ADMINS_ONLY=true       → aunque esté ON, solo admins suben.
 *
 * Para abrir la subida a todos los asistentes en el futuro:
 *  1) FEATURE_PHOTO_UPLOAD_ENABLED=true
 *  2) PHOTO_UPLOAD_ADMINS_ONLY=false
 *  (y añadir un control de identidad de asistente, ver requirePhotoUploader).
 */

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

function envBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  return TRUE_VALUES.has(value.trim().toLowerCase());
}

/** Subida habilitada globalmente. Por defecto APAGADA. */
export function isPhotoUploadEnabled(): boolean {
  return envBool(process.env.FEATURE_PHOTO_UPLOAD_ENABLED, false);
}

/** Aunque la feature esté ON, restringir a admins. Por defecto SÍ. */
export function isAdminsOnly(): boolean {
  return envBool(process.env.PHOTO_UPLOAD_ADMINS_ONLY, true);
}

/** ID de evento usado en la key de S3: photos/{eventId}/{uuid}.{ext} */
export function getEventId(): string {
  return process.env.PHOTO_EVENT_ID ?? process.env.BIZUM_EVENT_ID ?? "triple-nelson-2026";
}

/** Colección Firestore de metadatos (separa dev/prod como el resto del proyecto). */
export function getPhotosCollection(): string {
  return process.env.BIZUM_ENV === "dev" ? "photos_dev" : "photos";
}

/**
 * Prefijo raíz de la key en S3. Separa dev/prod en carpetas distintas
 * dentro del MISMO bucket: dev → "photos-dev/", prod → "photos/".
 * Así los binarios de desarrollo no se mezclan con los reales.
 */
export function getS3Prefix(): string {
  return process.env.BIZUM_ENV === "dev" ? "photos-dev" : "photos";
}

/** Construye la key completa: {prefix}/{eventId}/{photoId}.{ext} */
export function buildS3Key(photoId: string, ext: string): string {
  return `${getS3Prefix()}/${getEventId()}/${photoId}.${ext}`;
}

/** Valida que una key pertenece al prefijo/evento/id esperados (anti rutas arbitrarias). */
export function expectedKeyPrefix(photoId: string): string {
  return `${getS3Prefix()}/${getEventId()}/${photoId}.`;
}

// ─── Validación de archivos ──────────────────────────────────────────────────

export const MAX_FILE_SIZE_BYTES = Number(
  process.env.PHOTO_MAX_FILE_SIZE_BYTES ?? String(10 * 1024 * 1024), // 10 MB
);

/**
 * MIME types permitidos → extensión canónica que usaremos en la key S3.
 * HEIC se acepta a nivel de subida; los navegadores no lo previsualizan,
 * pero el objeto queda almacenado correctamente.
 */
export const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heic",
};

export function isAllowedMime(mime: string): boolean {
  return Object.prototype.hasOwnProperty.call(ALLOWED_MIME_TO_EXT, mime.toLowerCase());
}

export function extForMime(mime: string): string {
  return ALLOWED_MIME_TO_EXT[mime.toLowerCase()] ?? "bin";
}

// ─── Config AWS (solo se lee en servidor) ────────────────────────────────────

export interface S3Config {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * Lee la config de AWS de variables de entorno. Lanza si falta algo.
 * NUNCA se importa desde componentes cliente — solo en route handlers/server.
 */
export function getS3Config(): S3Config {
  const region = process.env.AWS_REGION;
  const bucket = process.env.AWS_S3_BUCKET_NAME;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!region || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Config AWS incompleta. Revisa AWS_REGION, AWS_S3_BUCKET_NAME, " +
        "AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY.",
    );
  }

  return { region, bucket, accessKeyId, secretAccessKey };
}

export type PhotoStatus = "active" | "deleted";

export interface PhotoDoc {
  id: string;                 // uuid, también doc id en Firestore
  originalFileName: string;
  s3Key: string;              // photos/{eventId}/{uuid}.{ext}
  mimeType: string;
  size: number;               // bytes
  uploadedBy: string;         // "admin" | identidad futura del asistente
  createdAt: string;          // ISO
  status: PhotoStatus;
  eventId: string;
  // URL pública (objetos public-read). Se rellena al listar.
  url?: string;
}

/** Petición de presign desde el cliente. */
export interface PresignRequest {
  fileName: string;
  mimeType: string;
  size: number;
}

/** Respuesta de presign: datos para subir directamente a S3. */
export interface PresignResponse {
  photoId: string;
  uploadUrl: string;          // presigned PUT URL
  s3Key: string;
  publicUrl: string;          // URL final del objeto (público de solo lectura)
  expiresInSeconds: number;
}

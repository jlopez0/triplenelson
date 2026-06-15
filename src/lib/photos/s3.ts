import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Config } from "./config";

// Cliente S3 cacheado (server-only). Las credenciales nunca salen del backend.
let _client: S3Client | undefined;

function getClient(): S3Client {
  if (_client) return _client;
  const cfg = getS3Config();
  _client = new S3Client({
    region: cfg.region,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  return _client;
}

const PRESIGN_PUT_EXPIRES = 3600; // 1h — vídeos de 200 MB necesitan más tiempo en 4G

/**
 * Genera una presigned PUT URL para que el cliente suba directamente a S3.
 *
 * Seguridad: la `key` la construye SIEMPRE el servidor (nunca el cliente),
 * y fijamos ContentType + ACL public-read en la firma, de modo que el cliente
 * no puede subir con otro tipo MIME ni cambiar la visibilidad del objeto.
 */
export async function createPresignedUpload(params: {
  key: string;
  contentType: string;
}): Promise<{ uploadUrl: string; expiresInSeconds: number }> {
  const cfg = getS3Config();
  const command = new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: params.key,
    ContentType: params.contentType,
    // Sin ACL: el acceso público se gestiona mediante Bucket Policy en AWS.
    // Esto es compatible con buckets modernos (Object Ownership = enforced).
  });

  const uploadUrl = await getSignedUrl(getClient(), command, {
    expiresIn: PRESIGN_PUT_EXPIRES,
  });

  return { uploadUrl, expiresInSeconds: PRESIGN_PUT_EXPIRES };
}

/** Borra el objeto de S3. Usado en el DELETE de fotos. */
export async function deleteObject(key: string): Promise<void> {
  const cfg = getS3Config();
  await getClient().send(
    new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }),
  );
}

/**
 * URL pública del objeto (bucket con objetos public-read).
 * Formato virtual-hosted-style estándar de S3.
 */
export function publicUrlForKey(key: string): string {
  const cfg = getS3Config();
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `https://${cfg.bucket}.s3.${cfg.region}.amazonaws.com/${encodedKey}`;
}

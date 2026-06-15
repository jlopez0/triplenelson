# Sistema de Fotos (S3)

Subida y gestión de fotos del evento **Triple Nelson**, almacenadas en AWS S3.
Inicialmente **apagada** y limitada a administradores.

---

## Estado por defecto

| Variable | Default | Efecto |
|---|---|---|
| `FEATURE_PHOTO_UPLOAD_ENABLED` | `false` | Apaga la subida para **todos** (incluidos admins). |
| `PHOTO_UPLOAD_ADMINS_ONLY` | `true` | Aunque la feature esté ON, solo admins pueden subir. |

Con los valores por defecto **nadie puede subir**. La galería admin muestra un
aviso de "funcionalidad no disponible".

---

## Variables de entorno

```bash
# Feature flags
FEATURE_PHOTO_UPLOAD_ENABLED=false
PHOTO_UPLOAD_ADMINS_ONLY=true
PHOTO_EVENT_ID=triple-nelson-2026
PHOTO_MAX_FILE_SIZE_BYTES=10485760     # 10 MB (opcional)

# AWS (solo backend — nunca exponer al frontend)
AWS_REGION=eu-west-1
AWS_S3_BUCKET_NAME=triplenelson-photos
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

La autorización admin reutiliza `BIZUM_ADMIN_TOKEN` (mismo token que el resto
del panel admin). No se añade un sistema de roles nuevo.

---

## Endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/api/photos/presign` | uploader (gate) | Valida MIME + tamaño y devuelve una **presigned PUT URL** de S3. |
| `POST` | `/api/photos/confirm` | uploader (gate) | Registra los metadatos en Firestore tras subir. |
| `GET` | `/api/photos` | admin | Lista las fotos activas con su URL pública. |
| `DELETE` | `/api/photos/:id` | admin | Borra el objeto en S3 y marca el doc como `deleted`. |

El "gate" del uploader aplica: feature flag → admins-only → (futuro) asistente.

---

## Frontend

- Página admin: **`/admin/fotos`**
  - Login con el token de admin (se guarda en `localStorage`).
  - Selector múltiple, preview, barra de progreso por archivo.
  - Listado en grid con borrado por foto.
  - Aviso si la feature está desactivada.

---

## Flujo de subida (seguro)

```
Cliente → POST /api/photos/presign  (valida feature/admin/MIME/tamaño)
        ← { uploadUrl, photoId, s3Key, publicUrl }
Cliente → PUT uploadUrl  (sube el binario DIRECTO a S3, sin pasar por el server)
Cliente → POST /api/photos/confirm  (registra metadata)
```

Las credenciales de AWS **nunca** llegan al navegador: solo el backend firma URLs.

---

## Metadatos (`PhotoDoc` en Firestore `photos` / `photos_dev`)

`id`, `originalFileName`, `s3Key`, `mimeType`, `size`, `uploadedBy`,
`createdAt`, `status` (`active`/`deleted`), `eventId`.

La key en S3 es `photos/{eventId}/{uuid}.{ext}` — construida **en el servidor**,
el cliente nunca dicta la ruta.

---

## Configuración del bucket S3

> **Decisión de seguridad**: se eligió **objetos públicos de solo lectura** para
> servir las fotos por URL directa (galería rápida). La **escritura sigue
> protegida**: solo el backend puede firmar la URL de subida. El bucket NO se
> hace público entero — solo los objetos bajo `photos/` quedan legibles.

1. Crear el bucket (región = `AWS_REGION`).
2. **Desbloquear ACLs**: en *Object Ownership*, elegir *ACLs enabled* (necesario
   para `ACL: public-read` al subir).
3. **Bloqueo de acceso público**: desactivar solo *"Block public access granted
   through new ACLs"* y *"...through any ACLs"* (mantén bloqueadas las políticas
   públicas de bucket si no las usas).
4. **CORS** del bucket (para que el navegador pueda hacer el PUT):

   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedOrigins": ["https://triplenelson.com", "http://localhost:3003"],
       "ExposeHeaders": ["ETag"]
     }
   ]
   ```

5. **IAM**: el usuario de `AWS_ACCESS_KEY_ID` necesita
   `s3:PutObject`, `s3:PutObjectAcl`, `s3:GetObject`, `s3:DeleteObject`
   sobre `arn:aws:s3:::<bucket>/photos/*`.

---

## Cómo abrir la subida a todos los asistentes (futuro)

1. `FEATURE_PHOTO_UPLOAD_ENABLED=true`
2. `PHOTO_UPLOAD_ADMINS_ONLY=false`
3. En `src/lib/photos/auth.ts` → `requirePhotoUploader`, sustituir el
   `return "attendee"` por la verificación de identidad real del asistente
   (p. ej. token de entrada validada). El punto de extensión ya está marcado
   con un comentario en el código.

Mientras `PHOTO_UPLOAD_ADMINS_ONLY=true`, aunque la feature esté ON, los no-admin
reciben `401` y la UI no les ofrece subir.
```

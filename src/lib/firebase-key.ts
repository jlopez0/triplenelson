/**
 * Normaliza la FIREBASE_PRIVATE_KEY independientemente de cómo la guarde el
 * proveedor de hosting (Vercel, local .env, etc.).
 *
 * Casos que cubre:
 *  - Comillas envolventes: "...", '...'  → se quitan
 *  - `\n` literales (típico de .env y Vercel) → se convierten en saltos reales
 *  - Saltos de línea reales (cuando se pega multilínea) → se respetan
 *  - `\r\n` de Windows → se normalizan a `\n`
 *  - Espacios/indentación al inicio de cada línea → se eliminan
 */
export function normalizePrivateKey(raw: string | undefined): string {
  let key = (raw ?? "").trim();

  // 1) Quitar comillas envolventes (una o varias)
  key = key.replace(/^["']+/, "").replace(/["']+$/, "");

  // 2) Convertir secuencias `\n` literales en saltos reales
  key = key.replace(/\\n/g, "\n");

  // 3) Normalizar CRLF de Windows
  key = key.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // 4) Quitar indentación accidental al principio de cada línea
  key = key
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");

  return key.trim() + "\n";
}

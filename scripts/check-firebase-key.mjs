// Verifica que FIREBASE_PRIVATE_KEY parsea como certificado válido.
// Uso:  node scripts/check-firebase-key.mjs
// Lee .env.production por defecto (o el fichero que pases como argumento).
import { readFileSync } from "node:fs";
import { createPrivateKey } from "node:crypto";

const envFile = process.argv[2] ?? ".env.production";

function loadEnv(path) {
  const text = readFileSync(path, "utf8");
  const out = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let val = m[2];
    // quitar comillas envolventes si las hay
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[m[1]] = val;
  }
  return out;
}

function normalize(raw) {
  let key = (raw ?? "").trim();
  key = key.replace(/^["']+/, "").replace(/["']+$/, "");
  key = key.replace(/\\n/g, "\n");
  key = key.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  key = key.split("\n").map((l) => l.trimEnd()).join("\n");
  return key.trim() + "\n";
}

const env = loadEnv(envFile);
const raw = env.FIREBASE_PRIVATE_KEY;

console.log(`\nFichero: ${envFile}`);
console.log(`Project ID:   ${env.FIREBASE_PROJECT_ID ?? "(falta)"}`);
console.log(`Client Email: ${env.FIREBASE_CLIENT_EMAIL ?? "(falta)"}`);

if (!raw) {
  console.error("\n❌ FIREBASE_PRIVATE_KEY no encontrada en el fichero.");
  process.exit(1);
}

const key = normalize(raw);
const lines = key.split("\n").filter(Boolean);
console.log(`\nLíneas PEM: ${lines.length}`);
console.log(`Primera:    ${lines[0]}`);
console.log(`Última:     ${lines[lines.length - 1]}`);

try {
  createPrivateKey({ key, format: "pem" });
  console.log("\n✅ La private key es un PEM VÁLIDO. El valor es correcto.");
  console.log("   Si en Vercel falla, re-pega EXACTAMENTE este valor (sin comillas).\n");
} catch (err) {
  console.error("\n❌ La private key NO parsea:", err.message);
  console.error("   Revisa que no falten saltos de línea ni caracteres.\n");
  process.exit(1);
}

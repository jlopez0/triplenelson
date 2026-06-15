/**
 * Script de inspección temporal — Firestore.
 *
 * Lee el estado actual de Firestore (dev y prod) para entender
 * cuántos tickets PAID hay y si la colección `tickets` ya tiene datos.
 *
 * Uso:
 *   npx tsx scripts/inspect-firestore.ts
 *
 * Requiere variables de entorno (.env.local):
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "node:fs";
import path from "node:path";

// Loader minimal de .env.local — evita dependencia de dotenv.
(function loadDotEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
})();

function initDb() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY ?? "")
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Faltan credenciales de Firebase en .env.local");
  }

  const existing = getApps().find((a) => a.name === "inspect");
  const app =
    existing ??
    initializeApp(
      { credential: cert({ projectId, clientEmail, privateKey }) },
      "inspect",
    );
  return getFirestore(app);
}

async function inspect() {
  const db = initDb();

  for (const collection of ["bizum", "bizum_dev"]) {
    console.log(`\n━━━ Colección: ${collection} ━━━`);
    try {
      const snap = await db.collection(collection).doc("state").get();
      if (!snap.exists) {
        console.log("  (vacío)");
        continue;
      }
      const data = snap.data() ?? {};
      const intents = Array.isArray(data.payment_intents)
        ? (data.payment_intents as Array<{
            id: string;
            status: string;
            ticketCodes?: string[];
            userKey?: string;
            buyerName?: string;
          }>)
        : [];

      const byStatus = new Map<string, number>();
      let totalTickets = 0;
      const paidIntentsSample: Array<{
        id: string;
        buyerName?: string;
        userKey?: string;
        tickets: string[];
      }> = [];

      for (const i of intents) {
        byStatus.set(i.status, (byStatus.get(i.status) ?? 0) + 1);
        const codes = Array.isArray(i.ticketCodes) ? i.ticketCodes : [];
        totalTickets += codes.length;
        if (i.status === "PAID" && paidIntentsSample.length < 3) {
          paidIntentsSample.push({
            id: i.id,
            buyerName: i.buyerName,
            userKey: i.userKey,
            tickets: codes,
          });
        }
      }

      console.log(`  Intents totales: ${intents.length}`);
      console.log("  Por status:");
      for (const [s, n] of byStatus) console.log(`    ${s}: ${n}`);
      console.log(`  Tickets emitidos en total: ${totalTickets}`);
      if (paidIntentsSample.length) {
        console.log("  Muestra de 3 intents PAID:");
        for (const p of paidIntentsSample) {
          console.log(
            `    - ${p.id} · ${p.buyerName ?? "?"} · ${p.userKey ?? "?"} · tickets=${p.tickets.join(", ")}`,
          );
        }
      }
    } catch (err) {
      console.error("  ERROR:", err instanceof Error ? err.message : err);
    }
  }

  // Colección `tickets` (futura, para el scanner)
  for (const collection of ["tickets", "tickets_dev"]) {
    console.log(`\n━━━ Colección: ${collection} ━━━`);
    try {
      const snap = await db.collection(collection).limit(5).get();
      console.log(`  Docs (muestra ${snap.size}):`);
      if (snap.empty) {
        console.log("    (vacío)");
      } else {
        snap.forEach((doc) => {
          console.log(`    - ${doc.id}:`, JSON.stringify(doc.data()));
        });
        const count = await db.collection(collection).count().get();
        console.log(`  Total docs: ${count.data().count}`);
      }
    } catch (err) {
      console.error("  ERROR:", err instanceof Error ? err.message : err);
    }
  }

  console.log("\n✓ Inspección completa.\n");
  process.exit(0);
}

inspect().catch((err) => {
  console.error("✗ Fallo:", err);
  process.exit(1);
});

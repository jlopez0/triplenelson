import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { normalizePrivateKey } from "@/lib/firebase-key";

// App propia para Firestore — separada de la app de Kahoot (RTDB), que usa
// otra config (databaseURL). Compartir nombre provocaba conflictos de init.
const APP_NAME = "bizum-firestore";

let _db: Firestore | undefined;

function initFirestore(): Firestore {
  if (_db) return _db;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase credentials missing: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY are required.",
    );
  }

  let app;
  try {
    const existing = getApps().find((a) => a.name === APP_NAME);
    app = existing ?? initializeApp(
      { credential: cert({ projectId, clientEmail, privateKey }) },
      APP_NAME,
    );
  } catch (err) {
    // Mensaje claro en los logs de Vercel si la credencial no parsea
    console.error("[bizum/firebase] initializeApp failed:", err);
    throw new Error(
      `Firebase Admin init failed. Revisa FIREBASE_PRIVATE_KEY (formato PEM). Causa: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  const db = getFirestore(app);

  try {
    db.settings({ preferRest: true, ignoreUndefinedProperties: true });
  } catch {
    // settings() already called — safe to ignore
  }

  _db = db;
  return db;
}

export function getDb(): Promise<Firestore> {
  return Promise.resolve(initFirestore());
}

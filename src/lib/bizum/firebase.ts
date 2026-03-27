import type { Firestore } from "firebase-admin/firestore";

declare global {
  // eslint-disable-next-line no-var
  var _firestoreInitPromise: Promise<Firestore> | undefined;
}

async function initFirestore(): Promise<Firestore> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY ?? "")
    .replace(/^["']|["']$/g, "") // eliminar comillas externas si Vercel las incluyó
    .replace(/\\n/g, "\n");      // convertir \n literales a saltos de línea reales

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase credentials missing: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY are required.",
    );
  }

  const { getApps, getApp, initializeApp, cert } = await import(/* webpackIgnore: true */ "firebase-admin/app");
  const { getFirestore } = await import(/* webpackIgnore: true */ "firebase-admin/firestore");

  const app = getApps().length
    ? getApp()
    : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

  const db = getFirestore(app);

  try {
    db.settings({ preferRest: true, ignoreUndefinedProperties: true });
  } catch {
    // settings() already called on this instance — safe to ignore
  }

  return db;
}

export function getDb(): Promise<Firestore> {
  if (!global._firestoreInitPromise) {
    global._firestoreInitPromise = initFirestore();
  }
  return global._firestoreInitPromise;
}

import { getApps, getApp, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let _db: Firestore | undefined;

function initFirestore(): Firestore {
  if (_db) return _db;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY ?? "")
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase credentials missing: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY are required.",
    );
  }

  const app = getApps().length
    ? getApp()
    : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

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

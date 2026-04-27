import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getDatabase, type Database } from "firebase-admin/database";

const APP_NAME = "kahoot";

function initAdminApp() {
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY ?? "")
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n");
  const databaseURL =
    process.env.FIREBASE_DATABASE_URL ??
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;

  if (!projectId || !clientEmail || !privateKey || !databaseURL) {
    throw new Error(
      "Firebase admin config incompleto. Necesitas FIREBASE_PROJECT_ID, " +
        "FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY y FIREBASE_DATABASE_URL.",
    );
  }

  return initializeApp(
    { credential: cert({ projectId, clientEmail, privateKey }), databaseURL },
    APP_NAME,
  );
}

export function getAdminFirebaseApp() {
  return initAdminApp();
}

export function getAdminApp(): Database {
  return getDatabase(initAdminApp());
}

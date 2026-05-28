import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getDatabase, type Database } from "firebase-admin/database";

const APP_NAME = "kahoot";

function resolveConfig() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY ?? "")
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n");
  const databaseURL =
    process.env.FIREBASE_DATABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL?.trim();

  if (!projectId || !clientEmail || !privateKey || !databaseURL) {
    throw new Error(
      "Firebase admin config incompleto. Revisa FIREBASE_PROJECT_ID, " +
        "FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY y FIREBASE_DATABASE_URL en las variables de entorno.",
    );
  }

  return { projectId, clientEmail, privateKey, databaseURL };
}

function initAdminApp() {
  const config = resolveConfig();

  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) return existing;

  return initializeApp(
    {
      credential: cert({
        projectId: config.projectId,
        clientEmail: config.clientEmail,
        privateKey: config.privateKey,
      }),
      databaseURL: config.databaseURL,
    },
    APP_NAME,
  );
}

export function getAdminFirebaseApp() {
  return initAdminApp();
}

export function getAdminApp(): Database {
  const app = initAdminApp();
  return getDatabase(app);
}

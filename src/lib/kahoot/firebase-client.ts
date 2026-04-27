"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";

let cachedApp: FirebaseApp | null = null;
let cachedDb: Database | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (cachedApp) return cachedApp;

  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  if (typeof window === "undefined") {
    throw new Error("Firebase client SDK must only be called in the browser.");
  }

  if (!config.apiKey || !config.databaseURL || !config.projectId) {
    throw new Error(
      "Firebase client config missing. Set NEXT_PUBLIC_FIREBASE_* env vars.",
    );
  }

  cachedApp = getApps().length ? getApp() : initializeApp(config);
  return cachedApp;
}

export function getRtdb(): Database {
  if (cachedDb) return cachedDb;
  cachedDb = getDatabase(getFirebaseApp());
  return cachedDb;
}

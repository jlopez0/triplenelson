"use client";

import {
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import { getFirebaseApp } from "./firebase-client";

let cachedStorage: ReturnType<typeof getStorage> | null = null;

function getKahootStorage() {
  if (cachedStorage) return cachedStorage;
  cachedStorage = getStorage(getFirebaseApp());
  return cachedStorage;
}

export async function uploadQuizQuestionImage(
  file: File,
  questionIndex: number,
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80);
  const imageRef = storageRef(
    getKahootStorage(),
    `kahoot/questions/${Date.now()}-${questionIndex}-${safeName}`,
  );

  await uploadBytes(imageRef, file, { contentType: file.type });
  return getDownloadURL(imageRef);
}

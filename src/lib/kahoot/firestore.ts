import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminFirebaseApp } from "./firebase-admin";
import type { Quiz, QuizInput, QuizQuestion } from "./types";

const COLLECTION = "quizzes";

function getDb() {
  return getFirestore(getAdminFirebaseApp());
}

function sanitizeQuestion(q: QuizQuestion): QuizQuestion {
  return {
    text: String(q.text ?? "").slice(0, 500),
    imageUrl: q.imageUrl ? String(q.imageUrl).slice(0, 2000) : null,
    options: [
      String(q.options?.[0] ?? "").slice(0, 200),
      String(q.options?.[1] ?? "").slice(0, 200),
      String(q.options?.[2] ?? "").slice(0, 200),
      String(q.options?.[3] ?? "").slice(0, 200),
    ],
    correctIndex: ([0, 1, 2, 3].includes(q.correctIndex)
      ? q.correctIndex
      : 0) as 0 | 1 | 2 | 3,
    timeLimit: Math.max(5, Math.min(120, Number(q.timeLimit) || 20)),
  };
}

export async function createQuiz(input: QuizInput): Promise<Quiz> {
  const db = getDb();
  const now = Date.now();
  const data = {
    title: String(input.title ?? "").slice(0, 120),
    event: String(input.event ?? "").slice(0, 120),
    createdAt: FieldValue.serverTimestamp(),
    questions: (input.questions ?? []).map(sanitizeQuestion),
  };
  const docRef = await db.collection(COLLECTION).add(data);
  return { id: docRef.id, ...data, createdAt: now };
}

export async function updateQuiz(id: string, input: QuizInput): Promise<Quiz> {
  const db = getDb();
  const data = {
    title: String(input.title ?? "").slice(0, 120),
    event: String(input.event ?? "").slice(0, 120),
    questions: (input.questions ?? []).map(sanitizeQuestion),
  };
  await db.collection(COLLECTION).doc(id).set(data, { merge: true });
  const snap = await db.collection(COLLECTION).doc(id).get();
  return normalizeQuiz(snap.id, snap.data());
}

export async function deleteQuiz(id: string): Promise<void> {
  const db = getDb();
  await db.collection(COLLECTION).doc(id).delete();
}

export async function getQuizzes(): Promise<Quiz[]> {
  const db = getDb();
  const snap = await db.collection(COLLECTION).orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => normalizeQuiz(d.id, d.data()));
}

export async function getQuiz(id: string): Promise<Quiz | null> {
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return normalizeQuiz(snap.id, snap.data());
}

function normalizeQuiz(id: string, data: FirebaseFirestore.DocumentData | undefined): Quiz {
  const rawCreatedAt = data?.createdAt;
  const createdAt =
    rawCreatedAt instanceof Timestamp
      ? rawCreatedAt.toMillis()
      : typeof rawCreatedAt === "number"
        ? rawCreatedAt
        : Date.now();

  return {
    id,
    title: String(data?.title ?? ""),
    event: String(data?.event ?? ""),
    createdAt,
    questions: Array.isArray(data?.questions)
      ? data.questions.map(sanitizeQuestion)
      : [],
  };
}

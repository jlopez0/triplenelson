import { randomUUID } from "node:crypto";
import type { BizumDb, PaymentIntent, Receiver } from "./types";
import { getDb } from "./firebase";

const COLLECTION = "bizum";
const DOC_ID = "state";

const DEFAULT_EVENT_ID = process.env.BIZUM_EVENT_ID ?? "triple-nelson-2026";
const DEFAULT_EVENT_NAME = process.env.BIZUM_EVENT_NAME ?? "TRIPLE NELSON PRIVATE EVENT";
const DEFAULT_FIXED_PRICE_EUR = Number(process.env.BIZUM_FIXED_PRICE_EUR ?? "16");

const DEFAULT_RECEIVERS = [
  process.env.BIZUM_RECEIVER_1 ?? "689375753",
  process.env.BIZUM_RECEIVER_2 ?? "645342250",
  process.env.BIZUM_RECEIVER_3 ?? "616900446",
  process.env.BIZUM_RECEIVER_4 ?? "",
];

const DEFAULT_RECEIVER_EMAILS = [
  process.env.BIZUM_RECEIVER_1_EMAIL ?? "",
  process.env.BIZUM_RECEIVER_2_EMAIL ?? "",
  process.env.BIZUM_RECEIVER_3_EMAIL ?? "",
  process.env.BIZUM_RECEIVER_4_EMAIL ?? "",
];

const DEFAULT_RECEIVER_LABELS = [
  process.env.BIZUM_RECEIVER_1_LABEL ?? "",
  process.env.BIZUM_RECEIVER_2_LABEL ?? "",
  process.env.BIZUM_RECEIVER_3_LABEL ?? "",
  process.env.BIZUM_RECEIVER_4_LABEL ?? "",
];

const nowIso = () => new Date().toISOString();

function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, "").trim();
}

function buildSeedReceivers(createdAt: string): Receiver[] {
  const fromCsv = (process.env.BIZUM_RECEIVERS ?? "")
    .split(",")
    .map((value) => normalizePhone(value))
    .filter(Boolean);

  const phones = [...fromCsv, ...DEFAULT_RECEIVERS.map(normalizePhone)].filter(Boolean).slice(0, 4);

  return phones.map((phone, index) => ({
    id: `receiver-${index + 1}`,
    label: DEFAULT_RECEIVER_LABELS[index] || `Receiver ${index + 1}`,
    phone,
    email: DEFAULT_RECEIVER_EMAILS[index] || undefined,
    isActive: true,
    createdAt,
    updatedAt: createdAt,
  }));
}

function createSeedDb(): BizumDb {
  const createdAt = nowIso();

  return {
    events: [
      {
        id: DEFAULT_EVENT_ID,
        name: DEFAULT_EVENT_NAME,
        fixedPriceCents: Math.max(100, Math.round(DEFAULT_FIXED_PRICE_EUR * 100)),
        currency: "EUR",
        isActive: true,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    receivers: buildSeedReceivers(createdAt),
    payment_intents: [],
    audit_logs: [],
  };
}

function fallbackPaymentRef(intentId: string): string {
  const normalized = intentId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const tail = normalized.slice(-8).padStart(8, "0");
  return `TN${tail}`;
}

function normalizeDb(candidate: Partial<BizumDb> | null | undefined): BizumDb {
  const seed = createSeedDb();

  if (!candidate) {
    return seed;
  }

  return {
    events: Array.isArray(candidate.events) && candidate.events.length > 0 ? candidate.events : seed.events,
    receivers:
      Array.isArray(candidate.receivers) && candidate.receivers.length > 0
        ? candidate.receivers.map((receiver, index) => ({
            ...receiver,
            label: DEFAULT_RECEIVER_LABELS[index] || receiver.label,
            email: receiver.email || DEFAULT_RECEIVER_EMAILS[index] || undefined,
          }))
        : seed.receivers,
    payment_intents: Array.isArray(candidate.payment_intents)
      ? candidate.payment_intents.map((intent) => {
          const legacyIntent = intent as PaymentIntent & { ticketCode?: string; qrPayload?: string };
          return {
            ...intent,
            quantity:
              Number.isInteger(legacyIntent.quantity) && Number(legacyIntent.quantity) > 0
                ? Number(legacyIntent.quantity)
                : 1,
            paymentRef:
              typeof legacyIntent.paymentRef === "string" && legacyIntent.paymentRef.trim()
                ? legacyIntent.paymentRef.trim().toUpperCase()
                : fallbackPaymentRef(legacyIntent.id ?? randomUUID()),
            ticketCodes: Array.isArray(legacyIntent.ticketCodes)
              ? legacyIntent.ticketCodes
              : typeof legacyIntent.ticketCode === "string" && legacyIntent.ticketCode.trim()
                ? [legacyIntent.ticketCode]
                : [],
            qrPayloads: Array.isArray(legacyIntent.qrPayloads)
              ? legacyIntent.qrPayloads
              : typeof legacyIntent.qrPayload === "string" && legacyIntent.qrPayload.trim()
                ? [legacyIntent.qrPayload]
                : [],
          };
        })
      : [],
    audit_logs: Array.isArray(candidate.audit_logs) ? candidate.audit_logs : [],
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`[Firestore] ${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

export async function readDbSnapshot(): Promise<BizumDb> {
  const firestore = await getDb();
  const snap = await withTimeout(
    firestore.collection(COLLECTION).doc(DOC_ID).get(),
    10000,
    "readDbSnapshot",
  );
  const raw = snap.exists ? (snap.data() as Partial<BizumDb>) : null;
  return normalizeDb(raw);
}

export async function withDbTransaction<T>(fn: (db: BizumDb) => Promise<T> | T): Promise<T> {
  const firestore = await getDb();
  const docRef = firestore.collection(COLLECTION).doc(DOC_ID);

  return withTimeout(
    firestore.runTransaction(async (transaction) => {
      const snap = await transaction.get(docRef);
      const raw = snap.exists ? (snap.data() as Partial<BizumDb>) : null;
      const db = normalizeDb(raw);

      const result = await fn(db);

      transaction.set(docRef, db);

      return result;
    }),
    15000,
    "withDbTransaction",
  );
}

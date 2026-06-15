"use client";

/**
 * Cliente del modo offline del escáner.
 *
 * Persiste en localStorage:
 *  - `tn_scanner_codes`: Set de ticketCodes válidos (descargado al bootstrap).
 *  - `tn_scanner_used`:  Set de ticketCodes ya marcados localmente como usados.
 *  - `tn_scanner_queue`: cola de envíos pendientes al volver online.
 *
 * La fuente de verdad es siempre el servidor. Lo local es un cache para no
 * bloquear validaciones cuando hay mala cobertura — al sincronizar, si el
 * servidor dice DUPLICATE se respeta lo que diga el servidor.
 */

const KEY_CODES = "tn_scanner_codes";
const KEY_USED = "tn_scanner_used";
const KEY_QUEUE = "tn_scanner_queue";
const KEY_FETCHED_AT = "tn_scanner_fetched_at";

export interface QueuedScan {
  ticketCode: string;
  scannedAt: string;
  validator: string;
}

function readSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function writeSet(key: string, set: Set<string>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(Array.from(set)));
}

export function saveBootstrap(codes: string[]): void {
  if (typeof window === "undefined") return;
  writeSet(KEY_CODES, new Set(codes));
  window.localStorage.setItem(KEY_FETCHED_AT, new Date().toISOString());
}

export function getBootstrapInfo(): { count: number; fetchedAt: string | null } {
  if (typeof window === "undefined") return { count: 0, fetchedAt: null };
  return {
    count: readSet(KEY_CODES).size,
    fetchedAt: window.localStorage.getItem(KEY_FETCHED_AT),
  };
}

export function isCodeKnown(ticketCode: string): boolean {
  return readSet(KEY_CODES).has(ticketCode);
}

export function isCodeUsedLocally(ticketCode: string): boolean {
  return readSet(KEY_USED).has(ticketCode);
}

export function markUsedLocally(ticketCode: string): void {
  const used = readSet(KEY_USED);
  used.add(ticketCode);
  writeSet(KEY_USED, used);
}

export function readQueue(): QueuedScan[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY_QUEUE);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (x): x is QueuedScan =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as QueuedScan).ticketCode === "string",
    );
  } catch {
    return [];
  }
}

export function enqueueScan(scan: QueuedScan): void {
  if (typeof window === "undefined") return;
  const queue = readQueue();
  queue.push(scan);
  window.localStorage.setItem(KEY_QUEUE, JSON.stringify(queue));
}

export function removeFromQueue(ticketCode: string): void {
  if (typeof window === "undefined") return;
  const queue = readQueue().filter((q) => q.ticketCode !== ticketCode);
  window.localStorage.setItem(KEY_QUEUE, JSON.stringify(queue));
}

export function clearAll(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY_CODES);
  window.localStorage.removeItem(KEY_USED);
  window.localStorage.removeItem(KEY_QUEUE);
  window.localStorage.removeItem(KEY_FETCHED_AT);
}

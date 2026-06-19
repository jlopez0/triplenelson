"use client";

import { onValue, ref, type Unsubscribe } from "firebase/database";
import { getRtdb } from "@/lib/kahoot/firebase-client";
import type { RaffleSession } from "./types";

const ENV = process.env.NEXT_PUBLIC_FIREBASE_ENV ?? "dev";

function rp(path: string): string {
  return `${ENV}/raffle/${path}`;
}

export function listenRaffleSession(
  sessionId: string,
  callback: (session: RaffleSession | null) => void,
): Unsubscribe {
  const r = ref(getRtdb(), rp(sessionId));
  return onValue(
    r,
    (snap) => {
      callback(snap.exists() ? (snap.val() as RaffleSession) : null);
    },
    (err) => {
      console.error("[raffle] listenRaffleSession error:", err.message);
    },
  );
}

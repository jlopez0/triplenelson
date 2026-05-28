import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getAdminApp } from "@/lib/kahoot/firebase-admin";
import { requireKahootAdmin, toKahootErrorResponse } from "@/lib/kahoot/admin-auth";
import {
  calculateTotalDelta,
  getNumberColor,
} from "@/lib/roulette/logic";
import type {
  RouletteHistoryEntry,
  RoulettePlayer,
  RouletteSession,
} from "@/lib/roulette/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENV = process.env.NEXT_PUBLIC_FIREBASE_ENV ?? "dev";

function basePath(sessionId: string): string {
  return `${ENV}/roulette/${sessionId}`;
}

function secureRandomNumber(): number {
  const limit = 256 - (256 % 37);
  for (let i = 0; i < 32; i += 1) {
    const v = crypto.randomBytes(1)[0];
    if (v < limit) return v % 37;
  }
  return crypto.randomBytes(1)[0] % 37;
}

export async function POST(request: NextRequest) {
  try {
    requireKahootAdmin(request);

    const body = (await request.json()) as {
      sessionId?: string;
      phase?: "spin" | "reveal";
    };
    const sessionId = body.sessionId;
    const phase = body.phase ?? "spin";
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "sessionId requerido." },
        { status: 400 },
      );
    }

    const db = getAdminApp();
    const sessionRef = db.ref(basePath(sessionId));
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists()) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Sesión no encontrada." },
        { status: 404 },
      );
    }
    const session = sessionSnap.val() as RouletteSession;

    if (phase === "reveal") {
      // Transición spinning → result. Idempotente: si ya en "result", no-op.
      if (session.status === "result") {
        return NextResponse.json({ ok: true, skipped: true });
      }
      if (session.status !== "spinning") {
        return NextResponse.json({ ok: true, skipped: true });
      }
      await sessionRef.update({ status: "result" });
      return NextResponse.json({ ok: true });
    }

    // phase === "spin": generar número + calcular payouts + status="spinning".
    if (session.status === "spinning" || session.status === "result") {
      // Idempotente: ya hay un resultado para esta ronda.
      const existing = session.currentRound?.result;
      if (existing !== null && existing !== undefined) {
        return NextResponse.json({
          ok: true,
          skipped: true,
          result: existing,
          color: session.currentRound?.color ?? null,
        });
      }
    }

    if (session.status !== "betting_open") {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const winning = secureRandomNumber();

    // Lock idempotente sobre el resultado de la ronda actual.
    const resultRef = db.ref(`${basePath(sessionId)}/currentRound/result`);
    const lockTx = await resultRef.transaction((current) => {
      if (current !== null && current !== undefined) return; // ya existía
      return winning;
    });

    if (!lockTx.committed) {
      const existing = lockTx.snapshot?.val() as number | null;
      const existingColor =
        existing !== null && existing !== undefined
          ? getNumberColor(existing)
          : null;
      return NextResponse.json({
        ok: true,
        skipped: true,
        result: existing,
        color: existingColor,
      });
    }

    const color = getNumberColor(winning);

    const playersSnap = await db.ref(`${basePath(sessionId)}/players`).get();
    const players = playersSnap.exists()
      ? (playersSnap.val() as Record<string, RoulettePlayer>)
      : {};

    const updates: Record<string, unknown> = {};
    updates[`${basePath(sessionId)}/status`] = "spinning";
    updates[`${basePath(sessionId)}/currentRound/color`] = color;

    for (const [playerId, player] of Object.entries(players)) {
      if (player.eliminated) continue;
      const bets = Array.isArray(player.bets) ? player.bets : [];
      const delta = bets.length ? calculateTotalDelta(bets, winning) : 0;
      const newCredits = Math.max(0, (player.credits ?? 0) + delta);
      const eliminated = newCredits <= 0;

      const base = `${basePath(sessionId)}/players/${playerId}`;
      updates[`${base}/credits`] = newCredits;
      updates[`${base}/lastDelta`] = delta;
      updates[`${base}/lastResultRound`] = session.currentRound?.index ?? 0;
      if (eliminated) updates[`${base}/eliminated`] = true;
    }

    const prevHistory = (session.history ?? []) as RouletteHistoryEntry[];
    const newHistory: RouletteHistoryEntry[] = [
      ...prevHistory,
      {
        round: session.currentRound?.index ?? 0,
        result: winning,
        color,
      },
    ].slice(-10);
    updates[`${basePath(sessionId)}/history`] = newHistory;

    await db.ref().update(updates);

    return NextResponse.json({ ok: true, result: winning, color });
  } catch (error) {
    return toKahootErrorResponse(error);
  }
}

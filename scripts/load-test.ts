/**
 * Load test para concurrencia en Kahoot y Ruleta.
 *
 * Uso:
 *   npx tsx scripts/load-test.ts --type=kahoot --users=50
 *   npx tsx scripts/load-test.ts --type=roulette --users=50
 *   npx tsx scripts/load-test.ts --type=kahoot --users=50 --game=123456
 *
 * Si no se pasa --game / --session, el script crea uno nuevo.
 *
 * IMPORTANTE: hardcodea ENV=dev. NO escribe en prod.
 *
 * Requiere variables de entorno:
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY,
 *   FIREBASE_DATABASE_URL (o NEXT_PUBLIC_FIREBASE_DATABASE_URL).
 */

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Loader minimal de .env.local — evita dependencia de dotenv.
(function loadDotEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // Quitar comillas envolventes simples o dobles.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
})();

// FORZADO: este script SIEMPRE escribe en /dev. No tocar.
const ENV = "dev";

interface Args {
  type: "kahoot" | "roulette";
  users: number;
  gameId?: string;
  sessionId?: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const map = new Map<string, string>();
  for (const a of args) {
    const [k, v] = a.replace(/^--/, "").split("=");
    map.set(k, v ?? "true");
  }
  const type = (map.get("type") ?? "kahoot") as Args["type"];
  if (type !== "kahoot" && type !== "roulette") {
    throw new Error("--type debe ser kahoot o roulette");
  }
  return {
    type,
    users: Number(map.get("users") ?? "50"),
    gameId: map.get("game"),
    sessionId: map.get("session"),
  };
}

function initAdmin() {
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
      "Faltan FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_DATABASE_URL en .env.local",
    );
  }

  const existing = getApps().find((a) => a.name === "load-test");
  if (existing) return getDatabase(existing);

  const app = initializeApp(
    {
      credential: cert({ projectId, clientEmail, privateKey }),
      databaseURL,
    },
    "load-test",
  );
  return getDatabase(app);
}

function randomId(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function newPlayerId(): string {
  return crypto.randomUUID();
}

const log = {
  info: (msg: string) => console.log(`  ${msg}`),
  ok: (msg: string) => console.log(`  ✓ ${msg}`),
  warn: (msg: string) => console.log(`  ⚠ ${msg}`),
  fail: (msg: string) => console.log(`  ✗ ${msg}`),
  head: (msg: string) => {
    console.log("");
    console.log(`━━ ${msg} ━━`);
  },
};

// ───────────────────────── KAHOOT ─────────────────────────

async function runKahoot(args: Args) {
  const db = initAdmin();
  console.log(`\n🧪 Load Test — Kahoot — ${args.users} usuarios`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // ───── Setup: crear partida si no existe ─────
  let gameId = args.gameId;
  if (!gameId) {
    gameId = randomId();
    await db.ref(`${ENV}/games/${gameId}`).set({
      quizId: "load-test-quiz",
      status: "lobby",
      currentQuestionIndex: -1,
      totalQuestions: 3,
      currentQuestion: null,
      createdAt: Date.now(),
    });
    log.info(`Partida ${gameId} creada para test`);
  } else {
    log.info(`Usando partida existente ${gameId}`);
  }

  const playersBase = `${ENV}/games/${gameId}/players`;

  // ───── Escenario 1: Join concurrente ─────
  log.head("Escenario 1 — Join concurrente");
  const joinStart = Date.now();
  const playerIds = Array.from({ length: args.users }, () => newPlayerId());
  const seen = new Set<string>();
  for (const id of playerIds) {
    if (seen.has(id)) {
      log.fail(`Colisión detectada localmente en playerId: ${id}`);
    }
    seen.add(id);
  }

  await Promise.all(
    playerIds.map((id, i) =>
      db.ref(`${playersBase}/${id}`).set({
        name: `Bot${i.toString().padStart(3, "0")}`,
        score: 0,
        answered: false,
        joinedAt: Date.now(),
      }),
    ),
  );
  const joinElapsed = Date.now() - joinStart;

  const playersSnap = await db.ref(playersBase).get();
  const registered = playersSnap.exists()
    ? Object.keys(playersSnap.val() as Record<string, unknown>).length
    : 0;
  if (registered === args.users) {
    log.ok(
      `Join concurrente: ${registered}/${args.users} usuarios registrados (${joinElapsed}ms)`,
    );
  } else {
    log.fail(
      `Join concurrente: ${registered}/${args.users} usuarios registrados (faltan ${args.users - registered})`,
    );
  }
  log.ok(`Sin colisiones de playerId (${seen.size} únicos generados)`);

  // ───── Escenario 2: Respuestas simultáneas ─────
  log.head("Escenario 2 — Respuestas simultáneas (Kahoot)");
  const questionIndex = 0;
  // Simular pregunta activa
  await db.ref(`${ENV}/games/${gameId}`).update({
    status: "question",
    currentQuestionIndex: questionIndex,
    currentQuestion: {
      text: "Load test question",
      imageUrl: null,
      options: ["A", "B", "C", "D"],
      timeLimit: 20,
      startedAt: Date.now(),
    },
  });

  const answerStart = Date.now();
  await Promise.all(
    playerIds.map((id, i) =>
      db
        .ref(`${ENV}/games/${gameId}/answers/${questionIndex}/${id}`)
        .set({
          optionIndex: i % 4,
          timeMs: Math.floor(Math.random() * 5000),
          submittedAt: Date.now(),
        }),
    ),
  );
  const answerElapsed = Date.now() - answerStart;

  const answersSnap = await db
    .ref(`${ENV}/games/${gameId}/answers/${questionIndex}`)
    .get();
  const recordedAnswers = answersSnap.exists()
    ? Object.keys(answersSnap.val() as Record<string, unknown>).length
    : 0;
  if (recordedAnswers === args.users) {
    log.ok(
      `Respuestas simultáneas: ${recordedAnswers}/${args.users} registradas (${answerElapsed}ms)`,
    );
  } else {
    log.fail(
      `Respuestas simultáneas: ${recordedAnswers}/${args.users} registradas`,
    );
  }

  // ───── Escenario 4: Listener stress test ─────
  log.head("Escenario 4 — Listener stress test");
  const RECEIVED_BY = new Set<number>();
  const expectedListeners = Math.min(args.users, 100);

  const listeners = Array.from({ length: expectedListeners }, (_, idx) => {
    const ref = db.ref(`${ENV}/games/${gameId}/status`);
    const handler = (snap: { val: () => unknown }) => {
      if (snap.val() === "leaderboard") {
        RECEIVED_BY.add(idx);
      }
    };
    ref.on("value", handler);
    return () => ref.off("value", handler);
  });

  // Esperar a que los listeners se enganchen
  await new Promise((r) => setTimeout(r, 500));

  const broadcastStart = Date.now();
  await db.ref(`${ENV}/games/${gameId}/status`).set("leaderboard");

  // Esperar a que se propague
  await new Promise((r) => setTimeout(r, 2000));
  const broadcastElapsed = Date.now() - broadcastStart;

  listeners.forEach((off) => off());

  if (RECEIVED_BY.size === expectedListeners) {
    log.ok(
      `Listener: ${RECEIVED_BY.size}/${expectedListeners} clientes recibieron la actualización (${broadcastElapsed}ms)`,
    );
  } else {
    log.fail(
      `Listener: ${RECEIVED_BY.size}/${expectedListeners} clientes recibieron la actualización`,
    );
  }

  // ───── Cleanup ─────
  log.head("Cleanup");
  await db.ref(`${ENV}/games/${gameId}`).remove();
  log.ok(`Partida ${gameId} eliminada`);
}

// ───────────────────────── RULETA ─────────────────────────

async function runRoulette(args: Args) {
  const db = initAdmin();
  console.log(`\n🧪 Load Test — Ruleta — ${args.users} usuarios`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  let sessionId = args.sessionId;
  if (!sessionId) {
    sessionId = randomId();
    await db.ref(`${ENV}/roulette/${sessionId}`).set({
      status: "lobby",
      config: { initialCredits: 1000, createdAt: Date.now() },
      currentRound: {
        index: 0,
        startedAt: 0,
        timeLimit: 30,
        result: null,
        color: null,
        allBetsIn: false,
      },
    });
    log.info(`Sesión ${sessionId} creada para test`);
  } else {
    log.info(`Usando sesión existente ${sessionId}`);
  }

  const playersBase = `${ENV}/roulette/${sessionId}/players`;

  // ───── Escenario 1: Join concurrente ─────
  log.head("Escenario 1 — Join concurrente");
  const joinStart = Date.now();
  const playerIds = Array.from({ length: args.users }, () => newPlayerId());
  const seen = new Set<string>();
  for (const id of playerIds) seen.add(id);

  await Promise.all(
    playerIds.map((id, i) =>
      db.ref(`${playersBase}/${id}`).set({
        name: `Bot${i.toString().padStart(3, "0")}`,
        credits: 1000,
        hasBet: false,
        eliminated: false,
        joinedAt: Date.now(),
        bets: [],
      }),
    ),
  );
  const joinElapsed = Date.now() - joinStart;

  const playersSnap = await db.ref(playersBase).get();
  const registered = playersSnap.exists()
    ? Object.keys(playersSnap.val() as Record<string, unknown>).length
    : 0;
  if (registered === args.users) {
    log.ok(
      `Join concurrente: ${registered}/${args.users} usuarios registrados (${joinElapsed}ms)`,
    );
  } else {
    log.fail(`Join concurrente: ${registered}/${args.users}`);
  }
  log.ok(`Sin colisiones de playerId (${seen.size} únicos)`);

  // ───── Escenario 3: Apuestas simultáneas ─────
  log.head("Escenario 3 — Apuestas simultáneas (Ruleta)");
  // Abrir betting
  await db.ref(`${ENV}/roulette/${sessionId}`).update({
    status: "betting_open",
    currentRound: {
      index: 1,
      startedAt: Date.now(),
      timeLimit: 30,
      result: null,
      color: null,
      allBetsIn: false,
    },
  });

  const betStart = Date.now();
  await Promise.all(
    playerIds.map((id) =>
      db.ref(`${playersBase}/${id}`).update({
        hasBet: true,
        bets: [
          {
            type: Math.random() > 0.5 ? "red" : "black",
            value: null,
            amount: 100,
          },
        ],
      }),
    ),
  );
  const betElapsed = Date.now() - betStart;

  const afterBets = await db.ref(playersBase).get();
  const betsIn = afterBets.exists()
    ? Object.values(afterBets.val() as Record<string, { hasBet?: boolean }>)
        .filter((p) => p.hasBet === true).length
    : 0;
  if (betsIn === args.users) {
    log.ok(`Apuestas: ${betsIn}/${args.users} registradas (${betElapsed}ms)`);
  } else {
    log.fail(`Apuestas: ${betsIn}/${args.users} registradas`);
  }

  // ───── Escenario 4: Listener stress test ─────
  log.head("Escenario 4 — Listener stress test");
  const RECEIVED_BY = new Set<number>();
  const expectedListeners = Math.min(args.users, 100);

  const listeners = Array.from({ length: expectedListeners }, (_, idx) => {
    const ref = db.ref(`${ENV}/roulette/${sessionId}/status`);
    const handler = (snap: { val: () => unknown }) => {
      if (snap.val() === "spinning") RECEIVED_BY.add(idx);
    };
    ref.on("value", handler);
    return () => ref.off("value", handler);
  });

  await new Promise((r) => setTimeout(r, 500));

  const broadcastStart = Date.now();
  await db.ref(`${ENV}/roulette/${sessionId}/status`).set("spinning");
  await new Promise((r) => setTimeout(r, 2000));
  const broadcastElapsed = Date.now() - broadcastStart;

  listeners.forEach((off) => off());

  if (RECEIVED_BY.size === expectedListeners) {
    log.ok(
      `Listener: ${RECEIVED_BY.size}/${expectedListeners} clientes recibieron la actualización (${broadcastElapsed}ms)`,
    );
  } else {
    log.fail(
      `Listener: ${RECEIVED_BY.size}/${expectedListeners} clientes recibieron la actualización`,
    );
  }

  // ───── Cleanup ─────
  log.head("Cleanup");
  await db.ref(`${ENV}/roulette/${sessionId}`).remove();
  log.ok(`Sesión ${sessionId} eliminada`);
}

// ───────────────────────── MAIN ─────────────────────────

async function main() {
  const args = parseArgs();
  if (args.type === "kahoot") await runKahoot(args);
  else await runRoulette(args);
  console.log("\n✓ Test completo.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n✗ Test falló:", err);
  process.exit(1);
});

/**
 * ruleta-bots.mjs — Simula N jugadores bot en una sesión de Ruleta
 *
 * Uso:
 *   node scripts/ruleta-bots.mjs <sessionId> [cantidad]
 *
 * Ejemplos:
 *   node scripts/ruleta-bots.mjs 123456
 *   node scripts/ruleta-bots.mjs 123456 30
 *   KAHOOT_ENV=dev node scripts/ruleta-bots.mjs 123456 50
 *
 * Variables de entorno opcionales:
 *   KAHOOT_ENV          — "dev" o "prod" (default: "prod")
 *   RULETA_BOT_COUNT    — número de bots (default: 40, max: 150)
 *   RULETA_BET_DELAY    — retraso medio en ms para apostar (default: 5000)
 *   RULETA_BET_SPREAD   — variación aleatoria adicional en ms (default: 12000)
 */

import { initializeApp } from "firebase/app";
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  onValue,
  remove,
} from "firebase/database";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ─── Cargar .env.local ────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");
let rawEnv = "";
try {
  rawEnv = readFileSync(envPath, "utf-8");
} catch {
  console.warn("[bots] No se encontró .env.local — usando variables de entorno del sistema");
}

function parseEnv(raw) {
  const vars = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    const commentIdx = val.indexOf("   #");
    if (commentIdx !== -1) val = val.slice(0, commentIdx).trim();
    vars[key] = val;
  }
  return vars;
}

const envVars = parseEnv(rawEnv);
function env(key, fallback = "") {
  return process.env[key] ?? envVars[key] ?? fallback;
}

// ─── Config ───────────────────────────────────────────────────────────────────
const FIREBASE_ENV = env("KAHOOT_ENV", env("NEXT_PUBLIC_FIREBASE_ENV", "prod"));
const BOT_COUNT = Math.min(150, Math.max(1, parseInt(process.argv[3] ?? env("RULETA_BOT_COUNT", "40"), 10)));
const BET_DELAY_MS = parseInt(env("RULETA_BET_DELAY", "5000"), 10);
const BET_SPREAD_MS = parseInt(env("RULETA_BET_SPREAD", "12000"), 10);

const sessionId = process.argv[2];
if (!sessionId) {
  console.error("Uso: node scripts/ruleta-bots.mjs <sessionId> [cantidad]");
  process.exit(1);
}

// ─── Firebase ─────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: env("NEXT_PUBLIC_FIREBASE_API_KEY"),
  authDomain: env("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  databaseURL: env("NEXT_PUBLIC_FIREBASE_DATABASE_URL"),
  projectId: env("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: env("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: env("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: env("NEXT_PUBLIC_FIREBASE_APP_ID"),
};

if (!firebaseConfig.databaseURL) {
  console.error("[bots] NEXT_PUBLIC_FIREBASE_DATABASE_URL no encontrada en .env.local");
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

function rp(path) {
  return `${FIREBASE_ENV}/roulette/${path}`;
}

// ─── Nombres ──────────────────────────────────────────────────────────────────
const BOT_NAMES = [
  "Alaia", "Amaia", "Ane", "Aritz", "Asier", "Axier", "Azu", "Bea", "Borja", "Bruno",
  "Carla", "Carlos", "Ceci", "Clara", "Dani", "Diego", "Elena", "Eli", "Eneko", "Erika",
  "Espe", "Fran", "Gabi", "Gorka", "Iker", "Inma", "Iñigo", "Irene", "Ivan", "Jaime",
  "Javi", "Joan", "Jon", "Jorge", "Jose", "Juan", "Julia", "Kepa", "Laura", "Leia",
  "Leo", "Leti", "Lore", "Lucia", "Luis", "Luna", "Marcos", "Maria", "Mario", "Marta",
  "Miguel", "Mireia", "Miriam", "Nadia", "Nagore", "Noa", "Noel", "Nora", "Olatz", "Oier",
  "Pablo", "Pako", "Patricia", "Paula", "Pau", "Peio", "Pedro", "Rakel", "Raul", "Rebe",
  "Rocio", "Rober", "Rosa", "Ruben", "Sara", "Sergio", "Silvia", "Sonia", "Txema",
  "Unai", "Ur", "Uxue", "Valen", "Vanesa", "Vero", "Vika", "Xabi", "Yolanda",
];

function getBotName(index) {
  const base = BOT_NAMES[index % BOT_NAMES.length];
  const suffix = Math.floor(index / BOT_NAMES.length);
  return suffix === 0 ? base : `${base}${suffix + 1}`;
}

function randomUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function rand(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

// ─── Estrategias de apuesta ───────────────────────────────────────────────────
// Cada bot tiene una "personalidad" que determina cómo apuesta

const STRATEGIES = [
  "conservative",   // apuesta poco, en colores/par-impar
  "aggressive",     // apuesta mucho, a números concretos
  "balanced",       // mezcla de tipos
  "dozen_player",   // siempre docenas
  "color_gambler",  // todo a rojo o negro
  "random_chaos",   // apuesta aleatoria cada ronda
];

/**
 * Genera apuestas para un bot según su estrategia y créditos actuales.
 * Respeta los límites de BET_LIMITS y el cap del 50%.
 */
function generateBets(strategy, credits) {
  const cap = Math.floor(credits / 2); // máx 50% por ronda
  const bets = [];

  if (credits < 50) return []; // eliminado pronto

  switch (strategy) {
    case "conservative": {
      // Una apuesta a color, cantidad pequeña
      const type = Math.random() < 0.5 ? "red" : "black";
      const amount = Math.min(cap, rand(50, 150));
      bets.push({ type, value: null, amount });
      // A veces también par/impar
      if (Math.random() < 0.4 && credits >= 100) {
        const t2 = Math.random() < 0.5 ? "even" : "odd";
        const a2 = Math.min(cap - amount, rand(50, 100));
        if (a2 >= 50) bets.push({ type: t2, value: null, amount: a2 });
      }
      break;
    }

    case "aggressive": {
      // Número concreto + quizás color
      const num = rand(0, 36);
      const numAmount = Math.min(Math.min(cap, 100), credits);
      if (numAmount >= 10) {
        bets.push({ type: "number", value: num, amount: Math.max(10, numAmount) });
      }
      // También a veces un color con más pasta
      if (Math.random() < 0.6 && credits >= 150) {
        const colorType = Math.random() < 0.5 ? "red" : "black";
        const colorAmount = Math.min(cap, rand(100, 300));
        if (colorAmount >= 50) bets.push({ type: colorType, value: null, amount: colorAmount });
      }
      break;
    }

    case "balanced": {
      // Una apuesta a color y una a bajo/alto
      const colorType = Math.random() < 0.5 ? "red" : "black";
      const rangeType = Math.random() < 0.5 ? "low" : "high";
      const a1 = Math.min(cap / 2, rand(50, 200));
      const a2 = Math.min(cap - a1, rand(50, 200));
      if (a1 >= 50) bets.push({ type: colorType, value: null, amount: Math.floor(a1) });
      if (a2 >= 50) bets.push({ type: rangeType, value: null, amount: Math.floor(a2) });
      break;
    }

    case "dozen_player": {
      // 1-3 docenas distintas
      const dozens = ["dozen1", "dozen2", "dozen3"]
        .sort(() => Math.random() - 0.5)
        .slice(0, rand(1, 3));
      const perBet = Math.floor(Math.min(cap / dozens.length, rand(30, 200)));
      for (const d of dozens) {
        const amount = Math.max(30, Math.min(300, perBet));
        if (amount >= 30 && bets.reduce((s, b) => s + b.amount, 0) + amount <= cap) {
          bets.push({ type: d, value: null, amount });
        }
      }
      break;
    }

    case "color_gambler": {
      // Todo el cap posible a un solo color, siempre el mismo (definido por index % 2)
      const type = "red"; // se sobreescribe en el bot con su color fijo
      const amount = Math.min(cap, Math.min(500, rand(200, 500)));
      if (amount >= 50) bets.push({ type, value: null, amount });
      break;
    }

    case "random_chaos": {
      // Tipo y cantidad completamente aleatorios cada ronda
      const types = ["red", "black", "even", "odd", "low", "high", "dozen1", "dozen2", "dozen3", "number"];
      const numBets = rand(1, 3);
      let remaining = cap;
      for (let i = 0; i < numBets && remaining > 0; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        const isNumber = type === "number";
        const minAmt = isNumber ? 10 : 30;
        const maxAmt = isNumber ? Math.min(remaining, 100) : Math.min(remaining, 300);
        if (maxAmt < minAmt) break;
        const amount = rand(minAmt, maxAmt);
        const value = isNumber ? rand(0, 36) : null;
        bets.push({ type, value, amount });
        remaining -= amount;
      }
      break;
    }
  }

  // Validación final: nunca superar el 50% ni los límites por tipo
  const BET_LIMITS = {
    number: { min: 10, max: 100 },
    red: { min: 50, max: 500 },
    black: { min: 50, max: 500 },
    even: { min: 50, max: 500 },
    odd: { min: 50, max: 500 },
    low: { min: 50, max: 500 },
    high: { min: 50, max: 500 },
    dozen1: { min: 30, max: 300 },
    dozen2: { min: 30, max: 300 },
    dozen3: { min: 30, max: 300 },
  };

  let total = 0;
  const valid = [];
  for (const bet of bets) {
    const limits = BET_LIMITS[bet.type];
    if (!limits) continue;
    const amount = Math.max(limits.min, Math.min(limits.max, bet.amount));
    if (total + amount > cap || total + amount > credits) continue;
    valid.push({ ...bet, amount });
    total += amount;
  }
  return valid;
}

// ─── Bot ──────────────────────────────────────────────────────────────────────
class RouletteBot {
  constructor(index, initialCredits) {
    this.index = index;
    this.name = getBotName(index);
    this.playerId = randomUUID();
    this.credits = initialCredits;
    this.strategy = STRATEGIES[index % STRATEGIES.length];
    // color_gambler tiene su color fijo (alternando rojo/negro por índice)
    this.fixedColor = index % 2 === 0 ? "red" : "black";
    this.bettedRounds = new Set();
    this.unsubscribe = null;
    this.joined = false;
  }

  log(msg) {
    if (this.index < 2 || this.index % 20 === 0) {
      console.log(`[bot-${this.index}][${this.name}/${this.strategy}] ${msg}`);
    }
  }

  async join() {
    const playerRef = ref(db, rp(`${sessionId}/players/${this.playerId}`));
    await set(playerRef, {
      name: this.name,
      credits: this.credits,
      hasBet: false,
      eliminated: false,
      joinedAt: Date.now(),
      bets: [],
    });
    this.joined = true;
    this.log(`joined (${this.credits} créditos)`);
  }

  async placeBet(roundIndex, sessionCredits) {
    if (this.bettedRounds.has(roundIndex)) return;
    this.bettedRounds.add(roundIndex);

    // Retraso aleatorio — simula que el humano piensa
    const delay = BET_DELAY_MS + Math.random() * BET_SPREAD_MS;
    await sleep(delay);

    // Leer créditos actuales del RTDB (pueden haber cambiado)
    const playerSnap = await get(ref(db, rp(`${sessionId}/players/${this.playerId}`)));
    if (!playerSnap.exists()) return;
    const player = playerSnap.val();
    if (player.eliminated || player.hasBet) return;

    const currentCredits = player.credits ?? 0;
    if (currentCredits < 30) {
      this.log(`sin créditos suficientes (${currentCredits}), no apuesta`);
      return;
    }

    // Generar apuestas según estrategia
    let bets = generateBets(this.strategy, currentCredits);

    // color_gambler usa su color fijo
    if (this.strategy === "color_gambler") {
      bets = bets.map((b) => b.type === "red" ? { ...b, type: this.fixedColor } : b);
    }

    if (!bets.length) {
      this.log(`sin apuestas válidas para ${currentCredits} créditos`);
      return;
    }

    // Verificar que la sesión sigue abierta
    const sessionSnap = await get(ref(db, rp(sessionId)));
    if (!sessionSnap.exists()) return;
    const session = sessionSnap.val();
    if (session.status !== "betting_open") return;
    if (session.currentRound?.index !== roundIndex) return;

    try {
      await update(ref(db, rp(`${sessionId}/players/${this.playerId}`)), {
        hasBet: true,
        bets,
      });
      const total = bets.reduce((s, b) => s + b.amount, 0);
      this.log(`apuesta ronda ${roundIndex}: ${bets.map((b) => `${b.type}${b.type === "number" ? `(${b.value})` : ""}×${b.amount}`).join(", ")} = ${total} total`);
    } catch (err) {
      this.log(`error apostando: ${err.message}`);
    }
  }

  startListening() {
    const sessionRef = ref(db, rp(sessionId));
    this.unsubscribe = onValue(sessionRef, async (snap) => {
      if (!snap.exists()) return;
      const session = snap.val();

      if (session.status === "betting_open" && session.currentRound) {
        const roundIndex = session.currentRound.index;
        if (!this.bettedRounds.has(roundIndex)) {
          await this.placeBet(roundIndex, session.config?.initialCredits ?? 1000);
        }
      }
    });
  }

  async cleanup() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.joined) {
      try {
        await remove(ref(db, rp(`${sessionId}/players/${this.playerId}`)));
      } catch {
        // ignorar
      }
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`
╔══════════════════════════════════════════════╗
║     TRIPLE NELSON — Ruleta Bot Army          ║
╠══════════════════════════════════════════════╣
║  SessionId : ${sessionId.padEnd(32)}║
║  ENV       : ${FIREBASE_ENV.padEnd(32)}║
║  Bots      : ${String(BOT_COUNT).padEnd(32)}║
║  Delay     : ${String(`${BET_DELAY_MS}-${BET_DELAY_MS + BET_SPREAD_MS}ms`).padEnd(32)}║
╚══════════════════════════════════════════════╝
`);

  // Verificar que la sesión existe
  const sessionSnap = await new Promise((resolve) => {
    const unsub = onValue(ref(db, rp(sessionId)), (s) => { unsub(); resolve(s); });
  });

  if (!sessionSnap.exists()) {
    console.error(`[bots] ERROR: No existe la sesión ${sessionId} en ${FIREBASE_ENV}/roulette/${sessionId}`);
    console.error(`[bots] Crea la sesión desde el panel admin de la ruleta primero.`);
    process.exit(1);
  }

  const session = sessionSnap.val();
  const initialCredits = session.config?.initialCredits ?? 1000;
  console.log(`[bots] Sesión encontrada: status="${session.status}", ${initialCredits} créditos iniciales`);

  const strategyCount = {};
  STRATEGIES.forEach((s) => (strategyCount[s] = 0));

  // Crear bots
  const bots = Array.from({ length: BOT_COUNT }, (_, i) => {
    const bot = new RouletteBot(i, initialCredits);
    strategyCount[bot.strategy]++;
    return bot;
  });

  console.log("[bots] Distribución de estrategias:");
  Object.entries(strategyCount).forEach(([s, n]) => console.log(`  ${s.padEnd(16)}: ${n} bots`));

  // Unir bots en oleadas
  console.log(`\n[bots] Uniendo ${BOT_COUNT} bots en oleadas...`);
  const WAVE_SIZE = 20;
  const WAVE_DELAY = 400;

  for (let i = 0; i < bots.length; i += WAVE_SIZE) {
    const wave = bots.slice(i, i + WAVE_SIZE);
    await Promise.all(wave.map((b) => b.join().catch((e) => console.warn(`[bot-${b.index}] join error: ${e.message}`))));
    const joined = Math.min(i + WAVE_SIZE, bots.length);
    process.stdout.write(`\r[bots] ${joined}/${BOT_COUNT} unidos...`);
    if (i + WAVE_SIZE < bots.length) await sleep(WAVE_DELAY);
  }
  console.log(`\n[bots] Todos unidos. Escuchando rondas...`);

  // Activar listeners
  bots.forEach((b) => b.startListening());

  // Escuchar fin de partida
  let finished = false;
  const statusRef = ref(db, rp(`${sessionId}/status`));
  const unsubStatus = onValue(statusRef, (s) => {
    if (s.val() === "finished") {
      finished = true;
      console.log("\n[bots] Partida finalizada. Limpiando bots...");
    }
  });

  async function shutdown(signal) {
    console.log(`\n[bots] ${signal} recibido. Limpiando ${BOT_COUNT} bots...`);
    unsubStatus();
    await Promise.allSettled(bots.map((b) => b.cleanup()));
    console.log("[bots] Bots eliminados. Saliendo.");
    process.exit(0);
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  while (!finished) {
    await sleep(2000);
  }

  await sleep(4000);
  unsubStatus();
  console.log("[bots] Limpiando bots del RTDB...");
  await Promise.allSettled(bots.map((b) => b.cleanup()));
  console.log("[bots] Hecho.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[bots] Error fatal:", err);
  process.exit(1);
});

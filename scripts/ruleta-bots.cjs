/**
 * ruleta-bots.cjs — Simula N jugadores bot en una sesión de Ruleta
 *
 * Uso:
 *   node scripts/ruleta-bots.cjs <sessionId> [cantidad]
 *
 * Variables de entorno opcionales:
 *   KAHOOT_ENV          — "dev" o "prod" (default: "prod")
 *   RULETA_BOT_COUNT    — número de bots (default: 40, max: 150)
 *   RULETA_BET_DELAY    — retraso medio en ms para apostar (default: 5000)
 *   RULETA_BET_SPREAD   — variación aleatoria adicional en ms (default: 12000)
 */

"use strict";

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// ─── Cargar .env.local ────────────────────────────────────────────────────────
const envPath = path.resolve(__dirname, "../.env.local");
let rawEnv = "";
try { rawEnv = fs.readFileSync(envPath, "utf-8"); } catch { /* sin .env.local */ }

function parseEnv(raw) {
  const vars = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    const ci = val.indexOf("   #");
    if (ci !== -1) val = val.slice(0, ci).trim();
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
  console.error("Uso: node scripts/ruleta-bots.cjs <sessionId> [cantidad]");
  process.exit(1);
}

// ─── Firebase Admin SDK ───────────────────────────────────────────────────────
const databaseURL = env("FIREBASE_DATABASE_URL") || env("NEXT_PUBLIC_FIREBASE_DATABASE_URL");
const projectId = env("FIREBASE_PROJECT_ID");
const clientEmail = env("FIREBASE_CLIENT_EMAIL");
const privateKey = env("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");

if (!databaseURL || !projectId || !clientEmail || !privateKey) {
  console.error("[bots] Faltan variables Admin SDK: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_DATABASE_URL");
  process.exit(1);
}

const appName = "ruleta-bots";
const existingApp = admin.apps.find((a) => a.name === appName);
const app = existingApp ?? admin.initializeApp(
  { credential: admin.credential.cert({ projectId, clientEmail, privateKey }), databaseURL },
  appName,
);
const db = admin.database(app);

function dbRef(p) { return db.ref(p); }
function rp(p) { return `${FIREBASE_ENV}/roulette/${p}`; }

// ─── Nombres ──────────────────────────────────────────────────────────────────
const BOT_NAMES = [
  "Alaia","Amaia","Ane","Aritz","Asier","Axier","Azu","Bea","Borja","Bruno",
  "Carla","Carlos","Ceci","Clara","Dani","Diego","Elena","Eli","Eneko","Erika",
  "Espe","Fran","Gabi","Gorka","Iker","Inma","Iñigo","Irene","Ivan","Jaime",
  "Javi","Joan","Jon","Jorge","Jose","Juan","Julia","Kepa","Laura","Leia",
  "Leo","Leti","Lore","Lucia","Luis","Luna","Marcos","Maria","Mario","Marta",
  "Miguel","Mireia","Miriam","Nadia","Nagore","Noa","Noel","Nora","Olatz","Oier",
  "Pablo","Pako","Patricia","Paula","Pau","Peio","Pedro","Rakel","Raul","Rebe",
  "Rocio","Rober","Rosa","Ruben","Sara","Sergio","Silvia","Sonia","Txema",
  "Unai","Ur","Uxue","Valen","Vanesa","Vero","Vika","Xabi","Yolanda",
];

function getBotName(i) {
  const base = BOT_NAMES[i % BOT_NAMES.length];
  const s = Math.floor(i / BOT_NAMES.length);
  return s === 0 ? base : `${base}${s + 1}`;
}

function randomUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function rand(min, max) { return Math.floor(min + Math.random() * (max - min + 1)); }

// ─── Estrategias ──────────────────────────────────────────────────────────────
const STRATEGIES = ["conservative","aggressive","balanced","dozen_player","color_gambler","random_chaos"];

function generateBets(strategy, credits, fixedColor) {
  const cap = Math.floor(credits / 2);
  const bets = [];
  if (credits < 50) return [];

  const BET_LIMITS = {
    number:{min:10,max:100}, red:{min:50,max:500}, black:{min:50,max:500},
    even:{min:50,max:500}, odd:{min:50,max:500}, low:{min:50,max:500},
    high:{min:50,max:500}, dozen1:{min:30,max:300}, dozen2:{min:30,max:300}, dozen3:{min:30,max:300},
  };

  switch (strategy) {
    case "conservative": {
      const type = Math.random() < 0.5 ? "red" : "black";
      const amount = Math.min(cap, rand(50, 150));
      bets.push({ type, value: null, amount });
      if (Math.random() < 0.4 && credits >= 100) {
        const t2 = Math.random() < 0.5 ? "even" : "odd";
        const a2 = Math.min(cap - amount, rand(50, 100));
        if (a2 >= 50) bets.push({ type: t2, value: null, amount: a2 });
      }
      break;
    }
    case "aggressive": {
      const num = rand(0, 36);
      const na = Math.min(Math.min(cap, 100), credits);
      if (na >= 10) bets.push({ type: "number", value: num, amount: Math.max(10, na) });
      if (Math.random() < 0.6 && credits >= 150) {
        const ct = Math.random() < 0.5 ? "red" : "black";
        const ca = Math.min(cap, rand(100, 300));
        if (ca >= 50) bets.push({ type: ct, value: null, amount: ca });
      }
      break;
    }
    case "balanced": {
      const ct = Math.random() < 0.5 ? "red" : "black";
      const rt = Math.random() < 0.5 ? "low" : "high";
      const a1 = Math.min(cap / 2, rand(50, 200));
      const a2 = Math.min(cap - a1, rand(50, 200));
      if (a1 >= 50) bets.push({ type: ct, value: null, amount: Math.floor(a1) });
      if (a2 >= 50) bets.push({ type: rt, value: null, amount: Math.floor(a2) });
      break;
    }
    case "dozen_player": {
      const dozens = ["dozen1","dozen2","dozen3"].sort(() => Math.random() - 0.5).slice(0, rand(1, 3));
      const perBet = Math.floor(Math.min(cap / dozens.length, rand(30, 200)));
      for (const d of dozens) {
        const amount = Math.max(30, Math.min(300, perBet));
        if (amount >= 30 && bets.reduce((s, b) => s + b.amount, 0) + amount <= cap)
          bets.push({ type: d, value: null, amount });
      }
      break;
    }
    case "color_gambler": {
      const amount = Math.min(cap, Math.min(500, rand(200, 500)));
      if (amount >= 50) bets.push({ type: fixedColor, value: null, amount });
      break;
    }
    case "random_chaos": {
      const types = ["red","black","even","odd","low","high","dozen1","dozen2","dozen3","number"];
      let remaining = cap;
      for (let i = 0; i < rand(1, 3) && remaining > 0; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        const isN = type === "number";
        const minA = isN ? 10 : 30;
        const maxA = isN ? Math.min(remaining, 100) : Math.min(remaining, 300);
        if (maxA < minA) break;
        const amount = rand(minA, maxA);
        bets.push({ type, value: isN ? rand(0, 36) : null, amount });
        remaining -= amount;
      }
      break;
    }
  }

  // Validar límites finales
  let total = 0;
  const valid = [];
  for (const bet of bets) {
    const lim = BET_LIMITS[bet.type];
    if (!lim) continue;
    const amount = Math.max(lim.min, Math.min(lim.max, bet.amount));
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
    this.fixedColor = index % 2 === 0 ? "red" : "black";
    this.bettedRounds = new Set();
    this.unsubscribe = null;
    this.joined = false;
  }

  log(msg) {
    if (this.index < 2 || this.index % 20 === 0)
      console.log(`[bot-${this.index}][${this.name}/${this.strategy}] ${msg}`);
  }

  async join() {
    await dbRef(rp(`${sessionId}/players/${this.playerId}`)).set({
      name: this.name, credits: this.credits,
      hasBet: false, eliminated: false, joinedAt: Date.now(), bets: [],
    });
    this.joined = true;
    this.log(`joined (${this.credits} créditos)`);
  }

  async placeBet(roundIndex) {
    if (this.bettedRounds.has(roundIndex)) return;
    this.bettedRounds.add(roundIndex);

    const delay = BET_DELAY_MS + Math.random() * BET_SPREAD_MS;
    await sleep(delay);

    const playerSnap = await dbRef(rp(`${sessionId}/players/${this.playerId}`)).get();
    if (!playerSnap.exists()) return;
    const player = playerSnap.val();
    if (player.eliminated || player.hasBet) return;

    const credits = player.credits ?? 0;
    if (credits < 30) { this.log(`sin créditos (${credits})`); return; }

    const bets = generateBets(this.strategy, credits, this.fixedColor);
    if (!bets.length) { this.log(`sin apuestas válidas`); return; }

    // Verificar que la sesión sigue en betting_open y es la misma ronda
    const sessionSnap = await dbRef(rp(sessionId)).get();
    if (!sessionSnap.exists()) return;
    const sess = sessionSnap.val();
    if (sess.status !== "betting_open") return;
    if (sess.currentRound?.index !== roundIndex) return;

    try {
      await dbRef(rp(`${sessionId}/players/${this.playerId}`)).update({ hasBet: true, bets });
      const total = bets.reduce((s, b) => s + b.amount, 0);
      this.log(`ronda ${roundIndex}: ${bets.map((b) => `${b.type}×${b.amount}`).join(", ")} = ${total}`);
    } catch (err) {
      this.log(`error apostando: ${err.message}`);
    }
  }

  startListening() {
    const r = dbRef(rp(sessionId));
    const handler = async (snap) => {
      if (!snap.exists()) return;
      const sess = snap.val();
      if (sess.status === "betting_open" && sess.currentRound) {
        const idx = sess.currentRound.index;
        if (!this.bettedRounds.has(idx)) await this.placeBet(idx);
      }
    };
    r.on("value", handler);
    this.unsubscribe = () => r.off("value", handler);
  }

  async cleanup() {
    if (this.unsubscribe) { this.unsubscribe(); this.unsubscribe = null; }
    if (this.joined) {
      try { await dbRef(rp(`${sessionId}/players/${this.playerId}`)).remove(); } catch {}
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n╔═══════════════════════════════════════════╗`);
  console.log(`║  TRIPLE NELSON — Ruleta Bot Army          ║`);
  console.log(`║  Session: ${sessionId.padEnd(33)}║`);
  console.log(`║  ENV    : ${FIREBASE_ENV.padEnd(33)}║`);
  console.log(`║  Bots   : ${String(BOT_COUNT).padEnd(33)}║`);
  console.log(`╚═══════════════════════════════════════════╝\n`);

  const sessionSnap = await dbRef(rp(sessionId)).get();
  if (!sessionSnap.exists()) {
    console.error(`[bots] ERROR: sesión ${sessionId} no encontrada en ${FIREBASE_ENV}/roulette`);
    process.exit(1);
  }
  const sess = sessionSnap.val();
  const initialCredits = sess.config?.initialCredits ?? 1000;
  console.log(`[bots] Sesión: status="${sess.status}", ${initialCredits} créditos iniciales`);

  const bots = Array.from({ length: BOT_COUNT }, (_, i) => new RouletteBot(i, initialCredits));

  // Unir en oleadas de 20
  const WAVE = 20;
  for (let i = 0; i < bots.length; i += WAVE) {
    await Promise.all(
      bots.slice(i, i + WAVE).map((b) => b.join().catch((e) => console.warn(`[bot-${b.index}] join error: ${e.message}`)))
    );
    process.stdout.write(`\r[bots] ${Math.min(i + WAVE, bots.length)}/${BOT_COUNT} unidos...`);
    if (i + WAVE < bots.length) await sleep(400);
  }
  console.log(`\n[bots] Todos unidos. Escuchando rondas...`);

  bots.forEach((b) => b.startListening());

  let finished = false;
  const statusRef = dbRef(rp(`${sessionId}/status`));
  const statusHandler = (s) => {
    if (s.val() === "finished") { finished = true; console.log("\n[bots] Partida finalizada."); }
  };
  statusRef.on("value", statusHandler);

  async function shutdown(sig) {
    console.log(`\n[bots] ${sig} — limpiando ${BOT_COUNT} bots...`);
    statusRef.off("value", statusHandler);
    await Promise.allSettled(bots.map((b) => b.cleanup()));
    console.log("[bots] Hecho."); process.exit(0);
  }
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  while (!finished) await sleep(2000);

  await sleep(4000);
  statusRef.off("value", statusHandler);
  await Promise.allSettled(bots.map((b) => b.cleanup()));
  console.log("[bots] Hecho."); process.exit(0);
}

main().catch((err) => { console.error("[bots] Error fatal:", err); process.exit(1); });

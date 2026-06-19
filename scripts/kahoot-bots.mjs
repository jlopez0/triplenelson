/**
 * kahoot-bots.mjs — Simula N jugadores bot en una partida Kahoot
 *
 * Uso:
 *   node scripts/kahoot-bots.mjs <gameId> [cantidad]
 *
 * Ejemplos:
 *   node scripts/kahoot-bots.mjs 123456
 *   node scripts/kahoot-bots.mjs 123456 50
 *   KAHOOT_ENV=dev node scripts/kahoot-bots.mjs 123456 150
 *
 * Variables de entorno opcionales:
 *   KAHOOT_ENV          — "dev" o "prod" (default: "prod")
 *   KAHOOT_BOT_COUNT    — número de bots (default: 150, max: 300)
 *   KAHOOT_ANSWER_DELAY — retraso medio en ms para responder (default: 4000)
 *   KAHOOT_ANSWER_SPREAD — variación aleatoria en ms (default: 6000)
 *   KAHOOT_CORRECT_RATE — fracción de respuestas correctas 0.0–1.0 (default: 0.6)
 */

import { initializeApp } from "firebase/app";
import {
  getDatabase,
  ref,
  set,
  update,
  onValue,
  runTransaction,
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
    // Quitar comillas
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    // Quitar comentarios inline (# después de un espacio)
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
const BOT_COUNT = Math.min(300, Math.max(1, parseInt(process.argv[3] ?? env("KAHOOT_BOT_COUNT", "150"), 10)));
const ANSWER_DELAY_MS = parseInt(env("KAHOOT_ANSWER_DELAY", "4000"), 10);
const ANSWER_SPREAD_MS = parseInt(env("KAHOOT_ANSWER_SPREAD", "6000"), 10);
const CORRECT_RATE = parseFloat(env("KAHOOT_CORRECT_RATE", "0.6")); // 60% de bots aciertan

const gameId = process.argv[2];
if (!gameId) {
  console.error("Uso: node scripts/kahoot-bots.mjs <gameId> [cantidad]");
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

function gp(path) {
  return `${FIREBASE_ENV}/${path}`;
}

// ─── Nombres de bots ──────────────────────────────────────────────────────────
const BOT_NAMES = [
  "Alaia", "Amaia", "Ane", "Aritz", "Asier", "Axier", "Azu", "Bea", "Borja", "Bruno",
  "Carla", "Carlos", "Ceci", "Clara", "Dani", "Diego", "Elena", "Eli", "Eneko", "Erika",
  "Espe", "Fran", "Gabi", "Gorka", "Iker", "Inma", "Iñigo", "Irene", "Ivan", "Jaime",
  "Javi", "Joan", "Jon", "Jorge", "Jose", "Juan", "Julia", "Kepa", "Laura", "Leia",
  "Leo", "Leti", "Lore", "Lucia", "Luis", "Luna", "Marcos", "Maria", "Mario", "Marta",
  "Miguel", "Mireia", "Miriam", "Nadia", "Nagore", "Noa", "Noel", "Nora", "Olatz", "Oier",
  "Pablo", "Pako", "Patricia", "Paula", "Pau", "Peio", "Pedro", "Rakel", "Raul", "Rebe",
  "Rocio", "Rober", "Roel", "Rosa", "Ruben", "Sara", "Sergio", "Silvia", "Sonia", "Txema",
  "Unai", "Ur", "Uxue", "Valen", "Vanesa", "Vero", "Vika", "Xabi", "Xane", "Yolanda",
  "Ainara", "Ainhoa", "Aitor", "Alba", "Alejandro", "Alex", "Ana", "Andoni", "Angel", "Arantxa",
  "Belen", "Berta", "Blanca", "Carmen", "Celia", "Cesar", "Claudia", "Coral", "Cristina", "David",
  "Edurne", "Eduardo", "Egoi", "Emma", "Endika", "Eva", "Felipe", "Fernando", "Gaizka", "Gonzalo",
  "Helena", "Hugo", "Ibai", "Ines", "Isabel", "Izaskun", "Jacobo", "Javier", "Jesus", "Joana",
  "Joseba", "Kevin", "Koldo", "Kristina", "Leyre", "Lidia", "Lorea", "Lourdes", "Maider", "Manuel",
  "Mar", "Marina", "Miren", "Monica", "Naiara", "Natividad", "Nicolas", "Nieves", "Nuria", "Oscar",
  "Patricia2", "Patxi", "Pilar", "Rafael", "Ramon", "Roberto", "Rodrigo", "Samuel", "Sandra", "Sofia",
  "Susana", "Tamara", "Tania", "Teresa", "Txomin", "Urko", "Ursula", "Victor", "Virginia", "Zuriñe",
  "Alaitz", "Amando", "Amparo", "Andres", "Araceli", "Ariadna", "Beatriz", "Belén", "Blas", "Carolina",
  "Cecilia", "Conchi", "Covadonga", "Dolores", "Emilio", "Esperanza", "Esteban", "Eugenia", "Ezequiel", "Felipe2",
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

// ─── Bot ──────────────────────────────────────────────────────────────────────
class KahootBot {
  constructor(index) {
    this.index = index;
    this.name = getBotName(index);
    this.playerId = randomUUID();
    this.answeredQuestions = new Set();
    this.unsubscribe = null;
    this.joined = false;
    // Definir si este bot acertará (basado en CORRECT_RATE)
    this.isCorrectBot = Math.random() < CORRECT_RATE;
  }

  log(msg) {
    if (this.index < 3 || this.index % 50 === 0) {
      // Solo mostrar logs de los primeros 3 bots y cada 50
      console.log(`[bot-${this.index}][${this.name}] ${msg}`);
    }
  }

  async join() {
    const playerRef = ref(db, gp(`games/${gameId}/players/${this.playerId}`));
    await set(playerRef, {
      name: this.name,
      score: 0,
      answered: false,
      joinedAt: Date.now(),
    });
    this.joined = true;
    this.log("joined");
  }

  async submitAnswer(questionIndex, optionsCount, startedAt, correctIndex) {
    if (this.answeredQuestions.has(questionIndex)) return;
    this.answeredQuestions.add(questionIndex);

    // Retraso aleatorio — simula tiempo de reacción humano
    const delay = ANSWER_DELAY_MS + Math.random() * ANSWER_SPREAD_MS;
    await sleep(delay);

    // Decidir qué opción responder
    let optionIndex;
    if (this.isCorrectBot && correctIndex !== undefined && correctIndex !== null) {
      optionIndex = correctIndex;
    } else {
      // Respuesta aleatoria (puede ser correcta por azar)
      optionIndex = Math.floor(Math.random() * optionsCount);
    }

    const timeMs = Math.round(delay);
    const answerRef = ref(db, gp(`games/${gameId}/answers/${questionIndex}/${this.playerId}`));

    try {
      const result = await runTransaction(answerRef, (current) => {
        if (current) return undefined; // ya respondió
        return { optionIndex, timeMs, submittedAt: Date.now() };
      });

      if (result.committed) {
        await update(ref(db), {
          [gp(`games/${gameId}/players/${this.playerId}/answered`)]: true,
        });
        this.log(`answered Q${questionIndex} → opción ${optionIndex} (${timeMs}ms)`);
      }
    } catch (err) {
      this.log(`error respondiendo: ${err.message}`);
    }
  }

  startListening() {
    const gameRef = ref(db, gp(`games/${gameId}`));
    this.unsubscribe = onValue(gameRef, async (snap) => {
      if (!snap.exists()) return;
      const game = snap.val();

      if (game.status === "question" && game.currentQuestion) {
        const qi = game.currentQuestionIndex;
        const { options, startedAt, correctIndex } = game.currentQuestion;
        if (!this.answeredQuestions.has(qi)) {
          await this.submitAnswer(qi, options?.length ?? 4, startedAt, correctIndex);
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
        await remove(ref(db, gp(`games/${gameId}/players/${this.playerId}`)));
      } catch {
        // ignorar errores en cleanup
      }
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`
╔══════════════════════════════════════════════╗
║       TRIPLE NELSON — Kahoot Bot Army        ║
╠══════════════════════════════════════════════╣
║  GameId  : ${gameId.padEnd(34)}║
║  ENV     : ${FIREBASE_ENV.padEnd(34)}║
║  Bots    : ${String(BOT_COUNT).padEnd(34)}║
║  Acierto : ${String(Math.round(CORRECT_RATE * 100) + "%").padEnd(34)}║
║  Delay   : ${String(`${ANSWER_DELAY_MS}-${ANSWER_DELAY_MS + ANSWER_SPREAD_MS}ms`).padEnd(34)}║
╚══════════════════════════════════════════════╝
`);

  // Verificar que el juego existe
  const gameRef = ref(db, gp(`games/${gameId}`));
  const snap = await new Promise((resolve) => {
    const unsub = onValue(gameRef, (s) => {
      unsub();
      resolve(s);
    });
  });

  if (!snap.exists()) {
    console.error(`[bots] ERROR: No existe el juego ${gameId} en ${FIREBASE_ENV}/games/${gameId}`);
    console.error(`[bots] Asegúrate de crear la partida desde el panel admin primero.`);
    process.exit(1);
  }

  const game = snap.val();
  console.log(`[bots] Juego encontrado: status="${game.status}", ${game.totalQuestions} preguntas`);

  if (game.status === "finished") {
    console.warn("[bots] AVISO: El juego ya está terminado. Los bots se unirán igualmente.");
  }

  // Crear bots
  const bots = Array.from({ length: BOT_COUNT }, (_, i) => new KahootBot(i));

  // Unir bots en oleadas para no saturar Firebase (50 por oleada, 200ms entre oleadas)
  console.log(`[bots] Uniendo ${BOT_COUNT} bots en oleadas...`);
  const WAVE_SIZE = 50;
  const WAVE_DELAY = 300;

  for (let i = 0; i < bots.length; i += WAVE_SIZE) {
    const wave = bots.slice(i, i + WAVE_SIZE);
    await Promise.all(wave.map((b) => b.join().catch((e) => console.warn(`[bot-${b.index}] join error: ${e.message}`))));
    const joined = Math.min(i + WAVE_SIZE, bots.length);
    process.stdout.write(`\r[bots] ${joined}/${BOT_COUNT} unidos...`);
    if (i + WAVE_SIZE < bots.length) await sleep(WAVE_DELAY);
  }
  console.log(`\n[bots] Todos unidos. Escuchando cambios de estado...`);

  // Activar listeners
  bots.forEach((b) => b.startListening());

  // Escuchar estado del juego para saber cuándo termina
  let finished = false;
  const gameStatusRef = ref(db, gp(`games/${gameId}/status`));
  const unsubStatus = onValue(gameStatusRef, (s) => {
    const status = s.val();
    if (status === "finished") {
      finished = true;
      console.log("\n[bots] El juego terminó. Limpiando bots...");
    }
  });

  // Gestión de señales de salida
  async function shutdown(signal) {
    console.log(`\n[bots] ${signal} recibido. Limpiando ${BOT_COUNT} bots...`);
    unsubStatus();
    await Promise.allSettled(bots.map((b) => b.cleanup()));
    console.log("[bots] Bots eliminados del juego. Saliendo.");
    process.exit(0);
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // Esperar a que termine el juego o Ctrl+C
  while (!finished) {
    await sleep(2000);
  }

  // Limpiar tras fin del juego
  await sleep(3000); // dar tiempo a que se vean en el leaderboard
  unsubStatus();
  console.log("[bots] Limpiando bots del RTDB...");
  await Promise.allSettled(bots.map((b) => b.cleanup()));
  console.log("[bots] Hecho. Bots eliminados.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[bots] Error fatal:", err);
  process.exit(1);
});

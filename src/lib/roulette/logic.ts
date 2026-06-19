import type {
  Bet,
  BetType,
  RouletteColor,
  RoulettePlayer,
  WheelDataItem,
} from "./types";

const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);
const BLACK_NUMBERS = new Set([
  2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35,
]);

export const EUROPEAN_WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
] as const;

export const BET_LIMITS: Record<
  BetType,
  { min: number; max: number; payout: number }
> = {
  number: { min: 10, max: 100, payout: 35 },
  corner: { min: 20, max: 200, payout: 9 },  // 4 números, paga 8:1 neto (x9)
  red: { min: 50, max: 500, payout: 2 },
  black: { min: 50, max: 500, payout: 2 },
  even: { min: 50, max: 500, payout: 2 },
  odd: { min: 50, max: 500, payout: 2 },
  low: { min: 50, max: 500, payout: 2 },
  high: { min: 50, max: 500, payout: 2 },
  dozen1: { min: 30, max: 300, payout: 3 },
  dozen2: { min: 30, max: 300, payout: 3 },
  dozen3: { min: 30, max: 300, payout: 3 },
};

export const BET_TYPE_LABELS: Record<BetType, string> = {
  number: "Número",
  corner: "Cuatro",
  red: "Rojo",
  black: "Negro",
  even: "Par",
  odd: "Impar",
  low: "1-18",
  high: "19-36",
  dozen1: "1ª docena (1-12)",
  dozen2: "2ª docena (13-24)",
  dozen3: "3ª docena (25-36)",
};

// Esquinas válidas: cada array de 4 números que forman un cuadrado en la mesa.
// La mesa tiene 3 filas (fila 1 = col*3+1, fila 2 = col*3+2, fila 3 = col*3+3).
// Un corner cubre [n, n+1, n+3, n+4] en layout columnar.
export const CORNER_GROUPS: number[][] = [];
for (let col = 0; col < 11; col++) {
  for (let row = 1; row <= 2; row++) {
    const n = col * 3 + row;
    CORNER_GROUPS.push([n, n + 1, n + 3, n + 4]);
  }
}

export function getNumberColor(n: number): RouletteColor {
  if (n === 0) return "green";
  if (RED_NUMBERS.has(n)) return "red";
  if (BLACK_NUMBERS.has(n)) return "black";
  throw new Error(`Número fuera de rango: ${n}`);
}

export function doesBetWin(bet: Bet, result: number): boolean {
  if (result < 0 || result > 36) return false;
  switch (bet.type) {
    case "number":
      return bet.value !== null && bet.value === result;
    case "corner": {
      // value encodes the corner as the smallest number of the group
      if (bet.value === null) return false;
      const group = CORNER_GROUPS.find((g) => g[0] === bet.value);
      return group ? group.includes(result) : false;
    }
    case "red":
      return getNumberColor(result) === "red";
    case "black":
      return getNumberColor(result) === "black";
    case "even":
      return result !== 0 && result % 2 === 0;
    case "odd":
      return result !== 0 && result % 2 === 1;
    case "low":
      return result >= 1 && result <= 18;
    case "high":
      return result >= 19 && result <= 36;
    case "dozen1":
      return result >= 1 && result <= 12;
    case "dozen2":
      return result >= 13 && result <= 24;
    case "dozen3":
      return result >= 25 && result <= 36;
    default:
      return false;
  }
}

export function calculatePayout(bet: Bet): number {
  return BET_LIMITS[bet.type].payout;
}

export function calculateBetDelta(bet: Bet, result: number): number {
  if (doesBetWin(bet, result)) {
    return bet.amount * (calculatePayout(bet) - 1);
  }
  return -bet.amount;
}

export function validateBet(
  bet: Bet,
  playerCredits: number,
): { ok: true } | { ok: false; reason: string } {
  if (!BET_LIMITS[bet.type]) {
    return { ok: false, reason: "Tipo de apuesta inválido." };
  }
  const { min, max } = BET_LIMITS[bet.type];

  if (bet.type === "number") {
    if (bet.value === null || !Number.isInteger(bet.value) || bet.value < 0 || bet.value > 36) {
      return { ok: false, reason: "Número fuera de rango (0-36)." };
    }
  } else if (bet.type === "corner") {
    if (bet.value === null || !CORNER_GROUPS.find((g) => g[0] === bet.value)) {
      return { ok: false, reason: "Esquina inválida." };
    }
  } else if (bet.value !== null) {
    return { ok: false, reason: "Esta apuesta no admite valor." };
  }

  if (!Number.isInteger(bet.amount)) {
    return { ok: false, reason: "Cantidad inválida." };
  }
  if (bet.amount < min) {
    return { ok: false, reason: `Mínimo ${min} créditos.` };
  }
  if (bet.amount > max) {
    return { ok: false, reason: `Máximo ${max} créditos.` };
  }

  if (playerCredits <= 0) {
    return { ok: false, reason: "Sin créditos." };
  }
  const cap = Math.floor(playerCredits / 2);
  if (bet.amount > cap) {
    return {
      ok: false,
      reason: `No puedes apostar más del 50% de tu saldo (${cap} máx).`,
    };
  }
  if (bet.amount > playerCredits) {
    return { ok: false, reason: "Saldo insuficiente." };
  }

  return { ok: true };
}

export function buildWheelData(): WheelDataItem[] {
  return Array.from({ length: 37 }, (_, n) => {
    const color = getNumberColor(n);
    const backgroundColor =
      color === "red" ? "#dc2626" : color === "black" ? "#111111" : "#16a34a";
    return {
      option: String(n),
      style: { backgroundColor, textColor: "#ffffff" },
    };
  });
}

export function calculateTotalDelta(bets: Bet[], result: number): number {
  return bets.reduce((sum, bet) => sum + calculateBetDelta(bet, result), 0);
}

export function totalBetAmount(bets: Bet[]): number {
  return bets.reduce((sum, b) => sum + b.amount, 0);
}

export function checkAllBetsIn(
  players: Record<string, RoulettePlayer>,
): boolean {
  const active = Object.values(players).filter((p) => !p.eliminated);
  if (active.length === 0) return false;
  return active.every((p) => p.hasBet);
}

export function countActivePlayers(
  players: Record<string, RoulettePlayer>,
): number {
  return Object.values(players).filter((p) => !p.eliminated).length;
}

export function countBetsPlaced(
  players: Record<string, RoulettePlayer>,
): number {
  return Object.values(players).filter((p) => !p.eliminated && p.hasBet).length;
}

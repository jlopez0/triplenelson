"use client";

import type { Bet, BetType } from "@/lib/roulette/types";
import { BET_LIMITS } from "@/lib/roulette/logic";

// Números rojos de la ruleta europea
const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

function numColor(n: number): "red" | "black" | "green" {
  if (n === 0) return "green";
  return RED_NUMBERS.has(n) ? "red" : "black";
}

interface Props {
  credits: number;
  onBetSelect: (type: BetType, value: number | null, amount: number) => void;
  selectedBet: { type: BetType; value: number | null } | null;
  disabled?: boolean;
}

// Columnas de la mesa (3 filas × 12 columnas = 36 números + 0)
// La mesa estándar tiene los números así:
//  3  6  9 12 15 18 21 24 27 30 33 36
//  2  5  8 11 14 17 20 23 26 29 32 35
//  1  4  7 10 13 16 19 22 25 28 31 34
const COLUMNS = Array.from({ length: 12 }, (_, col) => [
  col * 3 + 3,
  col * 3 + 2,
  col * 3 + 1,
]);

export function RouletteBettingBoard({ credits, onBetSelect, selectedBet, disabled = false }: Props) {
  const maxBet50 = Math.min(500, Math.floor(credits / 2));
  const maxBet30 = Math.min(300, Math.floor(credits / 2));
  const maxBet10 = Math.min(100, Math.floor(credits / 2));

  function defaultAmount(type: BetType): number {
    const { min, max } = BET_LIMITS[type];
    const cap = Math.floor(credits / 2);
    const allowed = Math.min(max, cap);
    return allowed >= min ? min : min;
  }

  function select(type: BetType, value: number | null) {
    if (disabled) return;
    onBetSelect(type, value, defaultAmount(type));
  }

  function isSelected(type: BetType, value: number | null): boolean {
    if (!selectedBet) return false;
    return selectedBet.type === type && selectedBet.value === value;
  }

  const cellBase =
    "flex items-center justify-center rounded font-bold text-white text-sm select-none transition-all cursor-pointer active:scale-95";

  function numClass(n: number): string {
    const color = numColor(n);
    const bg =
      color === "red"
        ? "bg-[#dc2626] hover:bg-[#ef4444]"
        : color === "green"
          ? "bg-[#16a34a] hover:bg-[#22c55e]"
          : "bg-[#1a1a1a] hover:bg-[#333]";
    const ring = isSelected("number", n)
      ? "ring-4 ring-yellow-400 ring-offset-1 ring-offset-black scale-110 z-10"
      : "";
    return `${cellBase} ${bg} ${ring} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`;
  }

  function zoneClass(type: BetType, value: number | null, baseColor: string): string {
    const ring = isSelected(type, value)
      ? "ring-4 ring-yellow-400 ring-offset-1 ring-offset-black"
      : "";
    return `${cellBase} ${baseColor} ${ring} text-xs uppercase tracking-[0.12em] ${disabled ? "opacity-50 cursor-not-allowed" : ""}`;
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[340px]">
        {/* Cuadrícula principal */}
        <div className="flex gap-1">
          {/* 0 */}
          <div className="flex w-10 shrink-0 items-stretch">
            <button
              type="button"
              onClick={() => select("number", 0)}
              disabled={disabled || Math.floor(credits / 2) < BET_LIMITS.number.min}
              className={`${numClass(0)} w-full`}
              style={{ writingMode: "vertical-rl", textOrientation: "upright", letterSpacing: "0.05em" }}
            >
              0
            </button>
          </div>

          {/* Números 1-36 en columnas */}
          <div className="flex flex-1 flex-col gap-1">
            {/* Filas de números */}
            <div className="grid grid-cols-12 gap-1" style={{ gridTemplateRows: "repeat(3, 1fr)" }}>
              {COLUMNS.flatMap((col, ci) =>
                col.map((n, ri) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => select("number", n)}
                    disabled={disabled || Math.floor(credits / 2) < BET_LIMITS.number.min}
                    className={`${numClass(n)} aspect-[3/4] text-xs md:text-sm`}
                    style={{ gridColumn: ci + 1, gridRow: ri + 1 }}
                  >
                    {n}
                  </button>
                ))
              )}
            </div>

            {/* Docenas */}
            <div className="grid grid-cols-3 gap-1">
              {(["dozen1", "dozen2", "dozen3"] as const).map((d, i) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => select(d, null)}
                  disabled={disabled || Math.floor(credits / 2) < BET_LIMITS[d].min}
                  className={zoneClass(d, null, "bg-zinc-800 hover:bg-zinc-700 py-2")}
                >
                  {i === 0 ? "1ª docena" : i === 1 ? "2ª docena" : "3ª docena"}
                </button>
              ))}
            </div>

            {/* Apuestas simples: 6 zonas */}
            <div className="grid grid-cols-6 gap-1">
              <button
                type="button"
                onClick={() => select("low", null)}
                disabled={disabled || maxBet50 < BET_LIMITS.low.min}
                className={zoneClass("low", null, "bg-zinc-800 hover:bg-zinc-700 py-3")}
              >
                1-18
              </button>
              <button
                type="button"
                onClick={() => select("even", null)}
                disabled={disabled || maxBet50 < BET_LIMITS.even.min}
                className={zoneClass("even", null, "bg-zinc-800 hover:bg-zinc-700 py-3")}
              >
                Par
              </button>
              <button
                type="button"
                onClick={() => select("red", null)}
                disabled={disabled || maxBet50 < BET_LIMITS.red.min}
                className={zoneClass("red", null, "bg-[#dc2626] hover:bg-[#ef4444] py-3")}
              >
                Rojo
              </button>
              <button
                type="button"
                onClick={() => select("black", null)}
                disabled={disabled || maxBet50 < BET_LIMITS.black.min}
                className={zoneClass("black", null, "bg-[#1a1a1a] hover:bg-[#333] py-3 border border-zinc-700")}
              >
                Negro
              </button>
              <button
                type="button"
                onClick={() => select("odd", null)}
                disabled={disabled || maxBet50 < BET_LIMITS.odd.min}
                className={zoneClass("odd", null, "bg-zinc-800 hover:bg-zinc-700 py-3")}
              >
                Impar
              </button>
              <button
                type="button"
                onClick={() => select("high", null)}
                disabled={disabled || maxBet50 < BET_LIMITS.high.min}
                className={zoneClass("high", null, "bg-zinc-800 hover:bg-zinc-700 py-3")}
              >
                19-36
              </button>
            </div>
          </div>

          {/* Columnas 2:1 */}
          <div className="flex w-10 shrink-0 flex-col gap-1">
            {/* Estas columnas apuestan a la fila entera: no están en spec así que las omitimos */}
          </div>
        </div>

        {/* Leyenda del pago */}
        {selectedBet ? (
          <div className="mt-3 rounded-lg border border-yellow-400/40 bg-yellow-400/10 px-3 py-2 text-center text-xs text-yellow-200">
            {selectedBet.type === "number"
              ? `Número ${selectedBet.value} · paga x35`
              : selectedBet.type === "red" || selectedBet.type === "black"
                ? `Color · paga x2`
                : selectedBet.type === "even" || selectedBet.type === "odd"
                  ? `Par/Impar · paga x2`
                  : selectedBet.type === "low" || selectedBet.type === "high"
                    ? `Mitad · paga x2`
                    : `Docena · paga x3`}
          </div>
        ) : (
          <p className="mt-3 text-center text-xs text-zinc-500">Toca un número o zona para apostar</p>
        )}
      </div>
    </div>
  );
}

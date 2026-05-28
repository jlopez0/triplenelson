"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Bet, BetType } from "@/lib/roulette/types";
import { BET_LIMITS } from "@/lib/roulette/logic";

// ── Chips ────────────────────────────────────────────────────────────────────
const CHIP_VALUES = [5, 10, 25, 50, 100, 500] as const;
type ChipValue = (typeof CHIP_VALUES)[number];

const CHIP_STYLE: Record<ChipValue, { bg: string; border: string; text: string }> = {
  5:   { bg: "bg-zinc-600",   border: "border-zinc-300",   text: "text-white" },
  10:  { bg: "bg-blue-600",   border: "border-blue-300",   text: "text-white" },
  25:  { bg: "bg-red-600",    border: "border-red-300",    text: "text-white" },
  50:  { bg: "bg-green-600",  border: "border-green-300",  text: "text-white" },
  100: { bg: "bg-purple-700", border: "border-purple-300", text: "text-white" },
  500: { bg: "bg-yellow-500", border: "border-yellow-200", text: "text-black" },
};

function Chip({
  value, size = "md", selected = false, disabled = false, onClick,
}: {
  value: ChipValue; size?: "sm" | "md"; selected?: boolean; disabled?: boolean; onClick?: () => void;
}) {
  const s = CHIP_STYLE[value];
  const dim = size === "sm" ? "h-7 w-7 text-[9px]" : "h-12 w-12 text-xs";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        flex-shrink-0 ${dim} rounded-full border-2 font-bold
        ${s.bg} ${s.border} ${s.text}
        transition-all active:scale-90
        ${selected ? "scale-110 ring-2 ring-white ring-offset-1 ring-offset-black" : ""}
        ${disabled ? "opacity-25 cursor-not-allowed" : "hover:scale-105 cursor-pointer"}
      `}
    >
      {value >= 1000 ? `${value / 1000}k` : value}
    </button>
  );
}

// Mini chip flotante sobre zona
function ChipStack({ bets, type, value = null }: { bets: Bet[]; type: BetType; value?: number | null }) {
  const zoneBets = bets.filter((b) => b.type === type && b.value === value);
  if (!zoneBets.length) return null;
  const total = zoneBets.reduce((s, b) => s + b.amount, 0);
  const topChip = ([...CHIP_VALUES].reverse().find((v) => v <= total) ?? CHIP_VALUES[0]) as ChipValue;
  const s = CHIP_STYLE[topChip];
  return (
    <span
      className={`pointer-events-none absolute -top-2.5 -right-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 text-[9px] font-bold shadow-lg ${s.bg} ${s.border} ${s.text}`}
    >
      {total >= 1000 ? `${(total / 1000).toFixed(1)}k` : total}
    </span>
  );
}

// ── Números rojos ─────────────────────────────────────────────────────────────
const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
function numColor(n: number): "red" | "black" | "green" {
  if (n === 0) return "green";
  return RED_NUMBERS.has(n) ? "red" : "black";
}
const COLUMNS: number[][] = Array.from({ length: 12 }, (_, col) => [col*3+3, col*3+2, col*3+1]);

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  credits: number;
  pendingBets: Bet[];
  onAdd: (bet: Bet) => void;
  onClear: () => void;
  onConfirm: () => void;
  disabled?: boolean;
  confirming?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function CasinoBettingUI({
  credits, pendingBets, onAdd, onClear, onConfirm, disabled = false, confirming = false,
}: Props) {
  const totalBet = pendingBets.reduce((s, b) => s + b.amount, 0);
  const remaining = credits - totalBet;

  const [selectedChip, setSelectedChip] = useState<ChipValue>(10);
  const [showNumberModal, setShowNumberModal] = useState(false);

  function canAfford(chip: ChipValue) { return chip <= remaining; }

  function addBet(type: BetType, value: number | null = null) {
    if (disabled) return;
    const amount = selectedChip;
    if (amount > remaining) return;
    const limits = BET_LIMITS[type];
    // Chip amount must be ≥ min of that bet type
    if (amount < limits.min) return;
    onAdd({ type, value, amount });
  }

  function handleZoneClick(type: BetType, value: number | null = null) {
    if (disabled) return;
    if (type === "number" && value === null) { setShowNumberModal(true); return; }
    addBet(type, value);
  }

  function handleNumberPick(n: number) {
    setShowNumberModal(false);
    addBet("number", n);
  }

  const cellBase =
    "relative flex items-center justify-center rounded font-bold text-white text-xs select-none transition-all cursor-pointer active:scale-95 min-h-[48px]";

  function numCellClass(n: number) {
    const c = numColor(n);
    const bg = c === "red" ? "bg-[#b91c1c] hover:bg-[#dc2626]" : c === "green" ? "bg-[#15803d] hover:bg-[#16a34a]" : "bg-[#111] hover:bg-[#222]";
    return `${cellBase} ${bg} text-[11px] ${disabled ? "opacity-50 cursor-not-allowed" : ""}`;
  }

  function zoneClass(type: BetType, value: number | null = null, extra = "") {
    const hasBet = pendingBets.some((b) => b.type === type && b.value === value);
    return `${cellBase} bg-zinc-800 hover:bg-zinc-700 ${extra} ${hasBet ? "ring-1 ring-yellow-400/60" : ""} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`;
  }

  return (
    <div className="flex flex-col gap-0 pb-24">
      {/* ── Chip selector ── */}
      <div className="flex items-center gap-2 px-1 pb-2">
        <span className="shrink-0 text-[10px] uppercase tracking-[0.2em] text-zinc-500">Chip</span>
        <div className="flex gap-2 overflow-x-auto py-1">
          {CHIP_VALUES.map((v) => (
            <Chip
              key={v} value={v}
              selected={selectedChip === v}
              disabled={!canAfford(v) || disabled}
              onClick={() => setSelectedChip(v)}
            />
          ))}
        </div>
      </div>

      {/* ── Mesa ── */}
      <div className="w-full overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60 p-2">
        <div className="min-w-[290px]">
          <div className="flex gap-1">
            {/* 0 */}
            <button type="button" onClick={() => handleZoneClick("number", 0)} disabled={disabled || selectedChip < BET_LIMITS.number.min}
              className={`${numCellClass(0)} w-9 shrink-0`}
              style={{ writingMode: "vertical-rl", textOrientation: "upright", letterSpacing: "0.06em" }}>
              0
              <ChipStack bets={pendingBets} type="number" value={0} />
            </button>

            <div className="flex flex-1 flex-col gap-1">
              {/* Números 1-36 */}
              <div className="grid grid-cols-12 gap-0.5">
                {COLUMNS.flatMap((col, ci) =>
                  col.map((n, ri) => (
                    <button key={n} type="button"
                      onClick={() => handleZoneClick("number", n)}
                      disabled={disabled || selectedChip < BET_LIMITS.number.min}
                      className={`${numCellClass(n)} aspect-[3/4]`}
                      style={{ gridColumn: ci + 1, gridRow: ri + 1 }}>
                      {n}
                      <ChipStack bets={pendingBets} type="number" value={n} />
                    </button>
                  ))
                )}
              </div>

              {/* Docenas */}
              <div className="grid grid-cols-3 gap-1">
                {(["dozen1","dozen2","dozen3"] as const).map((d, i) => (
                  <button key={d} type="button" onClick={() => handleZoneClick(d)} disabled={disabled || selectedChip < BET_LIMITS[d].min}
                    className={zoneClass(d, null, "text-[10px] uppercase tracking-[0.08em] py-2")}>
                    {i===0?"1ª doc.":i===1?"2ª doc.":"3ª doc."}
                    <ChipStack bets={pendingBets} type={d} />
                  </button>
                ))}
              </div>

              {/* Apuestas simples */}
              <div className="grid grid-cols-6 gap-1">
                {([
                  { type: "low",   label: "1-18",  extra: "" },
                  { type: "even",  label: "PAR",   extra: "" },
                  { type: "red",   label: "ROJO",  extra: "bg-[#b91c1c] hover:bg-[#dc2626]" },
                  { type: "black", label: "NEG",   extra: "bg-[#111] hover:bg-[#222] border border-zinc-700" },
                  { type: "odd",   label: "IMPAR", extra: "" },
                  { type: "high",  label: "19-36", extra: "" },
                ] as { type: BetType; label: string; extra: string }[]).map(({ type, label, extra }) => (
                  <button key={type} type="button" onClick={() => handleZoneClick(type)} disabled={disabled || selectedChip < BET_LIMITS[type].min}
                    className={`${cellBase} ${extra || "bg-zinc-800 hover:bg-zinc-700"} text-[9px] uppercase tracking-[0.06em] py-3 ${pendingBets.some(b=>b.type===type) ? "ring-1 ring-yellow-400/60" : ""} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}>
                    {label}
                    <ChipStack bets={pendingBets} type={type} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Barra inferior fija ── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-700 bg-black/95 px-3 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-2">
          <button type="button" onClick={onClear} disabled={!pendingBets.length || disabled}
            className="min-h-[48px] shrink-0 rounded-lg border border-zinc-700 bg-zinc-900 px-4 text-sm font-semibold uppercase tracking-[0.14em] text-zinc-300 active:scale-95 disabled:opacity-30">
            Limpiar
          </button>
          <div className="flex-1 text-center leading-tight">
            {pendingBets.length ? (
              <>
                <p className="text-xs text-zinc-400">{pendingBets.length} apuesta{pendingBets.length>1?"s":""}</p>
                <p className="font-mono font-bold text-white">
                  <span className="text-yellow-300">{totalBet}</span>
                  <span className="text-zinc-500 text-xs"> · saldo {remaining}</span>
                </p>
              </>
            ) : (
              <p className="text-xs text-zinc-500">Toca la mesa para apostar</p>
            )}
          </div>
          <button type="button" onClick={onConfirm} disabled={!pendingBets.length || disabled || confirming}
            className="min-h-[48px] shrink-0 rounded-lg bg-white px-5 text-sm font-bold uppercase tracking-[0.14em] text-black active:scale-95 disabled:opacity-30">
            {confirming ? "..." : "Confirmar"}
          </button>
        </div>
      </div>

      {/* ── Modal número exacto ── */}
      <AnimatePresence>
        {showNumberModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setShowNumberModal(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-t-2xl border-t border-zinc-700 bg-zinc-950 p-4 pb-8">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-300">Número exacto · x35</p>
                <button type="button" onClick={() => setShowNumberModal(false)} className="text-xl text-zinc-500">✕</button>
              </div>
              <button type="button" onClick={() => handleNumberPick(0)}
                className="mb-2 w-full rounded-lg bg-[#15803d] py-3 text-sm font-bold text-white active:scale-95">
                0
              </button>
              <div className="grid grid-cols-6 gap-1">
                {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => (
                  <button key={n} type="button" onClick={() => handleNumberPick(n)}
                    className={`rounded-md py-3 text-sm font-bold text-white active:scale-95 ${numColor(n)==="red" ? "bg-[#b91c1c]" : "bg-[#111] border border-zinc-700"}`}>
                    {n}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Bet, BetType } from "@/lib/roulette/types";
import { BET_LIMITS, CORNER_GROUPS, EUROPEAN_WHEEL_ORDER } from "@/lib/roulette/logic";

// ── Chips ─────────────────────────────────────────────────────────────────────
const CHIP_VALUES = [10, 25, 50, 100, 500] as const;
type ChipValue = (typeof CHIP_VALUES)[number];

const CHIP_STYLE: Record<ChipValue, { bg: string; border: string; text: string }> = {
  10:  { bg: "bg-blue-600",   border: "border-blue-300",   text: "text-white" },
  25:  { bg: "bg-red-600",    border: "border-red-300",    text: "text-white" },
  50:  { bg: "bg-green-600",  border: "border-green-300",  text: "text-white" },
  100: { bg: "bg-purple-700", border: "border-purple-300", text: "text-white" },
  500: { bg: "bg-yellow-500", border: "border-yellow-200", text: "text-black" },
};

function Chip({ value, selected = false, disabled = false, onClick }: {
  value: ChipValue; selected?: boolean; disabled?: boolean; onClick?: () => void;
}) {
  const s = CHIP_STYLE[value];
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`flex-shrink-0 h-10 w-10 rounded-full border-2 font-bold text-[11px]
        ${s.bg} ${s.border} ${s.text} transition-all active:scale-90
        ${selected ? "scale-110 ring-2 ring-white ring-offset-1 ring-offset-black" : ""}
        ${disabled ? "opacity-25 cursor-not-allowed" : "cursor-pointer"}`}>
      {value >= 1000 ? `${value / 1000}k` : value}
    </button>
  );
}

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
function numColor(n: number): "red" | "black" | "green" {
  if (n === 0) return "green";
  return RED_NUMBERS.has(n) ? "red" : "black";
}

// ── Mesa SVG con hitboxes reales para número, split y corner ─────────────────
// Layout: 3 filas × 12 columnas (números 1-36) + columna del 0
// Fila 1 (top): 3,6,9,12,15,18,21,24,27,30,33,36
// Fila 2 (mid): 2,5,8,11,14,17,20,23,26,29,32,35
// Fila 3 (bot): 1,4,7,10,13,16,19,22,25,28,31,34

// Para número n: col = Math.floor((n-1)/3), row = (n-1)%3 → row 0=bot,1=mid,2=top
// Queremos row 0=top display → invertimos: displayRow = 2 - ((n-1)%3)
// col 0 = numbers 1,2,3; col 1 = 4,5,6 ...

function numToGrid(n: number): { col: number; row: number } {
  // col 0..11, row 0=top(3,6..), 1=mid(2,5..), 2=bot(1,4..)
  const col = Math.floor((n - 1) / 3);
  const rawRow = (n - 1) % 3; // 0→n%3==1(1,4,7..) 1→n%3==2(2,5..) 2→n%3==0(3,6..)
  const row = 2 - rawRow; // flip so row0=top
  return { col, row };
}

type BetMode = "number" | "corner";

interface SVGTableProps {
  pendingBets: Bet[];
  onBet: (type: BetType, value: number | null) => void;
  betMode: BetMode;
  disabled: boolean;
  chip: ChipValue;
}

function SVGTable({ pendingBets, onBet, betMode, disabled, chip }: SVGTableProps) {
  const [activeHit, setActiveHit] = useState<string | null>(null);

  // SVG dimensions
  const COLS = 12;
  const ROWS = 3;
  const CW = 28;  // cell width
  const CH = 30;  // cell height
  const ZW = 18;  // zero width
  const GAP = 1;
  const PAD = 2;
  const BOTTOM = 22; // space for dozen+simple rows
  const svgW = PAD + ZW + GAP + COLS * CW + (COLS - 1) * GAP + PAD;
  const svgH = PAD + ROWS * CH + (ROWS - 1) * GAP + GAP + BOTTOM + BOTTOM + PAD;

  function cellX(col: number) { return PAD + ZW + GAP + col * (CW + GAP); }
  function cellY(row: number) { return PAD + row * (CH + GAP); }

  function numFill(n: number, hit: boolean) {
    const c = numColor(n);
    if (hit) return c === "red" ? "#ef4444" : c === "green" ? "#22c55e" : "#525252";
    return c === "red" ? "#b91c1c" : c === "green" ? "#15803d" : "#1c1c1c";
  }

  function betTotal(type: BetType, value: number | null) {
    return pendingBets.filter((b) => b.type === type && b.value === value).reduce((s, b) => s + b.amount, 0);
  }

  // Corner hitbox size (overlaps 4 cells)
  const HIT = 11; // half-size of corner hitbox

  // Check if corner anchor n is valid
  function isCornerAnchor(n: number) {
    return CORNER_GROUPS.some((g) => g[0] === n);
  }

  const dozenY = PAD + ROWS * CH + (ROWS - 1) * GAP + GAP;
  const simpleY = dozenY + BOTTOM + GAP;
  const dozenH = BOTTOM - 2;
  const simpleH = BOTTOM - 2;

  // Dozen & simple zones
  const DOZEN_ZONES: { type: BetType; label: string; col: number; span: number }[] = [
    { type: "dozen1", label: "1-12",  col: 0, span: 4 },
    { type: "dozen2", label: "13-24", col: 4, span: 4 },
    { type: "dozen3", label: "25-36", col: 8, span: 4 },
  ];
  const SIMPLE_ZONES: { type: BetType; label: string; col: number; span: number; fill?: string }[] = [
    { type: "low",   label: "1-18",  col: 0, span: 2 },
    { type: "even",  label: "PAR",   col: 2, span: 2 },
    { type: "red",   label: "●",     col: 4, span: 2, fill: "#b91c1c" },
    { type: "black", label: "●",     col: 6, span: 2, fill: "#111" },
    { type: "odd",   label: "IMPAR", col: 8, span: 2 },
    { type: "high",  label: "19-36", col: 10, span: 2 },
  ];

  function zoneX(col: number) { return PAD + ZW + GAP + col * (CW + GAP); }
  function zoneW(span: number) { return span * CW + (span - 1) * GAP; }

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="w-full h-full"
      style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}>

      {/* ── Zero ── */}
      <g onClick={() => !disabled && onBet("number", 0)}
        style={{ cursor: disabled ? "default" : "pointer" }}>
        <rect x={PAD} y={PAD} width={ZW} height={ROWS * CH + (ROWS - 1) * GAP}
          rx={3} fill={activeHit === "n0" ? "#22c55e" : "#15803d"} stroke="#27272a" strokeWidth={0.5}
          onPointerDown={() => setActiveHit("n0")} onPointerUp={() => setActiveHit(null)} onPointerLeave={() => setActiveHit(null)} />
        <text x={PAD + ZW / 2} y={PAD + (ROWS * CH + (ROWS - 1) * GAP) / 2}
          textAnchor="middle" dominantBaseline="middle" fontSize={10} fontWeight="bold" fill="#fff"
          style={{ pointerEvents: "none", userSelect: "none" }}>0</text>
        {betTotal("number", 0) > 0 && (
          <circle cx={PAD + ZW - 4} cy={PAD + 4} r={5} fill="#fde047" />
        )}
      </g>

      {/* ── Celdas de números 1-36 ── */}
      {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => {
        const { col, row } = numToGrid(n);
        const x = cellX(col), y = cellY(row);
        const hitKey = `n${n}`;
        const isHit = activeHit === hitKey;
        const total = betTotal("number", n);

        return (
          <g key={n}
            onClick={() => !disabled && betMode === "number" && onBet("number", n)}
            style={{ cursor: disabled || betMode !== "number" ? "default" : "pointer" }}>
            <rect x={x} y={y} width={CW} height={CH} rx={2}
              fill={numFill(n, isHit && betMode === "number")}
              stroke="#27272a" strokeWidth={0.5}
              onPointerDown={() => betMode === "number" && setActiveHit(hitKey)}
              onPointerUp={() => setActiveHit(null)}
              onPointerLeave={() => setActiveHit(null)} />
            <text x={x + CW / 2} y={y + CH / 2}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={n >= 10 ? 8 : 9} fontWeight="bold" fill="#fff"
              style={{ pointerEvents: "none", userSelect: "none" }}>{n}</text>
            {total > 0 && (
              <circle cx={x + CW - 4} cy={y + 4} r={5} fill="#fde047" />
            )}
          </g>
        );
      })}

      {/* ── Corner hitboxes (solo en betMode=corner) ── */}
      {betMode === "corner" && CORNER_GROUPS.map((group) => {
        const anchor = group[0];
        const { col, row } = numToGrid(anchor);
        // El corner está en la esquina bottom-right de la celda [row, col]
        // que coincide con top-left de [row+1, col+1]
        // row aumenta hacia abajo, corner entre row y row+1
        const cx2 = cellX(col) + CW; // borde derecho de col
        const cy2 = cellY(row) + CH; // borde inferior de row
        const hitKey = `c${anchor}`;
        const isHit = activeHit === hitKey;
        const total = betTotal("corner", anchor);

        return (
          <g key={`corner-${anchor}`}
            onClick={() => !disabled && onBet("corner", anchor)}
            style={{ cursor: disabled ? "default" : "pointer" }}>
            <rect
              x={cx2 - HIT} y={cy2 - HIT} width={HIT * 2} height={HIT * 2}
              rx={HIT}
              fill={isHit ? "#fde047" : total > 0 ? "#ca8a04" : "#3f3f46"}
              stroke={total > 0 ? "#fde047" : "#52525b"}
              strokeWidth={total > 0 ? 1.5 : 1}
              opacity={0.9}
              onPointerDown={() => setActiveHit(hitKey)}
              onPointerUp={() => setActiveHit(null)}
              onPointerLeave={() => setActiveHit(null)} />
            <text x={cx2} y={cy2}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={6} fontWeight="bold"
              fill={isHit || total > 0 ? "#000" : "#a1a1aa"}
              style={{ pointerEvents: "none", userSelect: "none" }}>4</text>
          </g>
        );
      })}

      {/* ── Docenas ── */}
      {DOZEN_ZONES.map(({ type, label, col, span }) => {
        const x = zoneX(col), w = zoneW(span);
        const hitKey = `d-${type}`;
        const isHit = activeHit === hitKey;
        const has = pendingBets.some((b) => b.type === type);
        return (
          <g key={type} onClick={() => !disabled && onBet(type, null)}
            style={{ cursor: disabled ? "default" : "pointer" }}>
            <rect x={x} y={dozenY} width={w} height={dozenH} rx={3}
              fill={isHit ? "#3f3f46" : "#27272a"} stroke={has ? "#fde047" : "#3f3f46"} strokeWidth={has ? 1.5 : 0.5}
              onPointerDown={() => setActiveHit(hitKey)} onPointerUp={() => setActiveHit(null)} onPointerLeave={() => setActiveHit(null)} />
            <text x={x + w / 2} y={dozenY + dozenH / 2}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={7} fontWeight="bold" fill={has ? "#fde047" : "#d4d4d8"}
              style={{ pointerEvents: "none", userSelect: "none" }}>{label}</text>
          </g>
        );
      })}

      {/* ── Simples ── */}
      {SIMPLE_ZONES.map(({ type, label, col, span, fill }) => {
        const x = zoneX(col), w = zoneW(span);
        const hitKey = `s-${type}`;
        const isHit = activeHit === hitKey;
        const has = pendingBets.some((b) => b.type === type);
        const baseFill = fill ?? "#27272a";
        return (
          <g key={type} onClick={() => !disabled && onBet(type, null)}
            style={{ cursor: disabled ? "default" : "pointer" }}>
            <rect x={x} y={simpleY} width={w} height={simpleH} rx={3}
              fill={isHit ? (fill ? (type === "red" ? "#ef4444" : "#333") : "#3f3f46") : baseFill}
              stroke={has ? "#fde047" : "#3f3f46"} strokeWidth={has ? 1.5 : 0.5}
              onPointerDown={() => setActiveHit(hitKey)} onPointerUp={() => setActiveHit(null)} onPointerLeave={() => setActiveHit(null)} />
            <text x={x + w / 2} y={simpleY + simpleH / 2}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={7} fontWeight="bold" fill={has ? "#fde047" : "#d4d4d8"}
              style={{ pointerEvents: "none", userSelect: "none" }}>{label}</text>
          </g>
        );
      })}

      {/* ── Zero section label ── */}
      <text x={PAD + ZW / 2} y={dozenY + dozenH / 2}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={6} fill="#52525b" fontWeight="bold"
        style={{ userSelect: "none" }}>0</text>
    </svg>
  );
}

// ── Rueda oval SVG ─────────────────────────────────────────────────────────────
const WHEEL_ORDER = [...EUROPEAN_WHEEL_ORDER];

function OvalWheel({ pendingBets, onNumberClick, disabled }: {
  pendingBets: Bet[];
  onNumberClick: (n: number) => void;
  disabled: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  const total = WHEEL_ORDER.length;
  const cx = 200, cy = 130;
  const rx = 192, ry = 118;
  const innerRx = 128, innerRy = 72;
  const segAngle = (2 * Math.PI) / total;

  function getSegPath(i: number): string {
    const a1 = i * segAngle - Math.PI / 2;
    const a2 = (i + 1) * segAngle - Math.PI / 2;
    const x1o = cx + rx * Math.cos(a1), y1o = cy + ry * Math.sin(a1);
    const x2o = cx + rx * Math.cos(a2), y2o = cy + ry * Math.sin(a2);
    const x1i = cx + innerRx * Math.cos(a2), y1i = cy + innerRy * Math.sin(a2);
    const x2i = cx + innerRx * Math.cos(a1), y2i = cy + innerRy * Math.sin(a1);
    return `M ${x1o} ${y1o} A ${rx} ${ry} 0 0 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${innerRx} ${innerRy} 0 0 0 ${x2i} ${y2i} Z`;
  }

  function getLabelPos(i: number) {
    const a = (i + 0.5) * segAngle - Math.PI / 2;
    return {
      x: cx + ((rx + innerRx) / 2) * Math.cos(a),
      y: cy + ((ry + innerRy) / 2) * Math.sin(a),
    };
  }

  return (
    <svg viewBox="0 0 400 260" className="w-full h-full"
      style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}>
      {WHEEL_ORDER.map((num, i) => {
        const color = numColor(num);
        const fill = color === "red" ? "#b91c1c" : color === "green" ? "#15803d" : "#1c1c1c";
        const isActive = active === num;
        const hasBet = pendingBets.some((b) => b.type === "number" && b.value === num);
        const label = getLabelPos(i);

        return (
          <g key={num}
            onClick={() => !disabled && onNumberClick(num)}
            onPointerDown={() => setActive(num)}
            onPointerUp={() => setActive(null)}
            onPointerLeave={() => setActive(null)}
            style={{ cursor: disabled ? "default" : "pointer" }}>
            <path d={getSegPath(i)}
              fill={isActive ? (color === "red" ? "#ef4444" : color === "green" ? "#22c55e" : "#525252") : fill}
              stroke={hasBet ? "#fde047" : "#27272a"}
              strokeWidth={hasBet ? 2 : 0.5}
              opacity={disabled ? 0.5 : 1} />
            <text x={label.x} y={label.y}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={num >= 10 ? 7.5 : 8.5} fontWeight="bold" fill="#fff"
              style={{ pointerEvents: "none", userSelect: "none" }}>{num}</text>
            {hasBet && (
              <circle cx={label.x + 7} cy={label.y - 7} r={5} fill="#fde047" />
            )}
          </g>
        );
      })}
      <ellipse cx={cx} cy={cy} rx={innerRx - 3} ry={innerRy - 3} fill="#080808" stroke="#27272a" strokeWidth={1} />
      <text x={cx} y={cy - 7} textAnchor="middle" fontSize={13} fill="#3f3f46" fontWeight="bold" style={{ userSelect: "none" }}>TRIPLE</text>
      <text x={cx} y={cy + 9} textAnchor="middle" fontSize={13} fill="#3f3f46" fontWeight="bold" style={{ userSelect: "none" }}>NELSON</text>
    </svg>
  );
}

// ── Simples para modo rueda ────────────────────────────────────────────────────
function WheelSimples({ pendingBets, onBet, disabled }: {
  pendingBets: Bet[];
  onBet: (type: BetType, value: null) => void;
  disabled: boolean;
}) {
  function btn(type: BetType, label: string, extra = "") {
    const has = pendingBets.some((b) => b.type === type);
    return (
      <button key={type} type="button" onClick={() => !disabled && onBet(type, null)} disabled={disabled}
        className={`relative flex items-center justify-center rounded-lg py-3 text-[10px] font-bold uppercase tracking-[0.06em] active:scale-95 transition-all
          ${extra} ${has ? "ring-2 ring-yellow-400 text-yellow-300" : "text-white"} ${disabled ? "opacity-40" : ""}`}>
        {label}
        {has && <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-yellow-400" />}
      </button>
    );
  }
  return (
    <div className="grid grid-cols-6 gap-1">
      {btn("dozen1", "1-12",  "bg-zinc-800")}
      {btn("dozen2", "13-24", "bg-zinc-800")}
      {btn("dozen3", "25-36", "bg-zinc-800")}
      {btn("low",    "1-18",  "bg-zinc-900 border border-zinc-700")}
      {btn("high",   "19-36", "bg-zinc-900 border border-zinc-700")}
      {btn("even",   "PAR",   "bg-zinc-900 border border-zinc-700")}
      {btn("odd",    "IMPAR", "bg-zinc-900 border border-zinc-700")}
      {btn("red",    "●",     "bg-[#b91c1c]")}
      {btn("black",  "●",     "bg-[#111] border border-zinc-700")}
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  credits: number;
  pendingBets: Bet[];
  onAdd: (bet: Bet) => void;
  onClear: () => void;
  onConfirm: () => void;
  disabled?: boolean;
  confirming?: boolean;
}

export function CasinoBettingUI({ credits, pendingBets, onAdd, onClear, onConfirm, disabled = false, confirming = false }: Props) {
  const totalBet = pendingBets.reduce((s, b) => s + b.amount, 0);
  const remaining = credits - totalBet;
  const [selectedChip, setSelectedChip] = useState<ChipValue>(25);
  const [betMode, setBetMode] = useState<BetMode>("number");
  const [viewMode, setViewMode] = useState<"table" | "wheel">("table");

  function canAfford(chip: ChipValue) { return chip <= remaining; }

  function addBet(type: BetType, value: number | null = null) {
    if (disabled) return;
    const amount = selectedChip;
    if (amount > remaining) return;
    if (amount < BET_LIMITS[type].min) return;
    onAdd({ type, value, amount });
  }

  function handleNumberClick(n: number) {
    if (selectedChip < BET_LIMITS.number.min) return;
    addBet("number", n);
  }

  return (
    <div className="flex flex-col h-full gap-1.5">

      {/* ── Fila 1: vista toggle ── */}
      <div className="shrink-0 flex gap-1 rounded-lg border border-zinc-800 p-0.5 bg-zinc-900/60">
        <button type="button" onClick={() => setViewMode("table")}
          className={`flex-1 rounded-md py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] transition-colors
            ${viewMode === "table" ? "bg-white text-black" : "text-zinc-500"}`}>
          Mesa
        </button>
        <button type="button" onClick={() => setViewMode("wheel")}
          className={`flex-1 rounded-md py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] transition-colors
            ${viewMode === "wheel" ? "bg-white text-black" : "text-zinc-500"}`}>
          Rueda
        </button>
      </div>

      {/* ── Fila 2: chips (siempre visibles) ── */}
      <div className="shrink-0 flex items-center gap-1.5 overflow-x-auto py-0.5">
        {CHIP_VALUES.map((v) => (
          <Chip key={v} value={v} selected={selectedChip === v} disabled={!canAfford(v) || disabled} onClick={() => setSelectedChip(v)} />
        ))}
        {/* Bet mode toggle — solo en modo mesa */}
        {viewMode === "table" && (
          <div className="ml-auto shrink-0 flex rounded-lg border border-zinc-700 overflow-hidden">
            <button type="button" onClick={() => setBetMode("number")}
              className={`px-2.5 py-1.5 text-[9px] font-bold uppercase transition-colors
                ${betMode === "number" ? "bg-white text-black" : "text-zinc-500"}`}>
              1
            </button>
            <button type="button" onClick={() => setBetMode("corner")}
              className={`px-2.5 py-1.5 text-[9px] font-bold uppercase transition-colors
                ${betMode === "corner" ? "bg-yellow-400 text-black" : "text-zinc-500"}`}>
              4
            </button>
          </div>
        )}
      </div>

      {/* ── Hint de modo ── */}
      {viewMode === "table" && betMode === "corner" && (
        <p className="shrink-0 text-center text-[10px] text-yellow-300 uppercase tracking-[0.12em]">
          Toca ◉ entre 4 números · pago x9
        </p>
      )}

      {/* ── Vista principal ── */}
      <AnimatePresence mode="wait" initial={false}>
        {viewMode === "table" ? (
          <motion.div key="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 min-h-0 overflow-hidden">
            <SVGTable
              pendingBets={pendingBets}
              onBet={addBet}
              betMode={betMode}
              disabled={disabled}
              chip={selectedChip}
            />
          </motion.div>
        ) : (
          <motion.div key="wheel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 min-h-0 flex flex-col gap-1.5 overflow-hidden">
            {/* Rueda ocupa todo el espacio disponible */}
            <div className="flex-1 min-h-0 rounded-xl border border-zinc-800 bg-zinc-900/80 overflow-hidden">
              <OvalWheel
                pendingBets={pendingBets}
                onNumberClick={handleNumberClick}
                disabled={disabled}
              />
            </div>
            {/* Simples compactos debajo */}
            <div className="shrink-0">
              <WheelSimples pendingBets={pendingBets} onBet={addBet} disabled={disabled} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Barra de acción ── */}
      <div className="shrink-0 flex items-center gap-2">
        <button type="button" onClick={onClear} disabled={!pendingBets.length || disabled}
          className="min-h-[50px] shrink-0 rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-sm font-semibold uppercase tracking-[0.1em] text-zinc-300 active:scale-95 disabled:opacity-30">
          Limpiar
        </button>
        <div className="flex-1 text-center leading-tight">
          {pendingBets.length ? (
            <>
              <p className="text-xs text-zinc-400">{pendingBets.length} apuesta{pendingBets.length > 1 ? "s" : ""}</p>
              <p className="font-mono font-bold text-white">
                <span className="text-yellow-300">{totalBet}</span>
                <span className="text-zinc-500 text-xs"> · {remaining} rest.</span>
              </p>
            </>
          ) : (
            <p className="text-xs text-zinc-500">Toca la mesa para apostar</p>
          )}
        </div>
        <button type="button" onClick={onConfirm} disabled={!pendingBets.length || disabled || confirming}
          className="min-h-[50px] shrink-0 rounded-xl bg-white px-6 text-sm font-bold uppercase tracking-[0.14em] text-black active:scale-95 disabled:opacity-30">
          {confirming ? "..." : "¡Apostar!"}
        </button>
      </div>
    </div>
  );
}

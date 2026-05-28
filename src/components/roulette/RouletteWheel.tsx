"use client";

import { useEffect, useRef, useState } from "react";
import { getNumberColor } from "@/lib/roulette/logic";

// Orden europeo de la ruleta (sentido horario desde las 12)
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

const TOTAL = WHEEL_ORDER.length; // 37
const SEGMENT_ANGLE = 360 / TOTAL;

function segmentColor(n: number): string {
  const c = getNumberColor(n);
  if (c === "red") return "#dc2626";
  if (c === "green") return "#16a34a";
  return "#1a1a1a";
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function buildArcPath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const s = polarToCartesian(cx, cy, r, startAngle);
  const e = polarToCartesian(cx, cy, r, endAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y} Z`;
}

interface Props {
  spinning: boolean;
  prizeNumber: number | null;
  onStopSpinning?: () => void;
  size?: number;
}

export function RouletteWheel({
  spinning,
  prizeNumber,
  onStopSpinning,
  size = 480,
}: Props) {
  const [rotation, setRotation] = useState(0);
  const animRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const startRotRef = useRef(0);
  const targetRotRef = useRef(0);
  const durationRef = useRef(5500);
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!spinning || prizeNumber === null) return;

    stoppedRef.current = false;

    // Índice del número en el orden de la rueda
    const idx = WHEEL_ORDER.indexOf(prizeNumber);
    // Ángulo del centro del segmento ganador (arriba = 0°)
    const segCenter = idx * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
    // Queremos que ese segmento quede arriba (0°), compensando la rotación actual
    const currentNorm = ((rotation % 360) + 360) % 360;
    // Rotación extra para alinear el segmento ganador arriba, más vueltas completas
    const extraSpins = 360 * 6;
    const needed = ((360 - segCenter - currentNorm) % 360 + 360) % 360;
    const target = rotation + extraSpins + needed;

    startTimeRef.current = null;
    startRotRef.current = rotation;
    targetRotRef.current = target;
    durationRef.current = 5500;

    function easeOut(t: number): number {
      return 1 - Math.pow(1 - t, 4);
    }

    function tick(now: number) {
      if (startTimeRef.current === null) startTimeRef.current = now;
      const elapsed = now - startTimeRef.current;
      const t = Math.min(elapsed / durationRef.current, 1);
      const eased = easeOut(t);
      const current =
        startRotRef.current +
        (targetRotRef.current - startRotRef.current) * eased;
      setRotation(current);

      if (t < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        setRotation(targetRotRef.current);
        if (!stoppedRef.current) {
          stoppedRef.current = true;
          onStopSpinning?.();
        }
      }
    }

    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [spinning, prizeNumber]);

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 4;
  const innerR = outerR * 0.18;
  const textR = outerR * 0.78;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Puntero fijo arriba */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2"
        style={{ width: 0, height: 0 }}
      >
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: "12px solid transparent",
            borderRight: "12px solid transparent",
            borderTop: "28px solid #fbbf24",
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.8))",
          }}
        />
      </div>

      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: `rotate(${rotation}deg)`, transition: "none" }}
      >
        {/* Borde exterior */}
        <circle cx={cx} cy={cy} r={outerR + 3} fill="#27272a" />

        {WHEEL_ORDER.map((n, i) => {
          const startAngle = i * SEGMENT_ANGLE;
          const endAngle = startAngle + SEGMENT_ANGLE;
          const textAngle = startAngle + SEGMENT_ANGLE / 2;
          const tp = polarToCartesian(cx, cy, textR, textAngle);
          const textRotation = textAngle - 90;

          return (
            <g key={n}>
              <path
                d={buildArcPath(cx, cy, outerR, startAngle, endAngle)}
                fill={segmentColor(n)}
                stroke="#0a0a0a"
                strokeWidth={1}
              />
              <text
                x={tp.x}
                y={tp.y}
                textAnchor="middle"
                dominantBaseline="central"
                fill="white"
                fontSize={size < 300 ? 9 : 13}
                fontWeight="bold"
                fontFamily="monospace"
                transform={`rotate(${textRotation}, ${tp.x}, ${tp.y})`}
              >
                {n}
              </text>
            </g>
          );
        })}

        {/* Centro */}
        <circle cx={cx} cy={cy} r={innerR} fill="#09090b" stroke="#27272a" strokeWidth={2} />
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#52525b"
          fontSize={size < 300 ? 8 : 11}
          fontWeight="bold"
          letterSpacing={1}
        >
          TN
        </text>
      </svg>
    </div>
  );
}

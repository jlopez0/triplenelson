"use client";

import { useEffect } from "react";
import { motion, useAnimation } from "framer-motion";

const UFO_WIDTH = 90;

function UfoSvg() {
  return (
    <svg
      width={UFO_WIDTH}
      height={54}
      viewBox="0 0 90 54"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <ellipse cx="45" cy="34" rx="40" ry="13" fill="#3a3a3a" />
      <ellipse cx="45" cy="34" rx="40" ry="13" fill="url(#bodyGrad)" />
      <ellipse cx="45" cy="34" rx="40" ry="13" stroke="#5a5a5a" strokeWidth="1.2" fill="none" />
      <ellipse cx="45" cy="28" rx="20" ry="5" fill="#2a2a2a" />
      <path d="M25 28 Q45 6 65 28" fill="#1e1e1e" />
      <path d="M25 28 Q45 6 65 28" stroke="#4a4a4a" strokeWidth="1" fill="none" />
      <path d="M31 22 Q38 14 48 20" stroke="#6b6b6b" strokeWidth="1" fill="none" opacity="0.6" />
      <circle cx="25" cy="38" r="3" fill="#00ffcc" opacity="0.9">
        <animate attributeName="opacity" values="0.9;0.3;0.9" dur="1.8s" repeatCount="indefinite" />
      </circle>
      <circle cx="38" cy="43" r="3" fill="#00e5a0" opacity="0.7">
        <animate attributeName="opacity" values="0.7;1;0.7" dur="2.2s" repeatCount="indefinite" />
      </circle>
      <circle cx="52" cy="43" r="3" fill="#00ffcc" opacity="0.8">
        <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.5s" repeatCount="indefinite" />
      </circle>
      <circle cx="65" cy="38" r="3" fill="#00e5a0" opacity="0.9">
        <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2s" repeatCount="indefinite" />
      </circle>
      <ellipse cx="45" cy="47" rx="28" ry="5" fill="#00ffcc" opacity="0.04" />
      <defs>
        <linearGradient id="bodyGrad" x1="5" y1="26" x2="85" y2="47" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#555555" />
          <stop offset="50%" stopColor="#2e2e2e" />
          <stop offset="100%" stopColor="#444444" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export function UfoAnimation() {
  const controls = useAnimation();

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    // Empieza invisible y fuera de pantalla
    controls.set({ opacity: 0, x: -UFO_WIDTH, y: 0 });

    async function runCycle(firstRun: boolean) {
      if (cancelled) return;

      // Primer paso rápido (1s), luego 3-8s
      const delay = firstRun ? 1000 : randomBetween(3000, 8000);

      await new Promise<void>((resolve) => {
        timeoutId = setTimeout(resolve, delay);
      });

      if (cancelled) return;

      const goLeft = Math.random() > 0.5;
      const scaleX = goLeft ? -1 : 1;
      const topPct = randomBetween(10, 60);
      const startX = goLeft ? window.innerWidth + UFO_WIDTH : -UFO_WIDTH - 20;
      const endX = goLeft ? -UFO_WIDTH - 20 : window.innerWidth + UFO_WIDTH + 20;
      const baseY = (topPct / 100) * window.innerHeight;
      const midOffset = randomBetween(-35, 35);
      const duration = randomBetween(4, 7);

      // Posicionar sin transición, luego animar cruzando
      controls.set({ x: startX, y: baseY, scaleX, opacity: 1 });

      await controls.start({
        x: endX,
        y: [baseY, baseY + midOffset, baseY - midOffset * 0.6, baseY],
        transition: {
          duration,
          ease: "linear",
          y: { duration, ease: "easeInOut", times: [0, 0.35, 0.7, 1] },
        },
      });

      if (!cancelled) {
        runCycle(false);
      }
    }

    runCycle(true);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      controls.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={controls}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      <motion.div
        animate={{ y: [0, -6, 0, 6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <UfoSvg />
      </motion.div>
    </motion.div>
  );
}

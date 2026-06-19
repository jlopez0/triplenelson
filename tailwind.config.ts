import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      colors: {
        black: "#0a0a0a",
        white: "#e8e8e8",
        gray: {
          DEFAULT: "#666666",
          light: "#999999",
        },
        acid: "#00ff41",
      },
      fontSize: {
        'hero': ['clamp(4rem, 12vw, 10rem)', { lineHeight: '0.85', letterSpacing: '-0.04em' }],
        'display': ['clamp(3rem, 8vw, 5rem)', { lineHeight: '0.9', letterSpacing: '-0.02em' }],
        'title': ['clamp(1.5rem, 4vw, 2rem)', { lineHeight: '1.1' }],
        'body': ['1.25rem', { lineHeight: '1.7' }],
        'small': ['0.875rem', { lineHeight: '1.5', letterSpacing: '0.05em' }],
      },
      spacing: {
        '18': '4.5rem',  // 72px
        '22': '5.5rem',  // 88px
        '30': '7.5rem',  // 120px
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-out forwards",
        "slide-up": "slideUp 0.8s ease-out forwards",
        "glitch1": "glitch1 2s infinite linear",
        "glitch2": "glitch2 2.3s infinite linear",
        "neon-pulse": "neonPulse 1.8s ease-in-out infinite",
        "neon-flicker": "neonFlicker 3s infinite",
        "scanline": "scanline 3s linear infinite",
        "marquee": "marquee 30s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        glitch1: {
          "0%, 88%, 100%": { transform: "translate(0,0) skewX(0deg)", opacity: "0" },
          "89%": { transform: "translate(-4px, 2px) skewX(-3deg)", opacity: "0.85" },
          "90%": { transform: "translate(4px, -2px) skewX(3deg)", opacity: "0.85" },
          "91%": { transform: "translate(-3px, 1px) skewX(-1deg)", opacity: "0.6" },
          "92%": { transform: "translate(0,0) skewX(0deg)", opacity: "0" },
          "93%": { transform: "translate(5px, -1px) skewX(2deg)", opacity: "0.7" },
          "94%": { transform: "translate(0,0)", opacity: "0" },
        },
        glitch2: {
          "0%, 83%, 100%": { transform: "translate(0,0) skewX(0deg)", opacity: "0" },
          "84%": { transform: "translate(5px, -3px) skewX(4deg)", opacity: "0.8" },
          "85%": { transform: "translate(-4px, 2px) skewX(-3deg)", opacity: "0.8" },
          "86%": { transform: "translate(3px, -1px) skewX(1deg)", opacity: "0.5" },
          "87%": { transform: "translate(0,0)", opacity: "0" },
          "88%": { transform: "translate(-5px, 2px)", opacity: "0.6" },
          "89%": { transform: "translate(0,0)", opacity: "0" },
        },
        neonPulse: {
          "0%, 100%": { textShadow: "0 0 7px #fff, 0 0 20px #fff, 0 0 40px #0ff, 0 0 80px #0ff, 0 0 120px #0ff", opacity: "1" },
          "50%": { textShadow: "0 0 3px #fff, 0 0 10px #fff, 0 0 20px #0ff, 0 0 40px #0ff", opacity: "0.85" },
        },
        neonFlicker: {
          "0%, 19%, 21%, 23%, 25%, 54%, 56%, 100%": { textShadow: "0 0 7px #fff, 0 0 20px #fff, 0 0 40px #f0f, 0 0 80px #f0f, 0 0 120px #f0f" },
          "20%, 24%, 55%": { textShadow: "none", opacity: "0.7" },
        },
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
      }
    },
  },
  plugins: [],
};
export default config;

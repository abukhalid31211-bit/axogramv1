/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Tajawal", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "monospace"],
      },
      colors: {
        ink: {
          950: "#070b14",
          900: "#0b1220",
          850: "#0f1729",
          800: "#131c33",
          700: "#1c2742",
          600: "#273456",
          500: "#3a4a73",
        },
        brand: {
          50: "#eafaf3",
          100: "#cdf2dd",
          200: "#9ee5bd",
          300: "#62d498",
          400: "#34bf78",
          500: "#1aa863",
          600: "#128a51",
          700: "#0f6c41",
          800: "#0d5534",
          900: "#0a3f27",
        },
        accent: {
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
        },
        warn: {
          400: "#fbbf24",
          500: "#f59e0b",
        },
        danger: {
          400: "#f87171",
          500: "#ef4444",
        },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(26,168,99,0.25), 0 8px 30px -8px rgba(26,168,99,0.35)",
        card: "0 10px 30px -12px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
};

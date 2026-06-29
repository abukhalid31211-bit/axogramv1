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
        surface: {
          50:  "#faf9f7",
          100: "#f5f4f0",
          200: "#eeece7",
          300: "#e2dfd8",
          400: "#ccc9c0",
          500: "#9c9890",
          600: "#6b6860",
          700: "#3d3b35",
          800: "#1f1e1a",
        },
        brand: {
          50:  "#f0fdf6",
          100: "#dcfce8",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
        },
        accent: {
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
        },
        warn: {
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
        },
        danger: {
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626",
        },
      },
      boxShadow: {
        card:  "0 1px 4px 0 rgba(0,0,0,0.07), 0 4px 16px -4px rgba(0,0,0,0.08)",
        soft:  "0 1px 3px 0 rgba(0,0,0,0.06)",
        ring:  "0 0 0 3px rgba(34,197,94,0.18)",
        pop:   "0 8px 32px -8px rgba(0,0,0,0.16)",
      },
    },
  },
  plugins: [],
};

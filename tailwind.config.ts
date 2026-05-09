import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        studio: {
          950: "#0c0f14",
          900: "#111722",
          850: "#151d2a",
          800: "#1b2431",
          700: "#263244",
          500: "#3b4b62",
          300: "#9ba8ba"
        },
        meter: {
          green: "#4ade80",
          amber: "#f59e0b",
          cyan: "#38bdf8",
          rose: "#fb7185"
        }
      },
      boxShadow: {
        panel: "inset 0 1px 0 rgba(255,255,255,0.04), 0 12px 34px rgba(0,0,0,0.28)"
      }
    },
  },
  plugins: [],
} satisfies Config;

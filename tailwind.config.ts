import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        graphite: {
          975: "#0a0c10",
          950: "#0f1217",
          900: "#15191f",
          850: "#1b2027",
          800: "#222831",
          750: "#2a313c",
          700: "#343c49",
          600: "#475061"
        },
        lcd: {
          bg: "#0b1f1a",
          text: "#7CFFB2",
          dim: "#2f6b51"
        },
        region: {
          midi: "#5ec26b",
          audio: "#46a7e0",
          drummer: "#e0b341",
          loop: "#7d8cff"
        },
        accent: {
          play: "#4ade80",
          record: "#ff4d4d",
          cycle: "#f6c453",
          sel: "#7ad7ff"
        },
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

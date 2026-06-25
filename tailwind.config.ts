import type { Config } from "tailwindcss";

const themeColor = (name: string) => `rgb(var(--color-${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        graphite: {
          975: themeColor("graphite-975"),
          950: themeColor("graphite-950"),
          900: themeColor("graphite-900"),
          850: themeColor("graphite-850"),
          800: themeColor("graphite-800"),
          750: themeColor("graphite-750"),
          700: themeColor("graphite-700"),
          600: themeColor("graphite-600")
        },
        lcd: {
          bg: themeColor("lcd-bg"),
          text: themeColor("lcd-text"),
          dim: themeColor("lcd-dim")
        },
        region: {
          midi: themeColor("region-midi"),
          audio: themeColor("region-audio"),
          drummer: themeColor("region-drummer"),
          loop: themeColor("region-loop")
        },
        accent: {
          play: themeColor("accent-play"),
          record: themeColor("accent-record"),
          cycle: themeColor("accent-cycle"),
          sel: themeColor("accent-sel")
        },
        studio: {
          950: themeColor("studio-950"),
          900: themeColor("studio-900"),
          850: themeColor("studio-850"),
          800: themeColor("studio-800"),
          700: themeColor("studio-700"),
          500: themeColor("studio-500"),
          300: themeColor("studio-300")
        },
        meter: {
          green: themeColor("meter-green"),
          amber: themeColor("meter-amber"),
          cyan: themeColor("meter-cyan"),
          rose: themeColor("meter-rose")
        }
      },
      boxShadow: {
        panel: "var(--shadow-panel)"
      }
    },
  },
  plugins: [],
} satisfies Config;

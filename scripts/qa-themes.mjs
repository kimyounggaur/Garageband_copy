import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const server = await createServer({
  appType: "custom",
  logLevel: "error",
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { hmr: false, middlewareMode: true }
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

try {
  const { THEME_OPTIONS, normalizeTheme, readStoredTheme, writeStoredTheme } = await server.ssrLoadModule("/src/utils/theme.ts");
  assertEqual(
    THEME_OPTIONS.map((theme) => theme.value).join(","),
    "dark,light,pretty,cute",
    "theme selector exposes all four modes in order"
  );
  assertEqual(normalizeTheme("pretty"), "pretty", "pretty is accepted");
  assertEqual(normalizeTheme("clay"), "dark", "unknown themes fall back to dark");

  const memoryStorage = new Map();
  const storage = {
    getItem: (key) => memoryStorage.get(key) ?? null,
    setItem: (key, value) => memoryStorage.set(key, value)
  };
  writeStoredTheme("cute", storage);
  assertEqual(readStoredTheme(storage), "cute", "theme preference persists to storage");

  const appShell = readFileSync(join(root, "src", "components", "layout", "AppShell.tsx"), "utf8");
  const transportBar = readFileSync(join(root, "src", "components", "transport", "TransportBar.tsx"), "utf8");
  const css = readFileSync(join(root, "src", "index.css"), "utf8");
  const tailwind = readFileSync(join(root, "tailwind.config.ts"), "utf8");
  const { contrastRatio } = await server.ssrLoadModule("/src/utils/colorContrast.ts");

  assert(appShell.includes("data-theme={appTheme}"), "app root carries selected data-theme");
  assert(appShell.includes("readStoredTheme") && appShell.includes("writeStoredTheme"), "app shell persists theme selection");
  assert(transportBar.includes("ariaLabel=\"화면 테마\""), "header exposes UI theme segmented toggle");
  assert(transportBar.includes("어두운") && transportBar.includes("밝은") && transportBar.includes("화사한") && transportBar.includes("귀여운"), "Korean theme labels are present");
  assert(tailwind.includes("--color-${name}") && tailwind.includes("<alpha-value>"), "tailwind colors use CSS variables with alpha support");
  assert(css.includes('[data-theme="light"]'), "light theme CSS variables exist");
  assert(css.includes('[data-theme="pretty"]') && css.includes("#fa520f"), "pretty theme uses Mistral orange");
  assert(css.includes('[data-theme="cute"]') && css.includes("#faf9f7"), "cute theme uses Clay cream");
  assert(tailwind.includes('themeColor("ink-high")') && tailwind.includes('themeColor("state-selected")'), "semantic text and selection tokens are configured");

  function themeVariables(theme) {
    const rootBlock = css.match(/:root\s*\{([^}]*)\}/)?.[1] ?? "";
    const themeBlock = theme === "dark" ? "" : css.match(new RegExp(`\\[data-theme="${theme}"\\]\\s*\\{([^}]*)\\}`))?.[1] ?? "";
    function value(name) {
      const expression = new RegExp(`--color-${name}:\\s*([^;]+);`);
      const raw = themeBlock.match(expression)?.[1] ?? rootBlock.match(expression)?.[1];
      assert(raw, `${theme} is missing --color-${name}`);
      const alias = raw.match(/^var\(--color-([a-z0-9-]+)\)$/);
      if (alias) return value(alias[1]);
      const channels = raw.trim().split(/\s+/).map(Number);
      assert(channels.length === 3 && channels.every(Number.isFinite), `${theme} has an invalid --color-${name}`);
      return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
    }
    return value;
  }

  for (const theme of ["dark", "light", "pretty", "cute"]) {
    const color = themeVariables(theme);
    assert(contrastRatio(color("ink-body"), color("surface-panel")) >= 4.5, `${theme} body text contrast`);
    assert(contrastRatio(color("ink-muted"), color("surface-panel")) >= 4.5, `${theme} secondary text contrast`);
    assert(contrastRatio(color("ink-accent"), color("surface-panel")) >= 4.5, `${theme} accent text contrast`);
    assert(contrastRatio(color("ink-accent"), color("surface-raised")) >= 3, `${theme} focus indicator contrast`);
    assert(contrastRatio(color("ink-selected"), color("state-selected")) >= 4.5, `${theme} selected text contrast`);
    assert(contrastRatio(color("ink-on-record"), color("accent-record")) >= 4.5, `${theme} record button contrast`);
    for (const bright of ["meter-cyan", "meter-green", "meter-amber"]) {
      assert(contrastRatio(color("ink-on-bright"), color(bright)) >= 4.5, `${theme} text on ${bright} contrast`);
    }
  }

  console.log("Theme selector checks passed");
} finally {
  await server.close();
}

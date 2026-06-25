import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const server = await createServer({
  appType: "custom",
  logLevel: "error",
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

  assert(appShell.includes("data-theme={appTheme}"), "app root carries selected data-theme");
  assert(appShell.includes("readStoredTheme") && appShell.includes("writeStoredTheme"), "app shell persists theme selection");
  assert(transportBar.includes("ariaLabel=\"UI theme\""), "header exposes UI theme segmented toggle");
  assert(transportBar.includes("Dark") && transportBar.includes("Light") && transportBar.includes("Pretty") && transportBar.includes("Cute"), "theme labels are present");
  assert(tailwind.includes("--color-${name}") && tailwind.includes("<alpha-value>"), "tailwind colors use CSS variables with alpha support");
  assert(css.includes('[data-theme="light"]'), "light theme CSS variables exist");
  assert(css.includes('[data-theme="pretty"]') && css.includes("#fa520f"), "pretty theme uses Mistral orange");
  assert(css.includes('[data-theme="cute"]') && css.includes("#faf9f7"), "cute theme uses Clay cream");

  console.log("Theme selector checks passed");
} finally {
  await server.close();
}

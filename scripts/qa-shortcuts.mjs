import { createServer } from "vite";

const server = await createServer({
  appType: "custom",
  logLevel: "error",
  server: { hmr: false, middlewareMode: true }
});

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

try {
  const { resolveShortcutKey, shouldDismissShortcutOverlay, SHORTCUTS } = await server.ssrLoadModule("/src/utils/shortcutOverlay.ts");

  assertEqual(SHORTCUTS.length, 6, "shortcut guide exposes six manual shortcuts");
  assertEqual(resolveShortcutKey({ code: "Space", key: " ", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false })?.id, "play-pause", "space highlights play shortcut");
  assertEqual(resolveShortcutKey({ code: "KeyR", key: "r", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false })?.id, "record", "r highlights record shortcut");
  assertEqual(resolveShortcutKey({ code: "Enter", key: "Enter", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false })?.id, "go-start", "enter highlights go-start shortcut");
  assertEqual(resolveShortcutKey({ code: "KeyZ", key: "z", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false })?.id, "undo", "ctrl z highlights undo");
  assertEqual(resolveShortcutKey({ code: "KeyZ", key: "z", ctrlKey: true, metaKey: false, shiftKey: true, altKey: false })?.id, "redo-shift", "ctrl shift z highlights redo");
  assertEqual(resolveShortcutKey({ code: "KeyY", key: "y", ctrlKey: false, metaKey: true, shiftKey: false, altKey: false })?.id, "redo", "cmd y highlights redo");
  assertEqual(shouldDismissShortcutOverlay({ code: "KeyA", key: "a", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }), true, "other keys close overlay");
  assertEqual(shouldDismissShortcutOverlay({ code: "Space", key: " ", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }), false, "known shortcuts do not close overlay");

  console.log("Shortcut overlay checks passed");
} finally {
  await server.close();
}

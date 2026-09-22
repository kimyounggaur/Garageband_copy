import { createServer } from "vite";

const server = await createServer({
  appType: "custom",
  logLevel: "error",
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { hmr: false, middlewareMode: true }
});

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

try {
  const { resolveShortcutKey, shouldDismissShortcutOverlay, SHORTCUTS } = await server.ssrLoadModule("/src/utils/shortcutOverlay.ts");

  assertEqual(SHORTCUTS.length, 18, "shortcut guide exposes the workspace and timeline registry");
  assertEqual(SHORTCUTS.every((shortcut) => typeof shortcut.handler === "function" && shortcut.scope), true, "all listed shortcuts have a handler and scope");
  assertEqual(resolveShortcutKey({ code: "Space", key: " ", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false })?.id, "play-pause", "space highlights play shortcut");
  assertEqual(resolveShortcutKey({ code: "KeyR", key: "r", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false })?.id, "record", "r highlights record shortcut");
  assertEqual(resolveShortcutKey({ code: "Enter", key: "Enter", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false })?.id, "stop-enter", "enter highlights stop shortcut");
  assertEqual(resolveShortcutKey({ code: "Space", key: " ", ctrlKey: false, metaKey: false, shiftKey: true, altKey: false })?.id, "stop", "shift space highlights stop shortcut");
  assertEqual(resolveShortcutKey({ code: "KeyZ", key: "z", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false })?.id, "undo", "ctrl z highlights undo");
  assertEqual(resolveShortcutKey({ code: "KeyZ", key: "z", ctrlKey: true, metaKey: false, shiftKey: true, altKey: false })?.id, "redo-shift", "ctrl shift z highlights redo");
  assertEqual(resolveShortcutKey({ code: "KeyY", key: "y", ctrlKey: false, metaKey: true, shiftKey: false, altKey: false })?.id, "redo", "cmd y highlights redo");
  assertEqual(resolveShortcutKey({ code: "KeyS", key: "s", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false })?.id, "save", "ctrl s saves project");
  assertEqual(resolveShortcutKey({ code: "KeyD", key: "d", ctrlKey: false, metaKey: false, shiftKey: true, altKey: true })?.id, "duplicate-clip", "alt shift d duplicates selected clip");
  assertEqual(resolveShortcutKey({ code: "Delete", key: "Delete", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false })?.id, "delete-clip", "delete removes selected timeline clip");
  assertEqual(resolveShortcutKey({ code: "Slash", key: "?", ctrlKey: false, metaKey: false, shiftKey: true, altKey: false })?.id, "help", "question mark opens help");
  assertEqual(shouldDismissShortcutOverlay({ code: "KeyA", key: "a", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }), true, "unregistered key is not a shortcut");
  assertEqual(shouldDismissShortcutOverlay({ code: "Space", key: " ", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }), false, "known shortcut is recognized");

  console.log("Shortcut overlay checks passed");
} finally {
  await server.close();
}

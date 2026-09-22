import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { runInNewContext } from "node:vm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { generatePwaWorker } from "../scripts/generate-pwa.mjs";

const root = resolve(import.meta.dirname, "..");
const fixture = mkdtempSync(join(tmpdir(), "webband-pwa-test-"));

function put(relativePath: string, content: string) {
  const path = join(fixture, relativePath);
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, content);
}

function copy(relativePath: string) {
  const path = join(fixture, relativePath);
  mkdirSync(resolve(path, ".."), { recursive: true });
  copyFileSync(join(root, "public", relativePath), path);
}

for (const path of ["manifest.webmanifest", "icons/mark.svg", "icons/icon-192.png", "icons/icon-512.png",
  "icons/icon-maskable-512.png", "samples/manifest.json", "samples/test-tones/c4.wav", "samples/test-tones/g4.wav"]) copy(path);
put("index.html", '<script src="./assets/index-AbC123xy.js"></script><link href="./assets/index-AbC123xy.css" rel="stylesheet">');
put("assets/index-AbC123xy.js", "console.log('release one')");
put("assets/index-AbC123xy.css", "body{background:#111827}");

afterAll(() => {
  const tempRoot = resolve(tmpdir()) + sep;
  if (!resolve(fixture).startsWith(tempRoot)) throw new Error("Unsafe PWA fixture cleanup");
  rmSync(fixture, { recursive: true, force: true });
});

describe("versioned PWA app shell", () => {
  it("changes the worker revision when HTML changes and lists only approved samples", () => {
    const first = generatePwaWorker(fixture);
    expect(first.shellFiles).toContain("assets/index-AbC123xy.js");
    expect(first.shellFiles).toContain("samples/manifest.json");
    expect(first.shellFiles).not.toContain("samples/test-tones/c4.wav");
    expect(first.approvedSampleFiles).toEqual(["samples/test-tones/c4.wav", "samples/test-tones/g4.wav"]);
    expect(readFileSync(join(fixture, "sw.js"), "utf8")).toContain("webband-shell-${SHELL_REVISION}");

    put("index.html", '<meta name="description" content="release two"><script src="./assets/index-AbC123xy.js"></script>');
    const second = generatePwaWorker(fixture);
    expect(second.revision).not.toBe(first.revision);
    expect(readFileSync(join(fixture, "sw.js"), "utf8")).toContain(second.revision);

    put("samples/manifest.json", `${readFileSync(join(fixture, "samples/manifest.json"), "utf8")}\n`);
    const third = generatePwaWorker(fixture);
    expect(third.revision).not.toBe(second.revision);
  });

  it("preloads a release before activation and changes control only after an explicit message", async () => {
    const worker = readFileSync(join(fixture, "sw.js"), "utf8");
    const listeners = new Map<string, (event: any) => void>();
    const cacheData = new Map<string, Map<string, Response>>();
    const skipWaiting = vi.fn(async () => {});
    const fetchMock = vi.fn(async (input: string | Request) => new Response(`asset ${String(input)}`, { status: 200 }));
    const cachesMock = {
      keys: async () => [...cacheData.keys()],
      delete: async (name: string) => cacheData.delete(name),
      open: async (name: string) => {
        if (!cacheData.has(name)) cacheData.set(name, new Map());
        const entries = cacheData.get(name)!;
        return {
          put: async (url: string, response: Response) => { entries.set(String(url), response); },
          match: async (url: string) => entries.get(String(url)),
          keys: async () => [...entries.keys()],
          delete: async (url: string) => entries.delete(String(url))
        };
      }
    };
    const workerSelf = {
      registration: { scope: "https://school.example/Garageband_copy/" },
      location: { origin: "https://school.example" },
      clients: { claim: vi.fn(async () => {}) },
      skipWaiting,
      addEventListener: (name: string, callback: (event: any) => void) => listeners.set(name, callback)
    };
    runInNewContext(worker, {
      self: workerSelf, caches: cachesMock, fetch: fetchMock, URL, Response, Headers, Date, console
    });

    let pending: Promise<unknown> = Promise.resolve();
    listeners.get("install")!({ waitUntil: (promise: Promise<unknown>) => { pending = promise; } });
    await pending;
    expect(cacheData.size).toBe(1);
    expect([...cacheData.values()][0].has("https://school.example/Garageband_copy/index.html")).toBe(true);
    expect([...cacheData.values()][0].has("https://school.example/Garageband_copy/samples/manifest.json")).toBe(true);
    expect(skipWaiting).not.toHaveBeenCalled();

    listeners.get("message")!({ data: { type: "SKIP_WAITING" }, waitUntil: (promise: Promise<unknown>) => { pending = promise; } });
    await pending;
    expect(skipWaiting).toHaveBeenCalledTimes(1);
  });
});

/* This file is filled with a content revision by generate-pwa.mjs after Vite builds. */
const SHELL_REVISION = "bf8ad316522cbbdd";
const SHELL_FILES = ["index.html","manifest.webmanifest","samples/manifest.json","icons/mark.svg","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","assets/AssistPanel-ozaMdvWT.js","assets/AudioEngine-BNT2ljkx.js","assets/ClipEditor-CJpgHiiG.js","assets/LessonPanel-EuTfLsV7.js","assets/ReviewPanel-ond0DFk0.js","assets/StudentPanel-agaAVZoF.js","assets/StudioPanel-BUF9NL1G.js","assets/TeacherPanel-CTdy_9Av.js","assets/assistPreview-CH0niURh.js","assets/exportProject-Bi0tiHNJ.js","assets/index-BBZVqdO2.css","assets/index-D-COmEQt.js","assets/index-PXgYfcNC.js","assets/instrumentVoice-Bq_l3C3F.js","assets/sampleLibrary-F3rEiVkk.js","assets/teacherReview-DoCdzIVU.js"];
const APPROVED_SAMPLE_FILES = ["samples/test-tones/c4.wav","samples/test-tones/g4.wav"];
const SHELL_CACHE = `webband-shell-${SHELL_REVISION}`;
const SAMPLE_CACHE = "webband-approved-samples-v1";
const SAMPLE_BUDGET_BYTES = 50 * 1024 * 1024;
const SAMPLE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const SCOPE = self.registration.scope;
const scopedUrl = (path) => new URL(path, SCOPE).href;
const shellUrls = new Set(SHELL_FILES.map(scopedUrl));
const approvedSampleUrls = new Set(APPROVED_SAMPLE_FILES.map(scopedUrl));
const indexUrl = scopedUrl("index.html");

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    try {
      for (const url of shellUrls) {
        const response = await fetch(url, { cache: "reload", credentials: "same-origin" });
        if (!response.ok || response.type === "opaque") throw new Error(`앱 셸 사전 캐시 실패: ${url}`);
        await cache.put(url, response);
      }
    } catch (error) {
      await caches.delete(SHELL_CACHE);
      throw error;
    }
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const shellCaches = (await caches.keys()).filter((name) => name.startsWith("webband-shell-"));
    const oldCaches = shellCaches.filter((name) => name !== SHELL_CACHE);
    // Keep the immediately previous release for an older tab's lazy chunks.
    for (const name of oldCaches.slice(0, -1)) await caches.delete(name);
    await self.clients.claim();
  })());
});

async function matchShellAsset(url) {
  const cache = await caches.open(SHELL_CACHE);
  const current = await cache.match(url);
  if (current) return current;
  const older = (await caches.keys()).filter((name) => name.startsWith("webband-shell-") && name !== SHELL_CACHE);
  for (const name of older.reverse()) {
    const response = await (await caches.open(name)).match(url);
    if (response) return response;
  }
  return undefined;
}

async function trimSampleCache(cache) {
  const entries = [];
  let bytes = 0;
  for (const request of await cache.keys()) {
    const response = await cache.match(request);
    if (!response) continue;
    const storedAt = Number(response.headers.get("x-webband-cached-at"));
    if (!Number.isFinite(storedAt) || Date.now() - storedAt > SAMPLE_MAX_AGE_MS) {
      await cache.delete(request);
      continue;
    }
    const size = Number(response.headers.get("x-webband-bytes")) || (await response.clone().blob()).size;
    entries.push({ request, size });
    bytes += size;
  }
  for (const entry of entries) {
    if (bytes <= SAMPLE_BUDGET_BYTES) break;
    await cache.delete(entry.request);
    bytes -= entry.size;
  }
}

async function sampleStatus() {
  const cache = await caches.open(SAMPLE_CACHE);
  await trimSampleCache(cache);
  const keys = await cache.keys();
  let cachedBytes = 0;
  for (const request of keys) {
    const response = await cache.match(request);
    cachedBytes += Number(response?.headers.get("x-webband-bytes")) || 0;
  }
  return { cachedCount: keys.length, cachedBytes, totalApproved: approvedSampleUrls.size };
}

async function sampleResponse(request) {
  const cache = await caches.open(SAMPLE_CACHE);
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (!response.ok || response.type === "opaque") return response;
    const body = await response.clone().blob();
    if (body.size <= SAMPLE_BUDGET_BYTES) {
      try {
        const headers = new Headers(response.headers);
        headers.set("x-webband-cached-at", String(Date.now()));
        headers.set("x-webband-bytes", String(body.size));
        await cache.delete(request);
        await cache.put(request, new Response(body, { status: response.status, statusText: response.statusText, headers }));
        await trimSampleCache(cache);
      } catch (error) {
        console.warn("샘플 캐시 저장에 실패했습니다.", error);
      }
    }
    return response;
  } catch (error) {
    await trimSampleCache(cache);
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response("오프라인에서 이 샘플을 사용할 수 없습니다.", { status: 503, statusText: "Sample unavailable offline" });
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(SCOPE)) return;
  if (approvedSampleUrls.has(url.href)) {
    event.respondWith(sampleResponse(request));
    return;
  }
  if (request.mode === "navigate" && (url.pathname === new URL(SCOPE).pathname || url.href === indexUrl)) {
    event.respondWith(matchShellAsset(indexUrl).then((cached) => cached ?? fetch(request)));
    return;
  }
  if (shellUrls.has(url.href)) event.respondWith(matchShellAsset(url.href).then((cached) => cached ?? fetch(request)));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
    return;
  }
  if (event.data?.type === "GET_SAMPLE_STATUS" && event.ports[0]) {
    event.waitUntil(sampleStatus().then((status) => event.ports[0].postMessage(status)));
  }
});

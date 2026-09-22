import { createServer } from "vite";
import { performance } from "node:perf_hooks";

const server = await createServer({
  appType: "custom",
  logLevel: "error",
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { hmr: false, middlewareMode: true }
});

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function largeProject(base) {
  const tracks = Array.from({ length: 12 }, (_, trackIndex) => {
    const source = base.tracks[trackIndex % base.tracks.length];
    const id = `history-track-${trackIndex}`;
    const clipCount = trackIndex < 6 ? 3 : 2;
    const clips = Array.from({ length: clipCount }, (_, clipIndex) => {
      const sourceClip = source.clips[0];
      if (trackIndex === 0) {
        return {
          id: `history-clip-${trackIndex}-${clipIndex}`,
          trackId: id,
          type: "audio",
          name: "녹음",
          startBeat: clipIndex * 8,
          lengthBeats: 8,
          color: "#4ade80",
          audioAssetId: "history-recording",
          takeIds: ["history-recording"],
          activeTakeId: "history-recording"
        };
      }
      return {
        ...sourceClip,
        id: `history-clip-${trackIndex}-${clipIndex}`,
        trackId: id,
        name: `클립 ${trackIndex + 1}-${clipIndex + 1}`,
        startBeat: clipIndex * 8,
        lengthBeats: 8,
        notes: Array.from({ length: 32 }, (_, noteIndex) => ({
          id: `history-note-${trackIndex}-${clipIndex}-${noteIndex}`,
          pitch: 48 + (noteIndex % 13),
          startBeat: noteIndex * 0.25,
          durationBeats: 0.2,
          velocity: 0.7
        }))
      };
    });
    return {
      ...source,
      id,
      type: trackIndex === 0 ? "audio" : source.type,
      role: trackIndex === 0 ? "recording" : source.role,
      name: `측정 트랙 ${trackIndex + 1}`,
      clips
    };
  });
  return { ...base, id: "history-large", name: "히스토리 측정", tracks };
}

try {
  const { useDawStore } = await server.ssrLoadModule("/src/store/useDawStore.ts");
  const baseline = useDawStore.getState().project;
  // The Blob belongs to the audio asset repository. A clip stores only its id.
  const recordingBlob = new Blob([new Uint8Array(2 * 1024 * 1024)], { type: "audio/wav" });
  const assetStore = new Map([["history-recording", recordingBlob]]);
  const report = [];
  for (const [name, fixture] of [["default", baseline], ["12-tracks-30-clips", largeProject(baseline)]]) {
    useDawStore.getState().loadProject(fixture);
    global.gc?.();
    const beforeHeap = process.memoryUsage().heapUsed;
    const edits = [];
    for (let index = 0; index < 80; index += 1) {
      const start = performance.now();
      useDawStore.getState().renameProject(`측정 ${name} ${index}`);
      edits.push(performance.now() - start);
    }
    global.gc?.();
    const afterHeap = process.memoryUsage().heapUsed;
    const edited = useDawStore.getState();
    const undoCount = edited.undoStack.length;
    const snapshotBytes = Buffer.byteLength(JSON.stringify(edited.undoStack));
    const undo = [];
    for (let index = 0; index < 80; index += 1) {
      const start = performance.now();
      useDawStore.getState().undo();
      undo.push(performance.now() - start);
    }
    const redo = [];
    for (let index = 0; index < 80; index += 1) {
      const start = performance.now();
      useDawStore.getState().redo();
      redo.push(performance.now() - start);
    }
    report.push({
      fixture: name,
      tracks: fixture.tracks.length,
      clips: fixture.tracks.reduce((sum, track) => sum + track.clips.length, 0),
      undoCount,
      snapshotBytes,
      heapDeltaBytes: afterHeap - beforeHeap,
      editMedianMs: median(edits),
      editMaxMs: Math.max(...edits),
      undoMedianMs: median(undo),
      redoMedianMs: median(redo),
      assetBlobBytes: name === "default" ? 0 : assetStore.get("history-recording").size,
      blobEmbeddedInSnapshots: JSON.stringify(edited.undoStack).includes("audio/wav")
    });
  }
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} finally {
  await server.close();
}

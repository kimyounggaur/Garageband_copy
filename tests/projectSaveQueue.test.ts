import { describe, expect, it, vi } from "vitest";
import { createProjectSaveQueue } from "../src/utils/projectSaveQueue";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

type Snapshot = { id: string; content: string };

describe("project save queue", () => {
  it("reproduces the old overlapping-save overwrite risk", async () => {
    const olderGate = deferred<void>();
    const newerGate = deferred<void>();
    let persisted = "";
    const older = olderGate.promise.then(() => { persisted = "old"; });
    const newer = newerGate.promise.then(() => { persisted = "new"; });

    newerGate.resolve();
    await newer;
    olderGate.resolve();
    await older;
    expect(persisted).toBe("old");
  });

  it("keeps only the newest edit to one project before the debounce flush", async () => {
    const save = vi.fn(async (_snapshot: Snapshot) => {});
    const queue = createProjectSaveQueue(save, { keyOf: (snapshot) => snapshot.id });
    expect(queue.update({ id: "p", content: "first" })).toBe(1);
    expect(queue.update({ id: "p", content: "second" })).toBe(2);
    expect(save).not.toHaveBeenCalled();
    expect(queue.getState()).toMatchObject({ revision: 2, lastSavedRevision: 0, status: "pending", completed: false });

    await queue.flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ id: "p", content: "second" });
    expect(queue.getState()).toMatchObject({ revision: 2, lastSavedRevision: 2, status: "idle", completed: true });
  });

  it("serializes edits made while an older save is in flight", async () => {
    const firstGate = deferred<void>();
    const secondGate = deferred<void>();
    const persisted: string[] = [];
    const save = vi.fn((snapshot: Snapshot) => {
      const gate = snapshot.content === "first" ? firstGate : secondGate;
      return gate.promise.then(() => { persisted.push(snapshot.content); });
    });
    const queue = createProjectSaveQueue(save, { keyOf: (snapshot) => snapshot.id });
    queue.update({ id: "p", content: "first" });
    const firstFlush = queue.flush();
    expect(save).toHaveBeenCalledTimes(1);

    queue.update({ id: "p", content: "second" });
    const secondFlush = queue.flush();
    expect(save).toHaveBeenCalledTimes(1);

    firstGate.resolve();
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    secondGate.resolve();
    await Promise.all([firstFlush, secondFlush]);
    expect(persisted).toEqual(["first", "second"]);
    expect(queue.getState()).toMatchObject({ revision: 2, lastSavedRevision: 2, status: "idle", completed: true });
  });

  it("keeps a failed snapshot available for explicit retry", async () => {
    const save = vi.fn()
      .mockRejectedValueOnce(new Error("quota"))
      .mockResolvedValueOnce(undefined);
    const queue = createProjectSaveQueue<Snapshot>(save, { keyOf: (snapshot) => snapshot.id });
    queue.update({ id: "p", content: "important" });
    await expect(queue.flush()).rejects.toThrow("quota");
    expect(queue.getState()).toMatchObject({ revision: 1, lastSavedRevision: 0, status: "error", completed: false });

    await queue.retry();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith({ id: "p", content: "important" });
    expect(queue.getState()).toMatchObject({ revision: 1, lastSavedRevision: 1, status: "idle", completed: true });
  });

  it("continues with a newer snapshot when an obsolete in-flight save fails", async () => {
    const olderGate = deferred<void>();
    const save = vi.fn((snapshot: Snapshot) => snapshot.content === "older" ? olderGate.promise : Promise.resolve());
    const queue = createProjectSaveQueue(save, { keyOf: (snapshot) => snapshot.id });
    queue.update({ id: "p", content: "older" });
    const firstFlush = queue.flush();
    queue.update({ id: "p", content: "newer" });
    const secondFlush = queue.flush();

    olderGate.reject(new Error("stale write failed"));
    await Promise.all([firstFlush, secondFlush]);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith({ id: "p", content: "newer" });
    expect(queue.getState()).toMatchObject({ revision: 2, lastSavedRevision: 2, status: "idle", completed: true });
  });

  it("retains unsaved projects when the user switches project during debounce", async () => {
    const saved: string[] = [];
    const queue = createProjectSaveQueue<Snapshot>(async (snapshot) => { saved.push(`${snapshot.id}:${snapshot.content}`); }, {
      keyOf: (snapshot) => snapshot.id
    });
    queue.update({ id: "a", content: "draft" });
    queue.update({ id: "b", content: "other" });
    queue.update({ id: "a", content: "latest" });

    await queue.flush();
    expect(saved).toEqual(["b:other", "a:latest"]);
    expect(queue.getState()).toMatchObject({ revision: 3, lastSavedRevision: 3, completed: true });
  });

  it("flushes immediately when the page becomes hidden, bypassing the host's timer", async () => {
    const save = vi.fn(async (_snapshot: Snapshot) => {});
    const queue = createProjectSaveQueue(save, { keyOf: (snapshot) => snapshot.id });
    queue.update({ id: "p", content: "unsaved" });
    expect(save).not.toHaveBeenCalled();
    await queue.flush();
    expect(save).toHaveBeenCalledOnce();
  });

  it("reports revisions and status changes to subscribers", async () => {
    const save = vi.fn(async (_snapshot: Snapshot) => {});
    const queue = createProjectSaveQueue(save, { keyOf: (snapshot) => snapshot.id });
    const statuses: string[] = [];
    const unsubscribe = queue.subscribe((state) => { statuses.push(state.status); });
    queue.update({ id: "p", content: "changed" });
    await queue.flush();
    unsubscribe();
    queue.update({ id: "p", content: "later" });
    expect(statuses).toEqual(["pending", "saving", "idle"]);
  });
});

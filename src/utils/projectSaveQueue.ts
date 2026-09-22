export type ProjectSaveStatus = "idle" | "pending" | "saving" | "error";

export type ProjectSaveState = {
  revision: number;
  lastSavedRevision: number;
  savingRevision?: number;
  pendingCount: number;
  status: ProjectSaveStatus;
  completed: boolean;
  error?: unknown;
};

type PendingSave<T> = {
  key: string;
  revision: number;
  snapshot: T;
};

/**
 * Holds immutable project snapshots until the caller's debounce timer or
 * visibility handler asks for a flush. Writes are serialized so an older
 * IndexedDB/network save cannot finish after and overwrite a newer one.
 */
export function createProjectSaveQueue<T>(
  save: (snapshot: T) => Promise<unknown>,
  options: { keyOf?: (snapshot: T) => string } = {}
) {
  let revision = 0;
  let lastSavedRevision = 0;
  let status: ProjectSaveStatus = "idle";
  let error: unknown;
  let pending: PendingSave<T>[] = [];
  let saving: PendingSave<T> | undefined;
  let running: Promise<void> | undefined;
  const listeners = new Set<(state: ProjectSaveState) => void>();

  function getState(): ProjectSaveState {
    return {
      revision,
      lastSavedRevision,
      savingRevision: saving?.revision,
      pendingCount: pending.length,
      status,
      completed: revision === lastSavedRevision && pending.length === 0 && !saving,
      error
    };
  }

  function notify() {
    const state = getState();
    listeners.forEach((listener) => listener(state));
  }

  function update(snapshot: T) {
    revision += 1;
    const key = options.keyOf?.(snapshot) ?? "__single_project__";
    // A newer immutable snapshot supersedes an unsent one for the same project.
    // Moving it to the end keeps pending writes ordered by revision across projects.
    pending = pending.filter((item) => item.key !== key);
    pending.push({ key, revision, snapshot });
    error = undefined;
    status = saving ? "saving" : "pending";
    notify();
    return revision;
  }

  async function drain() {
    while (pending.length > 0) {
      const next = pending.shift()!;
      saving = next;
      error = undefined;
      status = "saving";
      notify();

      try {
        await save(next.snapshot);
        lastSavedRevision = next.revision;
        saving = undefined;
        status = pending.length > 0 ? "pending" : "idle";
        notify();
      } catch (reason) {
        saving = undefined;
        // If the same project changed during the failed save, its newer
        // snapshot is already queued and is the one that needs persistence.
        if (pending.some((item) => item.key === next.key && item.revision > next.revision)) {
          status = "pending";
          notify();
          continue;
        }
        pending.unshift(next);
        error = reason;
        status = "error";
        notify();
        throw reason;
      }
    }
  }

  async function flush(): Promise<number> {
    while (pending.length > 0 || running) {
      if (!running) {
        const run = drain();
        running = run;
        // Clear the shared run for all callers, including a failed flush.
        void run.then(
          () => { if (running === run) running = undefined; },
          () => { if (running === run) running = undefined; }
        );
      }
      await running;
    }
    return lastSavedRevision;
  }

  function subscribe(listener: (state: ProjectSaveState) => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }

  return { update, flush, retry: flush, getState, subscribe };
}

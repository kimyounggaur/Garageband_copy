import { afterEach, describe, expect, it, vi } from "vitest";
import { project } from "./fixtures";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("current project pointer", () => {
  it("restores the project the user opened even when an older save finished later", async () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); }
    });
    const { loadLastProject, markCurrentProject, projectRepositoryForMode } = await import("../src/db/studioRepository");
    const repository = projectRepositoryForMode("local");
    const older = project({ id: "older", name: "이전 작업" });
    const opened = project({ id: "opened", name: "열어 둔 작업" });
    vi.spyOn(repository, "loadProject").mockImplementation(async (id) => id === opened.id ? opened : undefined);
    vi.spyOn(repository, "loadLastProject").mockResolvedValue(older);

    markCurrentProject(older.id, "local");
    markCurrentProject(opened.id, "local");
    // An older asynchronous save can still update the repository's legacy
    // lastProjectId. Navigation is recorded separately and takes precedence.
    expect((await loadLastProject())?.id).toBe(opened.id);
    expect(values.get("webband.currentProject.local")).toBe(opened.id);
  });
});

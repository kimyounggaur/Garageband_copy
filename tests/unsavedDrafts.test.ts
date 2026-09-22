import { describe, expect, it } from "vitest";
import { hasAppBusy, hasUnsavedDrafts, setUnsavedDraft, whileAppBusy } from "../src/utils/unsavedDrafts";

describe("PWA refresh work guards", () => {
  it("keeps refresh blocked until an asynchronous submission finishes", async () => {
    let finish!: () => void;
    const pending = whileAppBusy(() => new Promise<void>((resolve) => { finish = resolve; }));
    expect(hasAppBusy()).toBe(true);
    finish();
    await pending;
    expect(hasAppBusy()).toBe(false);
  });

  it("releases a failed write while keeping an unsaved teacher draft protected", async () => {
    setUnsavedDraft("teacher-feedback", true);
    await expect(whileAppBusy(async () => { throw new Error("save failed"); })).rejects.toThrow("save failed");
    expect(hasAppBusy()).toBe(false);
    expect(hasUnsavedDrafts()).toBe(true);
    setUnsavedDraft("teacher-feedback", false);
    expect(hasUnsavedDrafts()).toBe(false);
  });
});

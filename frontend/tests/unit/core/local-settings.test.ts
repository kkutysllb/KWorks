// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from "vitest";

async function loadSettingsStore() {
  vi.resetModules();
  return await import("@/core/settings/store");
}

describe("local settings", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn((key: string) => storage.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
          storage.set(key, value);
        }),
        removeItem: vi.fn((key: string) => {
          storage.delete(key);
        }),
        clear: vi.fn(() => {
          storage.clear();
        }),
      },
    });
  });

  test("drops legacy workspace roots from persisted global context", async () => {
    window.localStorage.setItem(
      "kkworks.local-settings",
      JSON.stringify({
        context: {
          model_name: "MiniMax-M3",
          workspaceRoot: "/Users/libing/kk_Projects/MongoDBAgent",
          workModeId: "task",
        },
      }),
    );

    const { getBaseSettingsSnapshot } = await loadSettingsStore();

    expect(getBaseSettingsSnapshot().context).toMatchObject({
      model_name: "MiniMax-M3",
      workModeId: "task",
    });
    expect(getBaseSettingsSnapshot().context.workspaceRoot).toBeUndefined();
  });

  test("keeps workspace roots thread-local so new tasks start unselected", async () => {
    const {
      getBaseSettingsSnapshot,
      getThreadContextSnapshot,
      updateThreadSettings,
    } = await loadSettingsStore();

    updateThreadSettings("history-thread", "context", {
      model_name: "MiniMax-M3",
      workspaceRoot: "/Users/libing/kk_Projects/MongoDBAgent",
      workModeId: "coding",
    });

    expect(getThreadContextSnapshot("history-thread")).toMatchObject({
      workspaceRoot: "/Users/libing/kk_Projects/MongoDBAgent",
    });
    expect(getThreadContextSnapshot("new-draft-thread")?.workspaceRoot).toBeUndefined();
    expect(getBaseSettingsSnapshot().context).toMatchObject({
      model_name: "MiniMax-M3",
      workModeId: "coding",
    });
    expect(getBaseSettingsSnapshot().context.workspaceRoot).toBeUndefined();

    const persisted = JSON.parse(
      window.localStorage.getItem("kkworks.local-settings") ?? "{}",
    ) as { context?: { workspaceRoot?: string } };
    expect(persisted.context?.workspaceRoot).toBeUndefined();
  });
});

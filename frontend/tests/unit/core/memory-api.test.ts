// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/env", () => ({
  env: {
    NEXT_PUBLIC_BACKEND_BASE_URL: "http://127.0.0.1:19987",
    NEXT_PUBLIC_RUNTIME_API_BASE_URL: "http://127.0.0.1:19987/api",
  },
}));

vi.mock("@/core/auth/session", () => ({
  getDesktopSessionToken: vi.fn(() => "desktop-token"),
}));

import { loadMemory } from "@/core/memory/api";

describe("memory API normalization", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("normalizes sparse QiongQi memory responses into the UI memory shape", async () => {
    const memory = await loadMemory();

    expect(memory.user.workContext.summary).toBe("");
    expect(memory.user.personalContext.summary).toBe("");
    expect(memory.user.topOfMind.summary).toBe("");
    expect(memory.history.recentMonths.summary).toBe("");
    expect(memory.history.earlierContext.summary).toBe("");
    expect(memory.history.longTermBackground.summary).toBe("");
    expect(memory.facts).toEqual([]);
  });
});

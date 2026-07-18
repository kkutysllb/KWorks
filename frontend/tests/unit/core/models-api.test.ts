// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/env", () => ({
  env: {
    NEXT_PUBLIC_BACKEND_BASE_URL: "http://127.0.0.1:19987",
    NEXT_PUBLIC_RUNTIME_API_BASE_URL: "http://127.0.0.1:19987/api",
  },
}));

const fetchMock = vi.fn();

vi.mock("@/core/api/fetcher", () => ({
  fetch: (...args: unknown[]) => fetchMock(...args),
}));

import { activateModel } from "@/core/models/api";

describe("models API", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    (window as unknown as { kworksDesktop?: { gatewayPort: number } }).kworksDesktop =
      { gatewayPort: 19987 };
  });

  test("activates a QiongQi model profile as the runtime core", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ model: "minimax m2", active: true }),
    });

    await activateModel("minimax m2");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19987/api/models/minimax%20m2/activate",
      { method: "POST" },
    );
  });
});

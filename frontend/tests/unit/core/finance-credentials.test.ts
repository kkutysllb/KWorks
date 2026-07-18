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

import { fetchFinanceCredentials } from "@/core/finance/credentials";

function okJson(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
  };
}

describe("finance credentials API", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  test("retries transient fetch failures before loading credentials", async () => {
    const timeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation(
      ((callback: TimerHandler) => {
        if (typeof callback === "function") callback();
        return 0 as unknown as ReturnType<typeof setTimeout>;
      }) as unknown as typeof setTimeout,
    );

    try {
      fetchMock
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValueOnce(
          okJson({
            iwencai: true,
            tushare: false,
            sources: {
              iwencai: "environment",
              tushare: "missing",
            },
            config: {
              apiBaseUrl: "https://openapi.iwencai.com",
              queryEndpoint: "/v1/query2data",
              comprehensiveEndpoint: "/v1/comprehensive/search",
              webUrl: "https://www.iwencai.com/unifiedwap/chat",
            },
          }),
        );

      await expect(fetchFinanceCredentials()).resolves.toMatchObject({
        iwencai: true,
        tushare: false,
      });
      expect(fetchMock).toHaveBeenCalledTimes(3);
    } finally {
      timeoutSpy.mockRestore();
    }
  });
});

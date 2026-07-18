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

import {
  fetchQiongQiThreadUsage,
  fetchTokenUsageStats,
  fetchTokenUsageTimeseries,
} from "@/core/api/token-usage";

function okJson(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
  };
}

describe("token usage API", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    (window as unknown as { kworksDesktop?: { gatewayPort: number } }).kworksDesktop =
      { gatewayPort: 19987 };
  });

  test("reads QiongQi model usage instead of legacy timeseries endpoints", async () => {
    fetchMock
      .mockResolvedValueOnce(
        okJson({
          group_by: "model",
          buckets: [
            {
              model: "deepseek-chat",
              input_tokens: 100,
              output_tokens: 40,
              cached_tokens: 60,
              cache_miss_tokens: 40,
              cache_hit_rate: 0.6,
              total_tokens: 140,
              turns: 2,
              thread_count: 1,
              token_economy_savings_tokens: 25,
            },
          ],
          days: [],
          totals: {
            input_tokens: 100,
            output_tokens: 40,
            cached_tokens: 60,
            cache_miss_tokens: 40,
            cache_hit_rate: 0.6,
            total_tokens: 140,
            turns: 2,
            thread_count: 1,
            token_economy_savings_tokens: 25,
          },
        }),
      )
      .mockResolvedValueOnce(
        okJson({
          group_by: "model",
          buckets: [
            {
              model: "deepseek-chat",
              input_tokens: 100,
              output_tokens: 40,
              total_tokens: 140,
              turns: 2,
              thread_count: 1,
            },
            {
              model: "minimax-m3",
              input_tokens: 20,
              output_tokens: 10,
              total_tokens: 30,
              turns: 1,
              thread_count: 1,
            },
          ],
          model_days: [
            {
              date: "2026-06-27",
              model: "deepseek-chat",
              input_tokens: 100,
              output_tokens: 40,
              total_tokens: 140,
              turns: 2,
              thread_count: 1,
            },
            {
              date: "2026-06-28",
              model: "minimax-m3",
              input_tokens: 20,
              output_tokens: 10,
              total_tokens: 30,
              turns: 1,
              thread_count: 1,
            },
          ],
          days: [
            {
              date: "2026-06-27",
              input_tokens: 100,
              output_tokens: 40,
              total_tokens: 140,
              turns: 2,
              thread_count: 1,
            },
            {
              date: "2026-06-28",
              input_tokens: 20,
              output_tokens: 10,
              total_tokens: 30,
              turns: 1,
              thread_count: 1,
            },
          ],
          totals: {
            input_tokens: 120,
            output_tokens: 50,
            total_tokens: 170,
            turns: 3,
            thread_count: 2,
          },
        }),
      );

    const stats = await fetchTokenUsageStats({ year: 2026, month: 6 });
    const timeseries = await fetchTokenUsageTimeseries(31, {
      year: 2026,
      month: 6,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.every((url) => url.includes("/api/usage"))).toBe(true);
    expect(urls).toEqual([
      expect.stringContaining("group_by=model"),
      expect.stringContaining("group_by=model"),
    ]);
    expect(urls.some((url) => url.includes("/api/threads/token-usage"))).toBe(false);
    expect(stats).toMatchObject({
      total_tokens: 140,
      total_input_tokens: 100,
      total_output_tokens: 40,
      total_runs: 2,
      efficiency: {
        actual_tokens: 140,
        cache_hit_tokens: 60,
        token_economy_savings_tokens: 25,
        cache_hit_rate: 0.6,
      },
      by_model: {
        "deepseek-chat": {
          tokens: 140,
          runs: 2,
          input_tokens: 100,
          output_tokens: 40,
        },
      },
    });
    expect(timeseries).toEqual([
      {
        date: "2026-06-27",
        model_name: "deepseek-chat",
        run_count: 2,
        llm_call_count: 2,
        total_tokens: 140,
        input_tokens: 100,
        output_tokens: 40,
      },
      {
        date: "2026-06-28",
        model_name: "minimax-m3",
        run_count: 1,
        llm_call_count: 1,
        total_tokens: 30,
        input_tokens: 20,
        output_tokens: 10,
      },
    ]);
  });

  test("reads QiongQi thread usage for ROI with real savings counters", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({
        group_by: "thread",
        buckets: [
          {
            thread_id: "thr_1",
            input_tokens: 120,
            output_tokens: 30,
            total_tokens: 150,
            turns: 2,
            cached_tokens: 80,
            cache_miss_tokens: 20,
            cache_hit_rate: 0.75,
            cache_savings_usd: 0.012,
            token_economy_savings_tokens: 45,
          },
        ],
        totals: {
          input_tokens: 120,
          output_tokens: 30,
          total_tokens: 150,
          turns: 2,
          thread_count: 1,
        },
      }),
    );

    const usage = await fetchQiongQiThreadUsage("thr_1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/api/usage?group_by=thread",
    );
    expect(usage).toMatchObject({
      threadId: "thr_1",
      inputTokens: 120,
      outputTokens: 30,
      totalTokens: 150,
      turns: 2,
      cachedTokens: 80,
      cacheHitTokens: 80,
      cacheMissTokens: 20,
      cacheHitRate: 0.75,
      cacheSavingsUsd: 0.012,
      tokenEconomySavingsTokens: 45,
    });
  });
});

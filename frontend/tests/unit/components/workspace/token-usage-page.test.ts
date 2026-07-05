// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { TokenUsagePage } from "@/components/workspace/token-usage/token-usage-page";
import { I18nProvider } from "@/core/i18n/context";
import { DEFAULT_LOCALE } from "@/core/i18n/locale";

const TestI18nProvider = I18nProvider as React.ComponentType<{
  children?: React.ReactNode;
  initialLocale: typeof DEFAULT_LOCALE;
}>;

const { fetchTokenUsageStatsMock, fetchTokenUsageTimeseriesMock, loadModelsMock } =
  vi.hoisted(() => ({
    fetchTokenUsageStatsMock: vi.fn(),
    fetchTokenUsageTimeseriesMock: vi.fn(),
    loadModelsMock: vi.fn(),
  }));

vi.mock("@/core/api/token-usage", () => ({
  fetchTokenUsageStats: fetchTokenUsageStatsMock,
  fetchTokenUsageTimeseries: fetchTokenUsageTimeseriesMock,
}));

vi.mock("@/core/models/api", () => ({
  loadModels: loadModelsMock,
}));

describe("TokenUsagePage charts", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  beforeEach(() => {
    fetchTokenUsageStatsMock.mockResolvedValue({
      total_tokens: 300,
      total_input_tokens: 200,
      total_output_tokens: 100,
      total_runs: 2,
      total_llm_call_count: 3,
      by_model: {
        "glm-5.2": {
          tokens: 300,
          runs: 2,
          llm_call_count: 3,
          input_tokens: 200,
          output_tokens: 100,
        },
      },
      efficiency: {
        actual_tokens: 300,
        cache_hit_tokens: 40,
        token_economy_savings_tokens: 20,
        cache_hit_rate: 0.2,
      },
    });
    fetchTokenUsageTimeseriesMock.mockResolvedValue([
      {
        date: "2026-07-05",
        model_name: "glm-5.2",
        run_count: 2,
        llm_call_count: 3,
        total_tokens: 300,
        input_tokens: 200,
        output_tokens: 100,
      },
    ]);
    loadModelsMock.mockResolvedValue({
      models: [{ name: "glm-5.2", display_name: "GLM-5.2" }],
    });
  });

  afterEach(() => {
    root?.unmount();
    container?.remove();
    root = undefined;
    container = undefined;
    vi.restoreAllMocks();
  });

  test("does not emit Recharts size warnings while chart containers are mounting", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        React.createElement(
          TestI18nProvider,
          {
            initialLocale: DEFAULT_LOCALE,
          },
          React.createElement(TokenUsagePage),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const warnings = warn.mock.calls
      .map((call) => call.join(" "))
      .join("\n");
    expect(warnings).not.toContain("The width");
    expect(warnings).not.toContain("height");
  });
});

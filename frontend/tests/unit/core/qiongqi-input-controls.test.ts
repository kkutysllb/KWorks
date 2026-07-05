import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import {
  buildQiongQiRoiSummary,
  getWorkspaceRootDisplayName,
  isSelectedWorkspaceRoot,
  shouldRetryQiongQiRoiUsageFetch,
} from "@/components/workspace/qiongqi-roi-strip";

const repoRoot = resolve(__dirname, "../../..");

describe("QiongQi input controls", () => {
  test("input box exposes QiongQi execution controls and workspace root", () => {
    const source = readFileSync(
      resolve(repoRoot, "src/components/workspace/input-box.tsx"),
      "utf8",
    );

    expect(source).toContain("QiongQiExecutionModeMenu");
    expect(source).toContain("WorkspaceRootMenu");
    expect(source).toContain("QiongQiRoiStrip");
    expect(source).toContain("workspaceRoot");
    expect(source).toContain("approvalPolicy");
    expect(source).not.toContain("sandboxMode");
    expect(source).not.toContain("沙箱范围");
  });

  test("ROI summary derives stable display metrics from token usage", () => {
    expect(
      buildQiongQiRoiSummary({
        inputTokens: 1200,
        outputTokens: 800,
        totalTokens: 2000,
      }),
    ).toMatchObject({
      totalTokens: 2000,
      outputShare: 40,
      efficiencyScore: 64,
      savedTokensEstimate: 600,
    });
  });

  test("ROI summary prefers QiongQi API usage over message-local estimates", () => {
    expect(
      buildQiongQiRoiSummary(
        {
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2,
        },
        {
          threadId: "thr_1",
          inputTokens: 120,
          outputTokens: 30,
          reasoningTokens: 0,
          totalTokens: 150,
          turns: 2,
          cachedTokens: 80,
          cacheHitTokens: 60,
          cacheMissTokens: 20,
          cacheHitRate: 0.75,
          costUsd: 0,
          costCny: 0,
          cacheSavingsUsd: 0.012,
          cacheSavingsCny: 0,
          tokenEconomySavingsTokens: 45,
          tokenEconomySavingsUsd: 0,
          tokenEconomySavingsCny: 0,
        },
      ),
    ).toMatchObject({
      totalTokens: 150,
      inputTokens: 120,
      outputTokens: 30,
      savedTokensEstimate: 105,
      cacheHitTokens: 60,
      cacheHitRate: 0.75,
      turns: 2,
      source: "api",
    });
  });

  test("ROI usage fetch retries only while a populated thread has no API usage", () => {
    expect(
      shouldRetryQiongQiRoiUsageFetch({
        apiUsageReady: false,
        messageCount: 2,
        attempt: 0,
      }),
    ).toBe(true);
    expect(
      shouldRetryQiongQiRoiUsageFetch({
        apiUsageReady: true,
        messageCount: 2,
        attempt: 0,
      }),
    ).toBe(false);
    expect(
      shouldRetryQiongQiRoiUsageFetch({
        apiUsageReady: false,
        messageCount: 0,
        attempt: 0,
      }),
    ).toBe(false);
  });

  test("workspace root display falls back to project root when unset", () => {
    expect(getWorkspaceRootDisplayName("/Users/libing/project")).toBe("project");
    expect(getWorkspaceRootDisplayName("")).toBe("未设置工作目录");
    expect(getWorkspaceRootDisplayName(".")).toBe("未设置工作目录");
    expect(isSelectedWorkspaceRoot(".")).toBe(false);
    expect(isSelectedWorkspaceRoot(" . ")).toBe(false);
    expect(isSelectedWorkspaceRoot("/Users/libing/project")).toBe(true);
  });
});

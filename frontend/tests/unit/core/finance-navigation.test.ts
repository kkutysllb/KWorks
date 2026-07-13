import { describe, expect, test } from "vitest";

import {
  financeModulePath,
  isFinanceNewTaskRequest,
} from "@/core/finance/navigation";

describe("finance navigation", () => {
  test("module cards link to a fresh task request", () => {
    expect(financeModulePath("market-overview", { newTask: true })).toBe(
      "/workspace/finance/market-overview?new=1",
    );
  });

  test("encodes module ids and detects the new-task marker", () => {
    const href = financeModulePath("资金 流向", { newTask: true });
    expect(href).toBe("/workspace/finance/%E8%B5%84%E9%87%91%20%E6%B5%81%E5%90%91?new=1");
    expect(isFinanceNewTaskRequest(new URLSearchParams("new=1"))).toBe(true);
    expect(isFinanceNewTaskRequest(new URLSearchParams("new=0"))).toBe(false);
  });
});

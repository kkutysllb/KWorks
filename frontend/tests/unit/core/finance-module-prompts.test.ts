import { describe, expect, test } from "vitest";

import { buildFinanceModulePrompt } from "@/core/finance/module-prompts";
import {
  FINANCE_MODULES,
  FINANCE_SHARED_SKILL_IDS,
  getFinanceModule,
} from "@/core/finance/modules";

describe("finance module prompts", () => {
  test("each finance module provides an injectable scenario prompt", () => {
    for (const financeModule of FINANCE_MODULES) {
      const prompt = buildFinanceModulePrompt(
        financeModule,
        "请基于最新数据做一次分析",
      );

      expect(prompt).toContain("[金融量化场景上下文]");
      expect(prompt).toContain(`当前模块：${financeModule.name}`);
      expect(prompt).toContain(`模块ID：${financeModule.id}`);
      expect(prompt).toContain("优先技能包：");
      expect(prompt).toContain("共享技能包：");
      expect(prompt).toContain("用户原始问题：请基于最新数据做一次分析");
    }
  });

  test("market analysis uses the actual built-in news skill id", () => {
    const market = getFinanceModule("market-analysis");

    expect(market?.skillIds).toContain("kk-news-search");
    expect(market?.skillIds).not.toContain("news-search");
  });

  test("stock analysis prompt routes to the stock-specific skills and report tools", () => {
    const stock = getFinanceModule("stock-analysis");
    expect(stock).toBeDefined();

    const prompt = buildFinanceModulePrompt(stock!, "贵州茅台全面分析");

    expect(prompt).toContain("kk-stock-analysis");
    expect(prompt).toContain("kk-financial-statement");
    expect(prompt).toContain("kk-valuation-model");
    expect(prompt).toContain(FINANCE_SHARED_SKILL_IDS[0]);
    expect(prompt).toContain("先按当前模块的优先技能包选择数据入口");
  });
});

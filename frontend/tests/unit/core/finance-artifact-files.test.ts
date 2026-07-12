import { describe, expect, test } from "vitest";

import {
  isHtmlArtifact,
  resolveFinanceMarkdownArtifact,
} from "@/components/workspace/finance/finance-artifact-files";

describe("finance artifact files", () => {
  test("prefers a same-directory Markdown file with the HTML stem", () => {
    expect(
      resolveFinanceMarkdownArtifact("reports/dashboard.html", [
        "reports/latest_report.md",
        "reports/dashboard.md",
        "other/newer.md",
      ]),
    ).toBe("reports/dashboard.md");
  });

  test("selects the semantic daily report beside a generated dashboard", () => {
    const root = "reports/2026-07-10_market_linkage";

    expect(
      resolveFinanceMarkdownArtifact(`${root}/dashboard.html`, [
        `${root}/daily_report.md`,
        `${root}/AUDIT.md`,
        `${root}/one_liner.md`,
        `${root}/dashboard.html`,
      ]),
    ).toBe(`${root}/daily_report.md`);
  });

  test("otherwise selects the latest eligible Markdown in the same directory", () => {
    expect(
      resolveFinanceMarkdownArtifact("reports/dashboard.html", [
        "reports/first.md",
        "other/task-latest.md",
        "reports/second.md",
      ]),
    ).toBe("reports/second.md");
  });

  test("otherwise selects the latest eligible task Markdown", () => {
    expect(
      resolveFinanceMarkdownArtifact("reports/dashboard.html", [
        "notes/older.md",
        "outputs/latest.md",
        "reports/dashboard.html",
      ]),
    ).toBe("outputs/latest.md");
  });

  test("normalizes Windows separators for matching and returns the original path", () => {
    expect(
      resolveFinanceMarkdownArtifact("reports\\daily\\dashboard.HTML", [
        "reports/other.md",
        "reports\\daily\\dashboard.MD",
      ]),
    ).toBe("reports\\daily\\dashboard.MD");
  });

  test("uses auxiliary Markdown only when no normal report exists", () => {
    expect(
      resolveFinanceMarkdownArtifact("reports/dashboard.html", [
        "reports/dashboard_audit.md",
        "reports/one-liner.md",
        "notes/analysis.md",
      ]),
    ).toBe("notes/analysis.md");

    expect(
      resolveFinanceMarkdownArtifact("reports/dashboard.html", [
        "reports/README.md",
        "reports/审计.md",
        "reports/一句话.md",
      ]),
    ).toBe("reports/一句话.md");
  });

  test("returns undefined when no Markdown artifact exists", () => {
    expect(
      resolveFinanceMarkdownArtifact("reports/dashboard.html", [
        "reports/dashboard.html",
        "reports/data.json",
      ]),
    ).toBeUndefined();
  });

  test.each(["report", "analysis", "报告", "分析"])(
    "prefers a same-directory semantic %s filename over general Markdown",
    (semanticName) => {
      expect(
        resolveFinanceMarkdownArtifact("reports/dashboard.html", [
          `reports/${semanticName}.md`,
          "reports/newest-notes.md",
        ]),
      ).toBe(`reports/${semanticName}.md`);
    },
  );

  test("detects HTML artifacts case-insensitively", () => {
    expect(isHtmlArtifact("reports/dashboard.html")).toBe(true);
    expect(isHtmlArtifact("reports/dashboard.HTML")).toBe(true);
    expect(isHtmlArtifact("reports/dashboard.htm")).toBe(false);
    expect(isHtmlArtifact("reports/dashboard.html.md")).toBe(false);
  });
});

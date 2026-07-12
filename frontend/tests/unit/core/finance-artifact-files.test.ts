import { describe, expect, test } from "vitest";

import {
  artifactPathname,
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
      resolveFinanceMarkdownArtifact("reports/daily/dashboard.HTML", [
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

  test("detects HTML artifacts in live write-file selections", () => {
    expect(
      isHtmlArtifact(
        "write-file:reports/dashboard.HTML?message_id=m&tool_call_id=c",
      ),
    ).toBe(true);
  });

  test("resolves a plain semantic report from a live dashboard selection", () => {
    const root = "reports/2026-07-10_market_linkage";

    expect(
      resolveFinanceMarkdownArtifact(
        `write-file:${root}/dashboard.html?message_id=m&tool_call_id=c`,
        [
          `${root}/daily_report.md`,
          `${root}/AUDIT.md`,
          `${root}/one_liner.md`,
          "other/latest.md",
        ],
      ),
    ).toBe(`${root}/daily_report.md`);
  });

  test("decodes encoded live artifact pathnames", () => {
    expect(
      artifactPathname(
        "write-file:reports%2Fmarket%20linkage%2Fdashboard.html?message_id=m",
      ),
    ).toBe("reports/market linkage/dashboard.html");
  });

  test("leaves plain artifact paths unchanged", () => {
    expect(artifactPathname("reports/market linkage/dashboard.html")).toBe(
      "reports/market linkage/dashboard.html",
    );
  });

  test("returns malformed live selections unchanged", () => {
    const malformed = "write-file:reports/%E0%A4%A/dashboard.html";

    expect(artifactPathname(malformed)).toBe(malformed);
  });

  test("preserves a selected live Markdown artifact path", () => {
    const markdownSelection =
      "write-file:reports/dashboard.md?message_id=m&tool_call_id=c";

    expect(
      resolveFinanceMarkdownArtifact("reports/dashboard.html", [
        markdownSelection,
      ]),
    ).toBe(markdownSelection);
  });
});

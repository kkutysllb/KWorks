import { readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

import { describe, expect, test } from "vitest";

const repoRoot = resolve(__dirname, "../../..");
const sourceRoot = resolve(repoRoot, "src");

describe("dialog accessibility", () => {
  test("every dialog content declares a real description", () => {
    const violations: string[] = [];

    for (const file of tsxFiles(sourceRoot)) {
      const source = readFileSync(file, "utf8");
      const matches = source.matchAll(/<DialogContent\b/g);

      for (const match of matches) {
        const start = match.index ?? 0;
        const openTagEnd = source.indexOf(">", start);
        const closeTagStart = source.indexOf("</DialogContent>", start);
        const openTag = source.slice(start, openTagEnd + 1);
        const content = source.slice(
          start,
          closeTagStart === -1 ? openTagEnd + 1 : closeTagStart,
        );

        const hasUndefinedOptOut = openTag.includes(
          "aria-describedby={undefined}",
        );
        const hasRealDescription =
          !hasUndefinedOptOut &&
          (openTag.includes("aria-describedby") ||
            content.includes("<DialogDescription"));

        if (!hasRealDescription) {
          violations.push(`${relative(repoRoot, file)}:${lineOf(source, start)}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

function tsxFiles(dir: string): string[] {
  const entries = readdirSync(dir).sort();
  return entries.flatMap((entry) => {
    const path = resolve(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return tsxFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

function lineOf(source: string, index: number) {
  return source.slice(0, index).split("\n").length;
}

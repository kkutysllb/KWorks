import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const repoRoot = resolve(__dirname, "../../..");

function read(path: string): string {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

describe("desktop titlebar drag region", () => {
  test("defines draggable and non-draggable desktop titlebar regions", () => {
    const source = read("src/styles/globals.css");

    expect(source).toContain(".desktop-titlebar-drag");
    expect(source).toContain("-webkit-app-region: drag");
    expect(source).toContain(".desktop-no-drag");
    expect(source).toContain("-webkit-app-region: no-drag");
  });

  test("marks visible top bars as desktop draggable regions", () => {
    expect(read("src/components/landing/header.tsx")).toContain(
      "desktop-titlebar-drag",
    );
    expect(read("src/components/workspace/workspace-container.tsx")).toContain(
      "desktop-titlebar-drag",
    );
    expect(read("src/components/workspace/workspace-header.tsx")).toContain(
      "desktop-titlebar-drag",
    );
    const financePreview = read(
      "src/components/workspace/finance/finance-artifact-preview.tsx",
    );
    expect(financePreview).toContain("desktop-titlebar-drag");
    expect(financePreview).toContain("desktop-no-drag");
    expect(financePreview).toContain('data-desktop-no-drag="true"');
  });
});

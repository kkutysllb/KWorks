import { existsSync, readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

describe("removed workspace task tabs", () => {
  test("workspace shell no longer mounts the top task tabs feature", () => {
    const source = readFileSync(
      new URL("../../../src/app/workspace/workspace-content.tsx", import.meta.url),
      "utf8",
    );

    expect(source).not.toContain("WorkspaceTaskTabs");
    expect(source).not.toContain("WorkspaceRuntimeProvider");
  });

  test("top task tabs implementation files stay deleted", () => {
    expect(
      existsSync(
        new URL(
          "../../../src/components/workspace/workspace-task-tabs.tsx",
          import.meta.url,
        ),
      ),
    ).toBe(false);
    expect(
      existsSync(
        new URL("../../../src/core/workspace-task-tabs.ts", import.meta.url),
      ),
    ).toBe(false);
  });
});

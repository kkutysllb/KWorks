import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import { DEFAULT_LOCAL_SETTINGS } from "@/core/settings/local";

const repoRoot = resolve(__dirname, "../../..");

describe("task mode defaults", () => {
  test("uses agent as the default task mode", () => {
    expect(DEFAULT_LOCAL_SETTINGS.context.taskMode).toBe("agent");
  });

  test("exposes only execute and plan in the task mode menu", () => {
    const inputBox = readFileSync(
      resolve(repoRoot, "src/components/workspace/input-box.tsx"),
      "utf8",
    );

    expect(inputBox).toContain('type TaskMode = "agent" | "plan"');
    expect(inputBox).not.toContain('title="自动"');
    expect(inputBox).not.toContain("默认先生成计划");
    expect(inputBox.indexOf('title="执行"')).toBeLessThan(
      inputBox.indexOf('title="规划"'),
    );
  });
});

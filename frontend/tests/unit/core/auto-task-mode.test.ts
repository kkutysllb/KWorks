import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import { DEFAULT_LOCAL_SETTINGS } from "@/core/settings/local";

const repoRoot = resolve(__dirname, "../../..");

describe("auto task mode defaults", () => {
  test("uses auto as the default task mode", () => {
    expect(DEFAULT_LOCAL_SETTINGS.context.taskMode).toBe("auto");
  });

  test("exposes auto before execute and plan in the task mode menu", () => {
    const inputBox = readFileSync(
      resolve(repoRoot, "src/components/workspace/input-box.tsx"),
      "utf8",
    );

    expect(inputBox).toContain('type TaskMode = "auto" | "agent" | "plan"');
    expect(inputBox.indexOf('title="自动"')).toBeLessThan(
      inputBox.indexOf('title="执行"'),
    );
    expect(inputBox.indexOf('title="执行"')).toBeLessThan(
      inputBox.indexOf('title="规划"'),
    );
  });
});

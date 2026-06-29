import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const repoRoot = resolve(__dirname, "../../..");

describe("model profile settings", () => {
  test("keeps ordinary fields simple while preserving advanced overrides", () => {
    const settings = readFileSync(
      resolve(
        repoRoot,
        "src/components/workspace/settings/config-settings-page.tsx",
      ),
      "utf8",
    );

    expect(settings).toContain("模型名称");
    expect(settings).toContain("模型 ID");
    expect(settings).toContain("服务地址");
    expect(settings).toContain("API Key");
    expect(settings).toContain("高级配置");
    expect(settings).toContain("AdvancedModelProfileFields");
    expect(settings).toContain("normalizeNewModelProfile");
    expect(settings).not.toContain("providerModel: name");
    expect(settings).not.toContain('inputModalities: ["text"]');
    expect(settings).not.toContain('outputModalities: ["text"]');
    expect(settings).not.toContain('messageParts: ["text"]');
    expect(settings).not.toContain('<ListField label="inputModalities"');
    expect(settings).not.toContain('<ListField label="messageParts"');
    expect(settings).not.toContain('<JsonEditor label="contextCompaction"');
  });
});

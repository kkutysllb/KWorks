import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const repoRoot = resolve(__dirname, "../../..");

function read(path: string): string {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

describe("landing page copy", () => {
  test("uses KWorks branding without header Docs or GitHub links", () => {
    const header = read("src/components/landing/header.tsx");

    expect(header).toContain("KWorks");
    expect(header).not.toContain("Docs");
    expect(header).not.toContain("GitHubLogoIcon");
    expect(header).not.toContain("github.com");
  });

  test("positions QiongQi as the desktop execution engine", () => {
    const hero = read("src/components/landing/hero.tsx");
    const skills = read("src/components/landing/sections/skills-section.tsx");
    const sandbox = read("src/components/landing/sections/sandbox-section.tsx");
    const whatsNew = read("src/components/landing/sections/whats-new-section.tsx");
    const combined = [hero, skills, sandbox, whatsNew].join("\n");

    expect(combined).toContain("QiongQi");
    expect(combined).toContain("唯一执行引擎");
    expect(combined).toContain("线程事实源");
    expect(combined).toContain("流式事件");
    expect(combined).toContain("Node.js 原生运行");
  });
});

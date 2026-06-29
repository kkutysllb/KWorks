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
    const whatsNew = read(
      "src/components/landing/sections/whats-new-section.tsx",
    );
    const combined = [hero, skills, sandbox, whatsNew].join("\n");

    expect(combined).toContain("QiongQi");
    expect(combined).toContain("唯一执行引擎");
    expect(combined).toContain("线程事实源");
    expect(combined).toContain("流式事件");
    expect(combined).toContain("Node.js 原生运行");
  });

  test("uses the kinetic K background without changing hero content", () => {
    const hero = read("src/components/landing/hero.tsx");

    expect(hero).toContain("KineticKBackground");
    expect(hero).toContain("kworks-k-depth");
    expect(hero).toContain("kworks-sonar-ring");
    expect(hero).not.toContain("SolarSystem");
    expect(hero).toContain("QiongQi Native Runtime");
    expect(hero).toContain("KWorks");
    expect(hero).toContain("进入工作台");
  });

  test("expands the rebuilt engine capability cards with operational details", () => {
    const whatsNew = read("src/components/landing/sections/whats-new-section.tsx");

    expect(whatsNew).toContain("CapabilityCardContent");
    expect(whatsNew).toContain("事件链路");
    expect(whatsNew).toContain("可恢复状态机");
    expect(whatsNew).toContain("审计轨迹");
    expect(whatsNew).toContain("桌面守护进程");
    expect(whatsNew).toContain("用户态视图");
    expect(whatsNew).toContain("capability-card__metric");
    expect(whatsNew).toContain("capability-card__tag");
  });
});

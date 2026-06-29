import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const repoRoot = resolve(__dirname, "../../..");

function read(path: string): string {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

describe("settings config layout", () => {
  test("prevents Radix scroll area content wrapper from expanding layouts", () => {
    const source = read("src/components/ui/scroll-area.tsx");

    expect(source).toContain("overflow-auto");
    expect(source).toContain("[&>div]:w-full");
    expect(source).toContain("[&>div]:min-w-0");
  });

  test("keeps the settings page content column shrinkable", () => {
    const source = read(
      "src/components/workspace/settings/settings-page-shell.tsx",
    );

    expect(source).toContain(
      'className="flex h-full min-h-0 min-w-0 flex-col rounded-xl border"',
    );
    expect(source).toContain(
      'className="flex min-h-full min-w-0 flex-1 flex-col p-6"',
    );
    expect(source).toContain('className="min-h-0 min-w-0 flex-1 px-8 py-8"');
    expect(source).toContain("{!isPage && (");
    expect(source).not.toContain("SidebarTrigger");
    expect(source).not.toContain(
      'isPage ? "px-8 pb-8 md:grid-cols-[260px_minmax(0,1fr)]"',
    );
  });

  test("keeps config panels shrinkable inside the settings dialog", () => {
    const source = read(
      "src/components/workspace/settings/config-settings-page.tsx",
    );

    expect(source).toContain("flex min-h-0 min-w-0 flex-1 flex-col gap-4");
    expect(source).toContain("flex min-h-0 min-w-0 flex-1 gap-4");
    expect(source).toContain(
      'className="min-h-[420px] min-w-0 flex-1 rounded-lg border"',
    );
    expect(source).not.toContain("h-[calc(75vh-10rem)]");
  });

  test("wraps config header actions before they can push content sideways", () => {
    const source = read(
      "src/components/workspace/settings/config-settings-page.tsx",
    );

    expect(source).toContain(
      "flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between",
    );
    expect(source).toContain("min-w-0 items-center gap-2");
    expect(source).toContain('className="flex flex-wrap gap-2"');
  });

  test("wraps model config actions and truncates long model rows", () => {
    const source = read(
      "src/components/workspace/settings/config/model-config-section.tsx",
    );

    expect(source).toContain(
      "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
    );
    expect(source).toContain('className="min-w-0"');
    expect(source).toContain(
      "w-fit bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600 sm:self-auto",
    );
    expect(source).toMatch(
      /className="[^"]*group[^"]*flex[^"]*min-w-0[^"]*items-center[^"]*gap-3[^"]*"/,
    );
    expect(source).toContain("flex min-w-0 items-center gap-2");
    expect(source).toContain("min-w-0 truncate text-sm font-medium");
  });

  test("describes model protocol choices as OpenAI-compatible or Anthropic-compatible", () => {
    const source = read(
      "src/components/workspace/settings/config-settings-page.tsx",
    );

    expect(source).toContain("OpenAI 兼容协议");
    expect(source).toContain("Anthropic 兼容协议");
    expect(source).toContain("后端会按协议自动拼接");
    expect(source).toContain("GLM-5.2/GLM-5 Coding Plan");
    expect(source).not.toContain("DeepSeek/智普/MiniMax 默认");
  });

  test("skill management pages expose mode-scoped skill controls", () => {
    const skillSettings = read(
      "src/components/workspace/settings/skill-settings-page.tsx",
    );
    const skillsPage = read("src/components/workspace/skills/skills-page.tsx");
    const workModeDialog = read(
      "src/components/workspace/skills/work-mode-dialog.tsx",
    );

    for (const source of [skillSettings, skillsPage]) {
      expect(source).toContain("useWorkModes");
      expect(source).toContain("useAddSkillToWorkMode");
      expect(source).toContain("useRemoveSkillFromWorkMode");
      expect(source).toContain("selectedSkillViewId");
      expect(source).toContain("buildWorkModeSkillViews");
      expect(source).toContain("TabsTrigger value={view.id}");
      expect(source).not.toContain('TabsTrigger value="all"');
      expect(source).not.toContain('TabsTrigger value="public"');
      expect(source).not.toContain('TabsTrigger value="custom"');
      expect(source).toContain("skill.locked");
      expect(source).toContain("公共内置");
      expect(source).toContain("从当前模式移除");
      expect(source).toContain("WorkModeDialog");
      expect(source).toContain("workModeId");
    }

    expect(skillSettings).toContain("(skill.locked ?? false)");
    expect(skillSettings).toContain("|| !skill.deletable");
    expect(skillSettings).toContain("workModeId: activeWorkModeId");
    expect(skillsPage).toContain("checked={skill.enabled}");
    expect(skillsPage).toContain("removeSkillFromWorkMode");
    expect(skillsPage).toContain("workModeId: activeWorkModeId");
    expect(workModeDialog).toContain("useCreateWorkMode");
    expect(workModeDialog).toContain("useUpdateWorkMode");
    expect(workModeDialog).toContain("useDeleteWorkMode");
    expect(workModeDialog).toContain("用户级配置");
    expect(workModeDialog).toContain("系统内置");
    expect(workModeDialog).toContain("用户自定义");
    expect(workModeDialog).toContain("仅支持小写英文、数字和连字符");
    expect(workModeDialog).toContain("创建后不可修改");
    expect(workModeDialog).toContain("智能体说明");
    expect(workModeDialog).toContain("会进入当前工作模式的运行上下文");
    expect(workModeDialog).toContain("max-h-[calc(100vh-2rem)]");
    expect(workModeDialog).toContain("overflow-hidden");
    expect(workModeDialog).toContain("overflow-y-auto");
    expect(workModeDialog).toContain("h-40");
    expect(workModeDialog).toContain("resize-y");
    expect(workModeDialog).toContain("ICON_OPTIONS");
    expect(workModeDialog).toContain("aria-label={`选择图标");
    expect(workModeDialog).not.toContain(">描述</span>");
    expect(workModeDialog).not.toContain(">图标标识</span>");
  });

  test("artifact skill installation carries the current work mode id", () => {
    const detail = read(
      "src/components/workspace/artifacts/artifact-file-detail.tsx",
    );
    const list = read(
      "src/components/workspace/artifacts/artifact-file-list.tsx",
    );

    for (const source of [detail, list]) {
      expect(source).toContain("installSkill({");
      expect(source).toContain(
        "workModeId: threadContext?.thread.values.workModeId",
      );
      expect(source).toContain("useOptionalThread");
    }
  });
});

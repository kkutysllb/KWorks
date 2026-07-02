import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const desktopBuildScript = readFileSync(
  resolve(__dirname, "../../../scripts/desktop-build.mjs"),
  "utf-8",
);
const codingProjectLayout = readFileSync(
  resolve(
    __dirname,
    "../../../src/app/workspace/coding/[projectId]/layout.tsx",
  ),
  "utf-8",
);
const workspaceContentSource = readFileSync(
  resolve(__dirname, "../../../src/app/workspace/workspace-content.tsx"),
  "utf-8",
);
const desktopPathsSource = readFileSync(
  resolve(__dirname, "../../../../desktop/src/paths.ts"),
  "utf-8",
);
const desktopBackendSource = readFileSync(
  resolve(__dirname, "../../../../desktop/src/backend.ts"),
  "utf-8",
);

describe("desktop static build", () => {
  test("does not replace the home page with a login redirect", () => {
    expect(desktopBuildScript).not.toContain('file: join(APP_DIR, "page.tsx")');
    expect(desktopBuildScript).not.toContain('router.replace("/login")');
  });

  test("seeds skills into unified built-in and custom roots", () => {
    expect(desktopPathsSource).toContain("getBuiltinCoreSkillsDir");
    expect(desktopPathsSource).toContain("getBuiltinTaskSkillsDir");
    expect(desktopPathsSource).toContain("getBuiltinCodingSkillsDir");
    expect(desktopPathsSource).toContain("getCustomSharedSkillsDir");
    expect(desktopBackendSource).toContain("getBuiltinCoreSkillsDir");
    expect(desktopBackendSource).toContain("getBuiltinTaskSkillsDir");
    expect(desktopBackendSource).toContain("getBuiltinCodingSkillsDir");
    expect(desktopBackendSource).toContain("getCustomSharedSkillsDir");
    expect(desktopPathsSource).toContain(".migration-v2.json");
  });

  test("keeps coding dynamic route layout checked in instead of creating temporary route files", () => {
    expect(desktopBuildScript).not.toContain("const NEW_FILES");
    expect(desktopBuildScript).not.toContain("Creating temp file");
    expect(codingProjectLayout).toContain("generateStaticParams");
    expect(codingProjectLayout).toContain('projectId: "__init__"');
  });

  test("uses checked-in workspace content so settings provider cannot drift in desktop builds", () => {
    expect(desktopBuildScript).not.toContain(
      'file: join(APP_DIR, "workspace", "workspace-content.tsx")',
    );
    expect(workspaceContentSource).toContain(
      'import { usePathname } from "next/navigation";',
    );
    expect(workspaceContentSource).toContain("SettingsLayoutProvider");
    expect(workspaceContentSource).toContain("SettingsSidebar");
    expect(workspaceContentSource).toContain(
      'pathname === "/workspace/settings"',
    );
    expect(workspaceContentSource).toContain("<SettingsLayoutProvider syncHash>");
    expect(workspaceContentSource).toContain("<SettingsSidebar />");
  });
});

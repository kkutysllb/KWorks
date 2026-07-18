import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const repoRoot = resolve(__dirname, "../../..");

function read(path: string): string {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

describe("desktop dev restart flow", () => {
  test("config settings no longer expose backend restart controls", () => {
    const source = read(
      "src/components/workspace/settings/config-settings-page.tsx",
    );

    expect(source).toContain("saveConfigSection");
    expect(source).not.toContain("const desktop = isDesktop()");
    expect(source).not.toContain("if (desktop) {");
    expect(source).not.toContain("isDesktopBackendManagedMode");
    expect(source).not.toContain("restartBackend");
    expect(source).not.toContain("restartGateway");
    expect(source).not.toContain("waitForGateway");
    expect(source).not.toContain("应用并重启");
  });

  test("desktop initializer does not start an Electron-owned backend in desktop dev", () => {
    const source = read("src/components/desktop/desktop-init.tsx");

    expect(source).toContain("isDesktopBackendManagedMode");
    expect(source).toContain("if (isDesktopBackendManagedMode())");
  });

  test("desktop backend status UI is not exported to the renderer chrome", () => {
    const source = read("src/components/desktop/index.ts");

    expect(source).not.toContain("BackendStatusIndicator");
    expect(source).not.toContain("backend-status");
  });

  test("Next dev is only the Electron renderer host and does not proxy gateway APIs", () => {
    const source = read("next.config.js");

    expect(source).toContain("allowedDevOrigins");
    expect(source).toContain("127.0.0.1");
    expect(source).not.toContain("rewrites()");
    expect(source).not.toContain('source: "/health"');
    expect(source).not.toContain('source: "/api/:path*"');
    expect(source).not.toContain('source: "/v1/:path*"');
  });

  test("desktop startup splash has been removed from desktop providers", () => {
    const providersSource = read("src/components/desktop/providers.tsx");
    const desktopIndexSource = read("src/components/desktop/index.ts");

    expect(providersSource).toContain("DesktopInit");
    expect(providersSource).not.toContain("BackendSplashScreen");
    expect(providersSource).not.toContain("backend-splash");
    expect(desktopIndexSource).not.toContain("BackendSplashScreen");
    expect(desktopIndexSource).not.toContain("backend-splash");
  });

  test("Electron-managed backend rebuilds stale QiongQi dist before launching", () => {
    const source = read("../desktop/src/backend.ts");

    expect(source).toContain("ensureQiongqiRuntimeBuildFresh");
    expect(source).toContain("QiongQi dist stale, rebuilding");
    expect(source).toContain("packages/adapters/adapter-model");
    expect(source).toContain("packages/http-layer/http");
    expect(source).toContain("tsconfig.build.json");
  });
});

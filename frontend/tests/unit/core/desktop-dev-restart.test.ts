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

  test("desktop backend status UI is hidden when the dev launcher owns the gateway", () => {
    const source = read("src/components/desktop/backend-status.tsx");

    expect(source).toContain("isDesktopBackendManagedMode");
    expect(source).toContain("if (!isDesktopBackendManagedMode()) return null");
  });

  test("Next dev proxies gateway health checks, compat API, and native qiongqi API", () => {
    const source = read("next.config.js");

    expect(source).toContain("allowedDevOrigins");
    expect(source).toContain("127.0.0.1");
    expect(source).toContain('source: "/health"');
    expect(source).toContain('destination: `${gatewayURL}/health`');
    expect(source).toContain('source: "/api/:path*"');
    expect(source).toContain('destination: `${gatewayURL}/api/:path*`');
    expect(source).toContain('source: "/v1/:path*"');
    expect(source).toContain('destination: `${gatewayURL}/v1/:path*`');
  });

  test("desktop backend splash does not poll unmanaged desktop dev backend status", () => {
    const source = read("src/components/desktop/backend-splash.tsx");

    expect(source).toContain("isDesktopBackendManagedMode");
    expect(source).toContain("if (!isDesktopBackendManagedMode()) return");
    expect(source).toContain("const isManaged = isDesktopBackendManagedMode()");
    expect(source).toContain('if (!isManaged || phase === "hidden") return null');
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

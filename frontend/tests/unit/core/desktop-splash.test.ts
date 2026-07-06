import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import { shouldShowBackendSplash } from "@/components/desktop/backend-splash";

const repoRoot = resolve(__dirname, "../../..");

describe("desktop backend splash visibility", () => {
  test("only shows while the desktop backend is explicitly starting", () => {
    expect(shouldShowBackendSplash(null, true)).toBe(true);
    expect(
      shouldShowBackendSplash({ status: "stopped", port: 19987 }, true),
    ).toBe(true);
    expect(
      shouldShowBackendSplash({ status: "running", port: 19987 }, true),
    ).toBe(false);
    expect(
      shouldShowBackendSplash({ status: "error", port: 19987 }, true),
    ).toBe(true);
    expect(
      shouldShowBackendSplash({ status: "starting", port: 19987 }, true),
    ).toBe(true);
    expect(
      shouldShowBackendSplash({ status: "starting", port: 19987 }, false),
    ).toBe(false);
  });

  test("desktop providers mount backend startup helpers in packaged desktop", () => {
    const source = readFileSync(
      resolve(repoRoot, "src/components/desktop/providers.tsx"),
      "utf8",
    );

    expect(source).toContain("DesktopInit");
    expect(source).toContain("BackendSplashScreen");
    expect(source).toContain("<DesktopInit />");
    expect(source).toContain("<BackendSplashScreen />");
  });
});

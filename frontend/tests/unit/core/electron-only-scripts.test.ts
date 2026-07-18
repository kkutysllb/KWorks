import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const frontendPackageJson = JSON.parse(
  readFileSync(resolve(__dirname, "../../../package.json"), "utf8"),
) as { scripts: Record<string, string> };
const nextConfig = readFileSync(
  resolve(__dirname, "../../../next.config.js"),
  "utf8",
);
const desktopBuildScript = readFileSync(
  resolve(__dirname, "../../../scripts/desktop-build.mjs"),
  "utf8",
);
const envSchema = readFileSync(resolve(__dirname, "../../../src/env.js"), "utf8");
const frontendPackageJsonSource = readFileSync(
  resolve(__dirname, "../../../package.json"),
  "utf8",
);

describe("frontend package scripts", () => {
  test("blocks standalone web entrypoints in Electron-only mode", () => {
    expect(frontendPackageJson.scripts.dev).toContain("desktop-only-entrypoint");
    expect(frontendPackageJson.scripts["dev:fresh"]).toContain(
      "desktop-only-entrypoint",
    );
    expect(frontendPackageJson.scripts.start).toContain(
      "desktop-only-entrypoint",
    );
    expect(frontendPackageJson.scripts.preview).toContain(
      "desktop-only-entrypoint",
    );
    expect(frontendPackageJson.scripts.build).toContain(
      "desktop-only-entrypoint",
    );
    expect(frontendPackageJson.scripts["test:e2e"]).toContain(
      "desktop-only-entrypoint",
    );
  });

  test("keeps the desktop static-export build entrypoint available", () => {
    expect(frontendPackageJson.scripts["build:desktop"]).toBe(
      "node scripts/desktop-build.mjs",
    );
  });

  test("does not configure standalone web rewrites or docs wrapping", () => {
    expect(nextConfig).not.toContain("rewrites()");
    expect(nextConfig).not.toContain("i18n:");
    expect(nextConfig).not.toContain("nextra");
  });

  test("does not keep standalone web runtime configs", () => {
    expect(existsSync(resolve(__dirname, "../../../Dockerfile"))).toBe(false);
    expect(existsSync(resolve(__dirname, "../../../Makefile"))).toBe(false);
    expect(existsSync(resolve(__dirname, "../../../playwright.config.ts"))).toBe(
      false,
    );
    expect(existsSync(resolve(__dirname, "../../../src/content"))).toBe(false);
    expect(existsSync(resolve(__dirname, "../../../src/mdx-components.ts"))).toBe(
      false,
    );
  });

  test("does not bake web backend URLs into the desktop static export", () => {
    expect(desktopBuildScript).not.toContain("NEXT_PUBLIC_BACKEND_BASE_URL");
    expect(desktopBuildScript).not.toContain("NEXT_PUBLIC_RUNTIME_API_BASE_URL");
    expect(envSchema).not.toContain("NEXT_PUBLIC_BACKEND_BASE_URL");
    expect(envSchema).not.toContain("NEXT_PUBLIC_RUNTIME_API_BASE_URL");
    expect(envSchema).not.toContain("NEXT_PUBLIC_STATIC_WEBSITE_ONLY");
    expect(frontendPackageJsonSource).not.toContain("nextra");
    expect(frontendPackageJsonSource).not.toContain("nuxt-og-image");
    expect(frontendPackageJsonSource).not.toContain("@playwright/test");
  });
});

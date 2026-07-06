import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const repoRoot = resolve(__dirname, "../../..");

describe("gateway unavailable desktop logout", () => {
  test("clears the desktop session token before returning home", () => {
    const source = readFileSync(
      resolve(repoRoot, "src/app/workspace/gateway-unavailable.tsx"),
      "utf8",
    );

    expect(source).toContain("clearDesktopSessionToken");
    expect(source).toContain('import { fetch } from "@/core/api/fetcher";');
  });

  test("retries the workspace guard when the managed desktop backend becomes ready", () => {
    const source = readFileSync(
      resolve(repoRoot, "src/app/workspace/gateway-unavailable.tsx"),
      "utf8",
    );

    expect(source).toContain("isDesktopBackendManagedMode");
    expect(source).toContain("getBackendStatus");
    expect(source).toContain('status?.status === "running"');
    expect(source).toContain("GATEWAY_UNAVAILABLE_AUTO_RELOAD_KEY");
    expect(source).toContain("window.sessionStorage.getItem");
    expect(source).toContain("window.sessionStorage.setItem");
    expect(source).toContain("window.location.reload()");
    expect(source).toContain("setInterval");
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const repoRoot = resolve(__dirname, "../../..");

describe("desktop backend splash visibility", () => {
  test("desktop providers initialize the backend without mounting the blocking startup splash", () => {
    const source = readFileSync(
      resolve(repoRoot, "src/components/desktop/providers.tsx"),
      "utf8",
    );

    expect(source).toContain("DesktopInit");
    expect(source).toContain("<DesktopInit />");
    expect(source).not.toContain("BackendSplashScreen");
    expect(source).not.toContain("backend-splash");
  });
});

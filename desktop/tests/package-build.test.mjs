import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const verifierUrl = new URL("../scripts/verify-package-resources.mjs", import.meta.url);

test("packaged app build verifies the embedded Node QiongQi runtime", () => {
  assert.doesNotMatch(packageJson.scripts["build:app"], /build:gateway/);
  assert.match(packageJson.scripts["build:app"], /pnpm run verify:package-resources/);
  assert.match(packageJson.scripts["build:app:full"], /pnpm run build:app/);
});

test("package resource verifier rejects stale or incomplete Node QiongQi bundles", () => {
  assert.equal(existsSync(verifierUrl), true);
  const verifierSource = readFileSync(verifierUrl, "utf8");
  assert.match(verifierSource, /resources\/qiongqi/);
  assert.match(verifierSource, /frontend\/out/);
  assert.match(verifierSource, /backend-build", "config\.embedded\.yaml/);
  assert.match(verifierSource, /join\(SKILLS_DIR, "public"\)/);
  assert.match(verifierSource, /serve-entry\.js/);
  assert.match(verifierSource, /node_modules/);
  assert.doesNotMatch(verifierSource, /resources\/gateway/);
  assert.doesNotMatch(verifierSource, /local_skill_storage\.py/);
});

test("packaged app ships small tray icons separately from the app icon", () => {
  const builderConfig = readFileSync(
    new URL("../electron-builder.yml", import.meta.url),
    "utf8",
  );
  assert.match(builderConfig, /from: build\/icons/);
  assert.match(builderConfig, /to: icons/);
  assert.match(builderConfig, /16x16\.png/);
  assert.match(builderConfig, /32x32\.png/);
});

test("packaged app ships the vendored qiongqi runtime source", () => {
  const builderConfig = readFileSync(
    new URL("../electron-builder.yml", import.meta.url),
    "utf8",
  );
  assert.match(builderConfig, /from: \.\.\/third_party\/qiongqi/);
  assert.match(builderConfig, /to: qiongqi/);
});

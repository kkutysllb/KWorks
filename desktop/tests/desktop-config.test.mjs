import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const backendSource = readFileSync(
  new URL("../src/backend.ts", import.meta.url),
  "utf8",
);
const pathsSource = readFileSync(new URL("../src/paths.ts", import.meta.url), "utf8");
const builderSource = readFileSync(new URL("../electron-builder.yml", import.meta.url), "utf8");
const verifyResourcesSource = readFileSync(
  new URL("../scripts/verify-package-resources.mjs", import.meta.url),
  "utf8",
);

test("desktop backend does not initialize or migrate legacy yaml config", () => {
  assert.doesNotMatch(backendSource, /initConfig\(\)/);
  assert.doesNotMatch(backendSource, /migrateConfig\(\)/);
  assert.doesNotMatch(backendSource, /migrateDesktopConfigYaml/);
  assert.doesNotMatch(backendSource, /config\.embedded\.yaml/);
  assert.doesNotMatch(backendSource, /KWorks_CONFIG_PATH/);
  assert.doesNotMatch(backendSource, /getDesktopConfigPath\(\)/);
});

test("desktop paths use the KWorks workspace root instead of old kkworks yaml home", () => {
  assert.match(pathsSource, /\.kworks-workspace/);
  assert.doesNotMatch(pathsSource, /\.kkworks-desktop/);
  assert.doesNotMatch(pathsSource, /getDesktopConfigPath/);
  assert.doesNotMatch(pathsSource, /getBundledConfigTemplatePath/);
});

test("desktop backend uses an isolated extensions config instead of repo MCP config", () => {
  assert.match(backendSource, /KWorks_EXTENSIONS_CONFIG_PATH/);
  assert.match(backendSource, /getDesktopExtensionsConfigPath\(\)/);
  assert.match(backendSource, /initExtensionsConfig\(\)/);
});

test("desktop backend injects the bundled qiongqi runtime path", () => {
  assert.match(backendSource, /getQiongqiRuntimeDir/);
  assert.match(backendSource, /KWorks_QIONGQI_REPO_PATH/);
});

test("desktop backend starts the Node QiongQi gateway instead of Python", () => {
  assert.match(backendSource, /serve-entry\.js/);
  assert.match(backendSource, /process\.execPath/);
  assert.match(backendSource, /"serve"/);
  assert.doesNotMatch(backendSource, /uvicorn/);
  assert.doesNotMatch(backendSource, /PYTHONUNBUFFERED/);
  assert.doesNotMatch(backendSource, /Python runtime/);
  assert.doesNotMatch(backendSource, /PyInstaller/);
  assert.doesNotMatch(backendSource, /langgraph\.log/);
});

test("desktop backend only marks QiongQi running after compatibility routes are ready", () => {
  assert.match(backendSource, /checkGatewayReady\(port\)/);
  assert.match(backendSource, /\/api\/crons/);
  assert.match(backendSource, /compatibility route \/api\/crons returned 404/);
  assert.match(backendSource, /gateway readiness check passed/);
});

test("desktop backend writes only QiongQi bootstrap config", () => {
  assert.match(backendSource, /resolveQiongqiLaunchConfig/);
  assert.match(backendSource, /qiongqiConfigFromLaunchConfig/);
  assert.match(backendSource, /qiongqiLaunchConfig/);
  assert.match(backendSource, /"--config"/);
  assert.match(backendSource, /QIONGQI_API_KEY: qiongqiLaunchConfig\.apiKey/);
  assert.match(backendSource, /QIONGQI_BASE_URL: qiongqiLaunchConfig\.baseUrl/);
  assert.match(backendSource, /QIONGQI_MODEL: qiongqiLaunchConfig\.model/);
  assert.doesNotMatch(backendSource, /desktopConfigPath/);
});

test("desktop backend defaults QiongQi storage to file unless hybrid is explicit", () => {
  assert.match(backendSource, /qiongqiStorageBackend/);
  assert.doesNotMatch(backendSource, /QIONGQI_STORAGE_BACKEND: "hybrid"/);
  assert.doesNotMatch(backendSource, /"--storage-backend",\s*"hybrid"/);
});

test("desktop seeds public skills and allows user-created custom skills", () => {
  // Still seed bundled public skills so first run has a non-empty skill set.
  assert.match(backendSource, /publicTarget/);
  // Create an empty custom/ dir so users can author their own skills at
  // runtime (web-to-desktop migration also depends on this).
  assert.match(backendSource, /mkdirSync\(join\(skillsRoot,\s*"custom"\)/);
  // Intentionally do NOT set KWorks_PUBLIC_SKILLS_ONLY at runtime — that
  // flag was for bundling-time, not for forbidding user-created skills.
  assert.doesNotMatch(backendSource, /KWorks_PUBLIC_SKILLS_ONLY:\s*"1"/);
});

test("desktop packaging no longer ships the obsolete embedded yaml config", () => {
  assert.doesNotMatch(builderSource, /config\.embedded\.yaml/);
  assert.doesNotMatch(verifyResourcesSource, /config\.embedded\.yaml/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const devLauncherSource = readFileSync(
  new URL("../scripts/dev.mjs", import.meta.url),
  "utf8",
);

test("desktop dev launcher owns and respawns the gateway process", () => {
  assert.match(devLauncherSource, /let gatewayProcess = null/);
  assert.match(devLauncherSource, /function scheduleGatewayRestart\(\)/);
  assert.match(devLauncherSource, /gatewayRestartTimer = setTimeout/);
  assert.match(devLauncherSource, /scheduleGatewayRestart\(\)/);
});

test("desktop dev launcher clears stale QiongQi listeners before spawning the gateway", () => {
  assert.match(devLauncherSource, /async function clearStaleGatewayListeners\(port\)/);
  assert.match(devLauncherSource, /function findGatewayListenerPids\(port\)/);
  assert.match(devLauncherSource, /lsof/);
  assert.match(devLauncherSource, /-tiTCP:\$\{port\}/);
  assert.match(devLauncherSource, /assertExistingGatewayIsQiongQi\(port\)/);
  assert.match(devLauncherSource, /process\.kill\(pid, signal\)/);
  assert.match(devLauncherSource, /await clearStaleGatewayListeners\(GATEWAY_PORT\)/);
});

test("desktop dev launcher clears stale Next listeners and frontend build artifacts", () => {
  assert.match(devLauncherSource, /async function clearStaleFrontendListeners\(port\)/);
  assert.match(devLauncherSource, /function clearFrontendBuildArtifacts\(\)/);
  assert.match(devLauncherSource, /join\(FRONTEND_DIR, "\.next"\)/);
  assert.match(devLauncherSource, /join\(FRONTEND_DIR, "out"\)/);
  assert.match(devLauncherSource, /await clearStaleFrontendListeners\(DEV_SERVER_PORT\)/);
  assert.match(devLauncherSource, /clearFrontendBuildArtifacts\(\)/);
  assert.match(devLauncherSource, /startFrontend\(\)/);
});

test("desktop dev launcher verifies compatibility routes after gateway startup", () => {
  assert.match(devLauncherSource, /async function waitForGatewayReady\(port\)/);
  assert.match(devLauncherSource, /GATEWAY_READY_TIMEOUT_MS/);
  assert.match(devLauncherSource, /\/api\/crons/);
  assert.match(devLauncherSource, /\/api\/usage\?group_by=model/);
  assert.match(devLauncherSource, /compatibility route \/api\/crons returned 404/);
  assert.match(devLauncherSource, /compatibility route \/api\/usage returned 404/);
  assert.match(devLauncherSource, /await waitForGatewayReady\(GATEWAY_PORT\)/);
});

test("desktop dev launcher marks backend as dev-managed for the gateway", () => {
  assert.match(devLauncherSource, /KWorks_DESKTOP_DEV: "1"/);
});

test("desktop dev launcher starts the Node QiongQi gateway instead of Python uvicorn", () => {
  assert.match(devLauncherSource, /serve-entry\.js/);
  assert.match(devLauncherSource, /process\.execPath/);
  assert.match(devLauncherSource, /"serve"/);
  assert.doesNotMatch(devLauncherSource, /uvicorn/);
  assert.doesNotMatch(devLauncherSource, /start\("uv"/);
});

test("desktop dev launcher does not ask Electron BackendManager to spawn another gateway", () => {
  assert.match(devLauncherSource, /KWORKS_SKIP_BACKEND_AUTOLAUNCH: "1"/);
});

test("desktop dev launcher forces Next rewrites instead of public backend URLs", () => {
  assert.match(devLauncherSource, /NEXT_PUBLIC_BACKEND_BASE_URL: ""/);
  assert.match(devLauncherSource, /NEXT_PUBLIC_RUNTIME_API_BASE_URL: ""/);
});

test("desktop dev frontend binds to localhost instead of all interfaces", () => {
  assert.match(devLauncherSource, /"next", "dev", "--hostname", "127\.0\.0\.1", "--port", DEV_SERVER_PORT/);
});

test("desktop dev launcher waits for the frontend before opening Electron", () => {
  assert.match(devLauncherSource, /async function waitForFrontendReady\(\)/);
  assert.match(devLauncherSource, /frontendReadyPromise/);
  assert.match(devLauncherSource, /Ready in/);
  assert.match(devLauncherSource, /await waitForFrontendReady\(\)/);
  assert.doesNotMatch(devLauncherSource, /fetch\(DEV_SERVER_URL/);
  assert.doesNotMatch(devLauncherSource, /setTimeout\(startElectron, 4000\)/);
});

test("desktop dev gateway CORS includes Electron's Next dev origins", () => {
  assert.match(devLauncherSource, /DESKTOP_DEV_ORIGINS/);
  assert.match(devLauncherSource, /http:\/\/127\.0\.0\.1:\$\{DEV_SERVER_PORT\}/);
  assert.match(devLauncherSource, /http:\/\/localhost:\$\{DEV_SERVER_PORT\}/);
  assert.match(devLauncherSource, /GATEWAY_CORS_ORIGINS: DESKTOP_DEV_ORIGINS/);
});

test("desktop dev launcher uses isolated public skills instead of repo custom skills", () => {
  assert.match(devLauncherSource, /syncDesktopPublicSkills/);
  assert.match(devLauncherSource, /const skillsPath = kkworksHome \? join\(kkworksHome, "skills"\) : undefined/);
  assert.match(devLauncherSource, /customTarget/);
  assert.match(devLauncherSource, /builtinCoreTarget/);
  assert.match(devLauncherSource, /builtinCodingTarget/);
  assert.match(devLauncherSource, /join\(QIONGQI_DIR, "skills"\)/);
  assert.match(devLauncherSource, /\["goal", "todo", "web"\]\.includes\(name\)/);
  assert.doesNotMatch(devLauncherSource, /const skillsPath = join\(REPO_ROOT, "skills"\)/);
});

test("desktop dev launcher uses isolated empty extensions config", () => {
  assert.match(devLauncherSource, /initDesktopExtensionsConfig/);
  assert.match(devLauncherSource, /KWorks_EXTENSIONS_CONFIG_PATH/);
  assert.match(devLauncherSource, /extensions_config\.json/);
  assert.doesNotMatch(devLauncherSource, /KWorks_CONFIG_PATH/);
});

test("desktop dev launcher prepares vendored qiongqi before starting gateway", () => {
  assert.match(devLauncherSource, /const QIONGQI_DIR = resolve\(REPO_ROOT, "qiongqi"\)/);
  assert.match(devLauncherSource, /function ensureVendoredQiongqiRuntime\(\)/);
  assert.match(devLauncherSource, /packages", "cli-layer", "cli", "src", "serve-entry\.ts"/);
  assert.match(devLauncherSource, /packages", "cli-layer", "cli", "dist", "serve-entry\.js"/);
  assert.match(devLauncherSource, /isVendoredQiongqiSourceNewerThanBuild/);
  assert.match(devLauncherSource, /statSync\(builtServeEntry\)\.mtimeMs/);
  assert.match(devLauncherSource, /pnpm install --silent && pnpm run build/);
  assert.match(devLauncherSource, /"run", "build"/);
  assert.match(devLauncherSource, /const qiongqiInstall = ensureVendoredQiongqiRuntime\(\)/);
  assert.match(devLauncherSource, /await new Promise/);
  assert.match(devLauncherSource, /startGateway\(\)/);
});

test("desktop dev launcher writes only QiongQi bootstrap config", () => {
  assert.match(devLauncherSource, /resolveQiongqiLaunchConfig/);
  assert.match(devLauncherSource, /qiongqiConfigFromLaunchConfig/);
  assert.match(devLauncherSource, /qiongqiLaunchConfig/);
  assert.match(devLauncherSource, /"--config"/);
  assert.match(devLauncherSource, /QIONGQI_API_KEY: qiongqiLaunchConfig\.apiKey/);
  assert.match(devLauncherSource, /QIONGQI_BASE_URL: qiongqiLaunchConfig\.baseUrl/);
  assert.match(devLauncherSource, /QIONGQI_MODEL: qiongqiLaunchConfig\.model/);
  assert.doesNotMatch(devLauncherSource, /QIONGQI_API_KEY: process\.env\.QIONGQI_API_KEY \?\? process\.env\.DEEPSEEK_API_KEY \?\? ""/);
  assert.doesNotMatch(devLauncherSource, /desktopConfigPath/);
});

test("desktop dev launcher defaults QiongQi storage to file to avoid sqlite native fallback noise", () => {
  assert.match(devLauncherSource, /qiongqiStorageBackend/);
  assert.doesNotMatch(devLauncherSource, /QIONGQI_STORAGE_BACKEND: "hybrid"/);
  assert.doesNotMatch(devLauncherSource, /"--storage-backend",\s*"hybrid"/);
});

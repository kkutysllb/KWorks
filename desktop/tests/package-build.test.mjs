import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const verifierUrl = new URL("../scripts/verify-package-resources.mjs", import.meta.url);
const prepareResourcesSource = readFileSync(
  new URL("../scripts/prepare-package-resources.mjs", import.meta.url),
  "utf8",
);
const releaseWorkflowSource = readFileSync(
  new URL("../../.github/workflows/release.yml", import.meta.url),
  "utf8",
);

test("packaged app build verifies the embedded Node QiongQi runtime", () => {
  assert.doesNotMatch(packageJson.scripts["build:app"], /build:gateway/);
  assert.match(packageJson.scripts.build, /node scripts\/rename-preload\.mjs/);
  assert.doesNotMatch(packageJson.scripts.build, /\bmv\s+-f\b/);
  assert.match(packageJson.scripts["build:app"], /pnpm run prepare:package-resources/);
  assert.match(packageJson.scripts["build:app"], /pnpm run verify:package-resources/);
  assert.match(packageJson.scripts["build:app:full"], /pnpm run build:app/);
});

test("package resource verifier rejects stale or incomplete Node QiongQi bundles", () => {
  assert.equal(existsSync(verifierUrl), true);
  const verifierSource = readFileSync(verifierUrl, "utf8");
  assert.match(verifierSource, /qiongqi-runtime\.tar\.gz/);
  assert.match(verifierSource, /frontend\/out/);
  assert.match(verifierSource, /join\(REPO_ROOT, "qiongqi"\)/);
  assert.match(verifierSource, /join\(SKILLS_DIR, "public"\)/);
  assert.match(verifierSource, /serve-entry\.js/);
  assert.match(verifierSource, /node_modules/);
  assert.doesNotMatch(verifierSource, /resources\/gateway/);
  assert.doesNotMatch(verifierSource, /local_skill_storage\.py/);
});

test("package resource preparation rebuilds and verifies every QiongQi package dist", () => {
  assert.match(prepareResourcesSource, /scripts", "build\.mjs"/);
  assert.match(prepareResourcesSource, /PACKAGE_DIST_INDEXES/);
  assert.match(prepareResourcesSource, /packages\/domain-layer\/domain\/dist\/index\.js/);
  assert.match(prepareResourcesSource, /packages\/cli-layer\/cli\/dist\/index\.js/);
});

test("package resource preparation does not pass a Windows drive path to tar", () => {
  assert.match(prepareResourcesSource, /RUNTIME_ARCHIVE_RELATIVE/);
  assert.doesNotMatch(prepareResourcesSource, /"-czf",\s*\n\s*RUNTIME_ARCHIVE,/);
  assert.match(prepareResourcesSource, /cwd:\s*DESKTOP_DIR/);
});

test("QiongQi runtime is generated from production deploy output", () => {
  assert.match(prepareResourcesSource, /resolvePnpmCommand/);
  assert.match(prepareResourcesSource, /npm_execpath/);
  assert.match(prepareResourcesSource, /--config\.node-linker=hoisted/);
  assert.match(prepareResourcesSource, /@qiongqi\/cli/);
  assert.match(prepareResourcesSource, /deploy/);
  assert.match(prepareResourcesSource, /--legacy/);
  assert.match(prepareResourcesSource, /--prod/);
  assert.match(prepareResourcesSource, /RUNTIME_STAGING_QIONGQI_DIR/);
  assert.doesNotMatch(prepareResourcesSource, /archive skipped for this platform/);
  assert.doesNotMatch(prepareResourcesSource, /"-C",\s*\n\s*REPO_ROOT,\s*\n\s*"qiongqi"/);
});

test("QiongQi native runtime modules are rebuilt for Electron before packaging", () => {
  assert.match(prepareResourcesSource, /@electron\/rebuild/);
  assert.match(prepareResourcesSource, /rebuildQiongqiRuntimeForElectron/);
  assert.match(prepareResourcesSource, /RUNTIME_STAGING_QIONGQI_DIR/);
  assert.match(prepareResourcesSource, /electronVersion/);
  assert.match(prepareResourcesSource, /buildPath:\s*RUNTIME_STAGING_QIONGQI_DIR/);
});

test("macOS QiongQi archive signs native runtime binaries before archiving", () => {
  assert.match(prepareResourcesSource, /codesign/);
  assert.match(prepareResourcesSource, /--options/);
  assert.match(prepareResourcesSource, /runtime/);
  assert.match(prepareResourcesSource, /--timestamp/);
  assert.match(prepareResourcesSource, /findMacNativeBinaries/);
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

test("packaged app ships the production QiongQi runtime per platform", () => {
  const builderConfig = readFileSync(
    new URL("../electron-builder.yml", import.meta.url),
    "utf8",
  );
  assert.match(builderConfig, /artifactName:\s*"\$\{productName\}-\$\{version\}-\$\{os\}-\$\{arch\}\.\$\{ext\}"/);
  assert.match(
    builderConfig,
    /mac:[\s\S]*extraResources:[\s\S]*from: build\/qiongqi-runtime\.tar\.gz[\s\S]*to: qiongqi-runtime\.tar\.gz/,
  );
  assert.match(
    builderConfig,
    /win:[\s\S]*extraResources:[\s\S]*from: build\/qiongqi-runtime\/qiongqi[\s\S]*to: qiongqi/,
  );
  assert.match(
    builderConfig,
    /linux:[\s\S]*extraResources:[\s\S]*from: build\/qiongqi-runtime\/qiongqi[\s\S]*to: qiongqi/,
  );
});

test("release workflow prepares packaged resources before electron-builder", () => {
  const prepareIndex = releaseWorkflowSource.indexOf("pnpm run prepare:package-resources");
  const verifyIndex = releaseWorkflowSource.indexOf("pnpm run verify:package-resources");
  const builderIndex = releaseWorkflowSource.indexOf("electron-builder@26.8.1");

  assert.notEqual(prepareIndex, -1);
  assert.notEqual(verifyIndex, -1);
  assert.notEqual(builderIndex, -1);
  assert.equal(prepareIndex < verifyIndex, true);
  assert.equal(verifyIndex < builderIndex, true);
});

test("release workflow builds macOS, Windows, and Linux artifacts", () => {
  assert.match(releaseWorkflowSource, /os: macos-15/);
  assert.match(releaseWorkflowSource, /os: macos-15-intel/);
  assert.match(releaseWorkflowSource, /os: windows-2022/);
  assert.match(releaseWorkflowSource, /artifact_suffix: win/);
  assert.match(releaseWorkflowSource, /platform: mac/);
  assert.match(releaseWorkflowSource, /os: ubuntu-22\.04/);
  assert.match(releaseWorkflowSource, /platform: linux/);
});

test("release workflow publishes once after all platform builds are uploaded", () => {
  assert.doesNotMatch(releaseWorkflowSource, /--publish always/);
  assert.match(releaseWorkflowSource, /--publish never/);
  assert.match(releaseWorkflowSource, /release:[\s\S]*needs: build/);
  assert.match(releaseWorkflowSource, /actions\/download-artifact@v4/);
  assert.match(releaseWorkflowSource, /softprops\/action-gh-release@v2/);
  assert.match(releaseWorkflowSource, /files:\s+release-assets\/\*/);
});

test("release workflow uploads Windows installer artifacts and regenerates mac update metadata", () => {
  assert.match(releaseWorkflowSource, /desktop\/release\/\*\.exe/);
  assert.match(releaseWorkflowSource, /desktop\/release\/\*\.exe\.blockmap/);
  assert.match(releaseWorkflowSource, /desktop\/scripts\/generate-mac-latest\.mjs release-assets/);
});

test("release workflow keeps Windows electron-builder packaging observable", () => {
  assert.match(releaseWorkflowSource, /name: Build desktop shell/);
  assert.match(releaseWorkflowSource, /name: Prepare package resources/);
  assert.match(releaseWorkflowSource, /name: Verify package resources/);
  assert.match(releaseWorkflowSource, /name: Build Electron package/);
  assert.match(releaseWorkflowSource, /DEBUG:\s+\$\{\{ runner\.os == 'Windows'/);
  assert.match(releaseWorkflowSource, /electron-builder,electron-builder:\*/);
  assert.match(releaseWorkflowSource, /timeout-minutes:\s+45/);
  assert.match(releaseWorkflowSource, /electron-builder@26\.8\.1/);
});

test("release workflow avoids mutating managed macOS Python for distutils", () => {
  assert.match(releaseWorkflowSource, /python-distutils/);
  assert.match(releaseWorkflowSource, /npm_config_python/);
  assert.match(releaseWorkflowSource, /--break-system-packages/);
});

test("QiongQi package builds invoke TypeScript directly instead of pnpm shims", () => {
  const buildSource = readFileSync(
    new URL("../../qiongqi/scripts/build.mjs", import.meta.url),
    "utf8",
  );
  assert.match(buildSource, /createRequire/);
  assert.match(buildSource, /typescript\/bin\/tsc/);
  assert.match(buildSource, /process\.execPath/);
  assert.doesNotMatch(buildSource, /pnpm run build/);
  assert.doesNotMatch(buildSource, /execSync/);
});

test("package resource verifier checks the macOS archive only when required", () => {
  const verifierSource = readFileSync(verifierUrl, "utf8");
  assert.match(verifierSource, /requiresQiongqiRuntimeArchive/);
  assert.match(verifierSource, /KWORKS_REQUIRE_QIONGQI_ARCHIVE/);
  assert.match(verifierSource, /resources\/qiongqi deployed serve entry/);
  assert.match(verifierSource, /qiongqi\/dist\/serve-entry\.js/);
  assert.match(verifierSource, /verifyQiongqiRuntimeImport/);
  assert.match(verifierSource, /@qiongqi\/http/);
  assert.match(verifierSource, /isSymbolicLink/);
  assert.match(verifierSource, /@esbuild|esbuild\/bin\/esbuild|@rollup/);
  assert.match(verifierSource, /maxBuffer/);
});

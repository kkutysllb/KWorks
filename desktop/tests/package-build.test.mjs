import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const verifierUrl = new URL("../scripts/verify-package-resources.mjs", import.meta.url);
const builtVerifierPath = fileURLToPath(
  new URL("../scripts/verify-built-package-resources.mjs", import.meta.url),
);
const codesignRetryPath = fileURLToPath(
  new URL("../scripts/codesign-retry.mjs", import.meta.url),
);
const prepareResourcesSource = readFileSync(
  new URL("../scripts/prepare-package-resources.mjs", import.meta.url),
  "utf8",
);
const releaseWorkflowSource = readFileSync(
  new URL("../../.github/workflows/release.yml", import.meta.url),
  "utf8",
);

function topLevelYamlSection(source, sectionName) {
  const match = source.match(new RegExp(`^${sectionName}:\\n(?:^[ \\t].*\\n?)*`, "m"));
  return match?.[0] ?? "";
}

function functionBlock(source, functionName) {
  const start = source.indexOf(`function ${functionName}(`);
  if (start === -1) return "";
  const next = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

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

test("release workflow retries transient macOS codesign timestamp failures", () => {
  const retryScript = readFileSync(
    new URL("../scripts/codesign-retry.mjs", import.meta.url),
    "utf8",
  );
  assert.match(releaseWorkflowSource, /name: Install macOS codesign retry wrapper/);
  assert.match(releaseWorkflowSource, /kworks-codesign-bin/);
  assert.match(releaseWorkflowSource, /\$GITHUB_PATH/);
  assert.match(retryScript, /\/usr\/bin\/codesign/);
  assert.match(retryScript, /A timestamp was expected but was not found/);
  assert.match(retryScript, /timestamp authority/i);
  assert.match(retryScript, /maxAttempts\s*=\s*3/);
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
  const topLevelExtraResources = topLevelYamlSection(builderConfig, "extraResources");
  assert.match(builderConfig, /artifactName:\s*"\$\{productName\}-\$\{version\}-\$\{os\}-\$\{arch\}\.\$\{ext\}"/);
  assert.match(
    topLevelExtraResources,
    /from: build\/qiongqi-runtime\.tar\.gz[\s\S]*to: qiongqi-runtime\.tar\.gz/,
  );
  assert.doesNotMatch(builderConfig, /from: build\/qiongqi-runtime\/qiongqi/);
  assert.doesNotMatch(builderConfig, /^\s*to: qiongqi\s*$/m);
});

test("release workflow prepares packaged resources before electron-builder", () => {
  const prepareIndex = releaseWorkflowSource.indexOf("pnpm run prepare:package-resources");
  const verifyIndex = releaseWorkflowSource.indexOf("pnpm run verify:package-resources");
  const builderIndex = releaseWorkflowSource.indexOf("pnpm exec electron-builder");

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
  assert.match(releaseWorkflowSource, /name: Verify packaged Electron resources/);
  assert.match(releaseWorkflowSource, /DEBUG:\s+\$\{\{ runner\.os == 'Windows'/);
  assert.match(releaseWorkflowSource, /electron-builder,electron-builder:\*/);
  assert.match(releaseWorkflowSource, /timeout-minutes:\s+45/);
  assert.match(releaseWorkflowSource, /pnpm exec electron-builder/);
  assert.doesNotMatch(releaseWorkflowSource, /electron-builder@26\.8\.1/);
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

test("package resource verifier checks the QiongQi archive when required", () => {
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

test("package resource verifier checks required QiongQi packages inside the archive", () => {
  const verifierSource = readFileSync(verifierUrl, "utf8");
  assert.match(verifierSource, /qiongqi\/node_modules\/\$\{packageName\}\/package\.json/);
});

test("package resource preparation creates the QiongQi archive on every packaged platform", () => {
  const prepareArchiveFunction = functionBlock(
    prepareResourcesSource,
    "shouldPrepareQiongqiArchive",
  );
  assert.match(
    prepareArchiveFunction,
    /function shouldPrepareQiongqiArchive\(\) {\s*return envFlag\("KWORKS_PREPARE_QIONGQI_ARCHIVE"\) \?\? true;\s*}/,
  );
  assert.doesNotMatch(
    prepareArchiveFunction,
    /process\.platform === "darwin"/,
  );
});

test("package resource verifier requires the QiongQi archive on every packaged platform", () => {
  const verifierSource = readFileSync(verifierUrl, "utf8");
  const requireArchiveFunction = functionBlock(
    verifierSource,
    "requiresQiongqiRuntimeArchive",
  );
  assert.match(
    requireArchiveFunction,
    /function requiresQiongqiRuntimeArchive\(\) {\s*return envFlag\("KWORKS_REQUIRE_QIONGQI_ARCHIVE"\) \?\? true;\s*}/,
  );
});

test("release workflow verifies the final unpacked resources after electron-builder", () => {
  const buildIndex = releaseWorkflowSource.indexOf("name: Build Electron package");
  const verifyBuiltIndex = releaseWorkflowSource.indexOf("name: Verify packaged Electron resources");
  const uploadIndex = releaseWorkflowSource.indexOf("name: Upload build artifacts");

  assert.notEqual(buildIndex, -1);
  assert.notEqual(verifyBuiltIndex, -1);
  assert.notEqual(uploadIndex, -1);
  assert.equal(buildIndex < verifyBuiltIndex, true);
  assert.equal(verifyBuiltIndex < uploadIndex, true);
  assert.match(releaseWorkflowSource, /pnpm run verify:built-package-resources/);
});

test("built package verifier lists runtime archive from the resources directory", () => {
  const tmpRoot = mkdtempSync(join(tmpdir(), "kworks-built-package-verify-"));
  try {
    const resourcesDir = join(tmpRoot, "Resources");
    mkdirSync(join(resourcesDir, "frontend-out"), { recursive: true });
    mkdirSync(join(resourcesDir, "skills"), { recursive: true });
    writeFileSync(join(resourcesDir, "frontend-out", "index.html"), "<!doctype html>");
    writeFileSync(join(resourcesDir, "qiongqi-runtime.tar.gz"), "");

    const fakeBinDir = join(tmpRoot, "bin");
    mkdirSync(fakeBinDir, { recursive: true });
    const fakeTar = join(fakeBinDir, "tar");
    writeFileSync(
      fakeTar,
      `#!/bin/sh
if [ "$1" != "-tzf" ] || [ "$2" != "qiongqi-runtime.tar.gz" ]; then
  echo "unexpected tar arguments: $*" >&2
  exit 64
fi
case "$PWD" in
  *Resources) ;;
  *)
    echo "unexpected tar cwd: $PWD" >&2
    exit 65
    ;;
esac
printf '%s\\n' \\
  qiongqi/dist/serve-entry.js \\
  qiongqi/node_modules/@qiongqi/http/package.json \\
  qiongqi/node_modules/@qiongqi/contracts/package.json \\
  qiongqi/node_modules/@qiongqi/preset-coding/package.json
`,
    );
    chmodSync(fakeTar, 0o755);

    const result = spawnSync(process.execPath, [builtVerifierPath], {
      env: {
        ...process.env,
        KWORKS_PACKAGED_RESOURCES_DIR: resourcesDir,
        PATH: `${fakeBinDir}${delimiter}${process.env.PATH ?? ""}`,
      },
      encoding: "utf8",
      windowsHide: true,
    });

    assert.equal(
      result.status,
      0,
      `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test("codesign retry wrapper retries timestamp failures and preserves hard failures", () => {
  const tmpRoot = mkdtempSync(join(tmpdir(), "kworks-codesign-retry-"));
  try {
    const attemptsFile = join(tmpRoot, "attempts");
    const retryingCodesign = join(tmpRoot, "retrying-codesign");
    writeFileSync(
      retryingCodesign,
      `#!/bin/sh
attempts=0
if [ -f "$KWORKS_CODESIGN_ATTEMPTS_FILE" ]; then
  attempts="$(cat "$KWORKS_CODESIGN_ATTEMPTS_FILE")"
fi
attempts=$((attempts + 1))
printf '%s' "$attempts" > "$KWORKS_CODESIGN_ATTEMPTS_FILE"
if [ "$attempts" -eq 1 ]; then
  echo "A timestamp was expected but was not found." >&2
  exit 1
fi
echo "codesign ok"
`,
    );
    chmodSync(retryingCodesign, 0o755);

    const retryResult = spawnSync(process.execPath, [codesignRetryPath, "--sign", "id"], {
      env: {
        ...process.env,
        KWORKS_REAL_CODESIGN: retryingCodesign,
        KWORKS_CODESIGN_ATTEMPTS_FILE: attemptsFile,
        KWORKS_CODESIGN_RETRY_DELAY_MS: "0",
      },
      encoding: "utf8",
      windowsHide: true,
    });

    assert.equal(
      retryResult.status,
      0,
      `stdout:\n${retryResult.stdout}\nstderr:\n${retryResult.stderr}`,
    );
    assert.equal(readFileSync(attemptsFile, "utf8"), "2");
    assert.match(retryResult.stderr, /retrying 2\/3/);

    const hardFailCodesign = join(tmpRoot, "hard-fail-codesign");
    writeFileSync(
      hardFailCodesign,
      `#!/bin/sh
echo "certificate is invalid" >&2
exit 3
`,
    );
    chmodSync(hardFailCodesign, 0o755);

    const hardFailResult = spawnSync(process.execPath, [codesignRetryPath, "--sign", "id"], {
      env: {
        ...process.env,
        KWORKS_REAL_CODESIGN: hardFailCodesign,
        KWORKS_CODESIGN_RETRY_DELAY_MS: "0",
      },
      encoding: "utf8",
      windowsHide: true,
    });

    assert.equal(hardFailResult.status, 3);
    assert.doesNotMatch(hardFailResult.stderr, /retrying/);
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

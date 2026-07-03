#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));
const desktopPackagePath = join(rootDir, "desktop", "package.json");
const frontendPackagePath = join(rootDir, "frontend", "package.json");
const releaseLogDir = join(rootDir, ".release-logs");
const releaseWorkflow = "Release";

function usage() {
  console.log(`Usage:
  node release.mjs --bump patch [options]
  node release.mjs --version 0.1.15 [options]
  node release.mjs --tag v0.1.15 [options]

Options:
  --bump <patch|minor|major>   Bump from desktop/package.json version.
  --version <x.y.z>            Set desktop/frontend package versions.
  --tag <vX.Y.Z>               Release the current package version tag.
  --message <text>             Commit/tag message. Defaults to "chore(release): vX.Y.Z".
  --branch <name>              Required git branch. Defaults to current branch.
  --remote <name>              Git remote to push. Defaults to origin.
  --skip-tests                 Skip local preflight tests.
  --no-watch                   Push tag but do not wait for GitHub Actions.
  --resume                     Do not commit/tag/push; watch and verify an existing tag.
  --dry-run                    Run checks and print the planned release without changing git.
  --yes                        Skip interactive confirmation.
  --help                       Show this help.

Examples:
  node release.mjs --bump patch
  node release.mjs --version 0.1.15 --yes
  node release.mjs --tag v0.1.15 --no-watch
`);
}

function parseArgs(argv) {
  const options = {
    bump: "",
    version: "",
    tag: "",
    message: "",
    branch: "",
    remote: "origin",
    skipTests: false,
    watch: true,
    yes: false,
    resume: false,
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length || argv[i].startsWith("--")) {
        throw new Error(`${arg} requires a value`);
      }
      return argv[i];
    };

    if (arg === "--bump") options.bump = next();
    else if (arg === "--version") options.version = next();
    else if (arg === "--tag") options.tag = next();
    else if (arg === "--message") options.message = next();
    else if (arg === "--branch") options.branch = next();
    else if (arg === "--remote") options.remote = next();
    else if (arg === "--skip-tests") options.skipTests = true;
    else if (arg === "--no-watch") options.watch = false;
    else if (arg === "--resume") options.resume = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--yes" || arg === "-y") options.yes = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function run(command, args = [], options = {}) {
  const label = [command, ...args].join(" ");
  console.log(`\n$ ${label}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? rootDir,
    env: { ...process.env, ...(options.env ?? {}) },
    encoding: "utf8",
    shell: false,
    stdio: options.capture ? "pipe" : "inherit",
    windowsHide: true,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const stderr = result.stderr ? `\n${result.stderr}` : "";
    const stdout = result.stdout ? `\n${result.stdout}` : "";
    throw new Error(`Command failed (${result.status}): ${label}${stdout}${stderr}`);
  }

  return (result.stdout ?? "").trim();
}

function capture(command, args = []) {
  return run(command, args, { capture: true });
}

function commandExists(command) {
  const result = spawnSync(command, ["--version"], {
    cwd: rootDir,
    encoding: "utf8",
    stdio: "pipe",
    windowsHide: true,
  });
  return result.status === 0;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function assertSemver(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Invalid semver version: ${version}`);
  }
}

function normalizeTag(tag) {
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
    throw new Error(`Invalid release tag: ${tag}. Expected vX.Y.Z`);
  }
  return tag;
}

function bumpVersion(current, bump) {
  assertSemver(current);
  if (!["patch", "minor", "major"].includes(bump)) {
    throw new Error(`Invalid --bump value: ${bump}`);
  }
  const parts = current.split(".").map((part) => Number.parseInt(part, 10));
  if (bump === "major") return `${parts[0] + 1}.0.0`;
  if (bump === "minor") return `${parts[0]}.${parts[1] + 1}.0`;
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
}

function deriveRelease(options) {
  const desktopPackage = readJson(desktopPackagePath);
  const frontendPackage = readJson(frontendPackagePath);
  const currentDesktopVersion = desktopPackage.version;
  const currentFrontendVersion = frontendPackage.version;

  if (!currentDesktopVersion || !currentFrontendVersion) {
    throw new Error("desktop/frontend package versions are required");
  }

  const selectors = [options.bump, options.version, options.tag].filter(Boolean);
  if (selectors.length !== 1) {
    throw new Error("Choose exactly one of --bump, --version, or --tag");
  }

  let version = "";
  if (options.bump) version = bumpVersion(currentDesktopVersion, options.bump);
  if (options.version) {
    assertSemver(options.version);
    version = options.version;
  }
  if (options.tag) {
    const tag = normalizeTag(options.tag);
    version = tag.slice(1);
    assertSemver(version);
  }

  const tag = `v${version}`;
  return {
    version,
    tag,
    currentDesktopVersion,
    currentFrontendVersion,
    versionNeedsWrite:
      currentDesktopVersion !== version || currentFrontendVersion !== version,
  };
}

function ensurePrerequisites(options, release) {
  for (const command of ["git", "node", "pnpm"]) {
    if (!commandExists(command)) throw new Error(`${command} is required`);
  }
  if (options.watch && !options.dryRun && !commandExists("gh")) {
    throw new Error("GitHub CLI gh is required when watching the release. Use --no-watch to skip.");
  }

  const branch = capture("git", ["branch", "--show-current"]);
  if (!branch) throw new Error("Detached HEAD is not supported for release publishing");
  const requiredBranch = options.branch || branch;
  if (branch !== requiredBranch) {
    throw new Error(`Current branch is ${branch}, expected ${requiredBranch}`);
  }

  capture("git", ["rev-parse", "--is-inside-work-tree"]);
  capture("git", ["remote", "get-url", options.remote]);

  const status = capture("git", ["status", "--porcelain"]);
  const allowedDirty =
    release.versionNeedsWrite &&
    !options.resume &&
    !options.dryRun &&
    status
      .split("\n")
      .filter(Boolean)
      .every((line) =>
        line.endsWith("desktop/package.json") ||
        line.endsWith("frontend/package.json"),
      );

  if (status && !allowedDirty) {
    if (options.dryRun || options.resume) {
      const mode = options.resume ? "Resume" : "Dry run";
      console.log(`\n${mode}: working tree has changes that are ignored in this mode:\n${status}`);
    } else {
      throw new Error(
        `Working tree is not clean. Commit or stash changes first.\n${status}`,
      );
    }
  }

  const localTagExists = spawnSync("git", ["rev-parse", "-q", "--verify", `refs/tags/${release.tag}`], {
    cwd: rootDir,
    encoding: "utf8",
    stdio: "pipe",
    windowsHide: true,
  }).status === 0;
  if (localTagExists && !options.resume) throw new Error(`Local tag already exists: ${release.tag}`);

  const remoteTag = capture("git", ["ls-remote", "--tags", options.remote, release.tag]);
  if (remoteTag && !options.resume) throw new Error(`Remote tag already exists: ${release.tag}`);
  if (options.resume && !remoteTag) throw new Error(`Cannot resume; remote tag does not exist: ${release.tag}`);
}

function updatePackageVersions(version) {
  for (const path of [desktopPackagePath, frontendPackagePath]) {
    const packageJson = readJson(path);
    packageJson.version = version;
    writeJson(path, packageJson);
  }
}

function requirePackageVersions(version) {
  const desktopVersion = readJson(desktopPackagePath).version;
  const frontendVersion = readJson(frontendPackagePath).version;
  if (desktopVersion !== version || frontendVersion !== version) {
    throw new Error(
      `Version mismatch: desktop=${desktopVersion}, frontend=${frontendVersion}, expected=${version}`,
    );
  }
}

function runPreflightTests(options) {
  if (options.dryRun) {
    console.log("\nSkipping local preflight tests because --dry-run was set.");
    return;
  }
  if (options.resume) {
    console.log("\nSkipping local preflight tests because --resume was set.");
    return;
  }
  if (options.skipTests) {
    console.log("\nSkipping local preflight tests because --skip-tests was set.");
    return;
  }
  const testsDir = join(rootDir, "desktop", "tests");
  const testFiles = readdirSync(testsDir)
    .filter((entry) => entry.endsWith(".test.mjs"))
    .sort()
    .map((entry) => join("tests", entry));
  run("node", ["--test", ...testFiles], { cwd: join(rootDir, "desktop") });
}

function commitAndTag(options, release) {
  if (options.dryRun) {
    console.log("\nDry run: skipping commit and tag creation.");
    return;
  }
  if (options.resume) {
    console.log("\nSkipping commit and tag creation because --resume was set.");
    return;
  }

  const message = options.message || `chore(release): ${release.tag}`;
  const status = capture("git", ["status", "--porcelain"]);

  if (status) {
    run("git", ["add", "desktop/package.json", "frontend/package.json"]);
    run("git", ["commit", "-m", message]);
  } else {
    console.log("\nNo version file changes to commit.");
  }

  const head = capture("git", ["rev-parse", "HEAD"]);
  run("git", ["tag", "-a", release.tag, "-m", message, head]);
}

function pushBranchAndTag(options, release) {
  if (options.dryRun) {
    console.log("\nDry run: skipping push.");
    return;
  }
  if (options.resume) {
    console.log("\nSkipping push because --resume was set.");
    return;
  }

  const branch = capture("git", ["branch", "--show-current"]);
  run("git", ["push", "--atomic", options.remote, branch, release.tag]);
}

function waitForRun(options, release) {
  if (options.dryRun) {
    console.log("\nDry run: skipping GitHub Actions watch.");
    return "";
  }
  if (!options.watch) {
    console.log("\nRelease tag pushed. Skipping GitHub Actions watch because --no-watch was set.");
    return "";
  }

  console.log("\nWaiting for the GitHub Actions release run to appear...");
  let runId = "";
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const output = capture("gh", [
      "run",
      "list",
      "--repo",
      options.repo,
      "--workflow",
      releaseWorkflow,
      "--event",
      "push",
      "--limit",
      "30",
      "--json",
      "databaseId,headBranch,status,conclusion,displayTitle,createdAt",
    ]);
    const runs = JSON.parse(output || "[]");
    const run = runs.find((candidate) => candidate.headBranch === release.tag);
    if (run) {
      runId = String(run.databaseId);
      break;
    }
    sleep(10_000);
    console.log(`Still waiting for run (${attempt}/30)...`);
  }
  if (!runId) throw new Error(`No GitHub Actions run appeared for ${release.tag}`);

  console.log(`\nWatching GitHub Actions run ${runId}...`);
  const watch = spawnSync("gh", [
    "run",
    "watch",
    runId,
    "--repo",
    options.repo,
    "--exit-status",
  ], {
    cwd: rootDir,
    encoding: "utf8",
    stdio: "inherit",
    windowsHide: true,
  });

  if (watch.status !== 0) {
    saveFailureLogs(options, runId);
    throw new Error(`GitHub Actions release run failed: ${runId}`);
  }

  return runId;
}

function saveFailureLogs(options, runId) {
  mkdirSync(releaseLogDir, { recursive: true });
  const summaryPath = join(releaseLogDir, `run-${runId}.json`);
  const logPath = join(releaseLogDir, `run-${runId}.log`);

  const summary = spawnSync("gh", [
    "run",
    "view",
    runId,
    "--repo",
    options.repo,
    "--json",
    "status,conclusion,jobs,url,name,displayTitle,event,headSha,createdAt,updatedAt",
  ], {
    cwd: rootDir,
    encoding: "utf8",
    stdio: "pipe",
    windowsHide: true,
  });
  if (summary.stdout) writeFileSync(summaryPath, summary.stdout);

  const logs = spawnSync("gh", [
    "run",
    "view",
    runId,
    "--repo",
    options.repo,
    "--log-failed",
  ], {
    cwd: rootDir,
    encoding: "utf8",
    stdio: "pipe",
    windowsHide: true,
  });
  writeFileSync(logPath, `${logs.stdout ?? ""}${logs.stderr ?? ""}`);

  console.error(`\nSaved failed run diagnostics:`);
  console.error(`  ${summaryPath}`);
  console.error(`  ${logPath}`);
}

function verifyReleaseAssets(options, release) {
  if (options.dryRun) return;
  if (!options.watch) return;

  const output = capture("gh", [
    "release",
    "view",
    release.tag,
    "--repo",
    options.repo,
    "--json",
    "tagName,name,publishedAt,url,assets",
  ]);
  const data = JSON.parse(output);
  const assets = new Set(data.assets.map((asset) => asset.name));
  const version = release.version;
  const requiredAssets = [
    `KWorks-${version}-win-x64.exe`,
    `KWorks-${version}-mac-arm64.dmg`,
    `KWorks-${version}-mac-arm64.zip`,
    `KWorks-${version}-mac-x64.dmg`,
    `KWorks-${version}-mac-x64.zip`,
    `KWorks-${version}-linux-x86_64.AppImage`,
    "latest.yml",
    "latest-mac.yml",
    "latest-linux.yml",
  ];
  const missing = requiredAssets.filter((asset) => !assets.has(asset));
  if (missing.length > 0) {
    throw new Error(`Release ${release.tag} is missing assets:\n${missing.join("\n")}`);
  }

  console.log(`\nRelease assets verified: ${data.url}`);
  for (const name of requiredAssets) console.log(`  - ${name}`);
}

function repoSlug(remote) {
  const url = capture("git", ["remote", "get-url", remote]);
  const ssh = url.match(/github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?$/);
  if (ssh) return ssh[1];
  const https = url.match(/github\.com\/([^/]+\/[^/.]+)(?:\.git)?$/);
  if (https) return https[1];
  throw new Error(`Cannot infer GitHub repo from remote URL: ${url}`);
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

async function confirm(options, release) {
  if (options.yes || options.dryRun || !process.stdin.isTTY) return;

  console.log(`
About to release:
  version: ${release.version}
  tag:     ${release.tag}
  remote:  ${options.remote}

Type ${release.tag} to continue:`);

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const input = (await rl.question("> ")).trim();
  rl.close();
  if (input !== release.tag) {
    throw new Error("Release cancelled by user");
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }

  const release = deriveRelease(options);
  options.repo = repoSlug(options.remote);
  ensurePrerequisites(options, release);

  if (release.versionNeedsWrite && !options.resume && !options.dryRun) {
    updatePackageVersions(release.version);
  }
  if (!options.dryRun && !options.resume) requirePackageVersions(release.version);
  if (options.dryRun) {
    console.log(`
Dry run release plan:
  current desktop version:  ${release.currentDesktopVersion}
  current frontend version: ${release.currentFrontendVersion}
  next version:             ${release.version}
  tag:                      ${release.tag}
  repo:                     ${options.repo}
  would write versions:      ${release.versionNeedsWrite ? "yes" : "no"}
`);
  }

  runPreflightTests(options);
  await confirm(options, release);
  commitAndTag(options, release);
  pushBranchAndTag(options, release);
  const runId = waitForRun(options, release);
  verifyReleaseAssets(options, release);

  console.log(`\nRelease lifecycle finished for ${release.tag}${runId ? ` (run ${runId})` : ""}.`);
}

try {
  await main();
} catch (error) {
  console.error(`\nrelease.mjs failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

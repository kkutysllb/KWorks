import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const releaseScriptUrl = new URL("../../release.mjs", import.meta.url);
const releaseScriptPath = fileURLToPath(releaseScriptUrl);
const releaseScriptSource = existsSync(releaseScriptUrl)
  ? readFileSync(releaseScriptUrl, "utf8")
  : "";

test("root release lifecycle script exposes a safe manual release flow", () => {
  assert.equal(existsSync(releaseScriptUrl), true);

  const help = spawnSync(process.execPath, [releaseScriptPath, "--help"], {
    encoding: "utf8",
    windowsHide: true,
  });

  assert.equal(help.status, 0, `stdout:\n${help.stdout}\nstderr:\n${help.stderr}`);
  assert.match(help.stdout, /Usage:/);
  assert.match(help.stdout, /--bump patch/);
  assert.match(help.stdout, /--version 0\.1\.15/);
  assert.match(help.stdout, /--no-watch/);
});

test("release lifecycle script guards versioning, tags, CI monitoring, and assets", () => {
  assert.match(releaseScriptSource, /desktop\/package\.json/);
  assert.match(releaseScriptSource, /frontend\/package\.json/);
  assert.match(releaseScriptSource, /"status", "--porcelain"/);
  assert.match(releaseScriptSource, /"tag", "-a"/);
  assert.match(releaseScriptSource, /"push", "--atomic"/);
  assert.match(releaseScriptSource, /"run",\s+"list"/);
  assert.match(releaseScriptSource, /"run",\s+"view"/);
  assert.match(releaseScriptSource, /"release",\s+"view"/);
  assert.match(releaseScriptSource, /\.release-logs/);
  assert.match(releaseScriptSource, /KWorks-\$\{version\}-win-x64\.exe/);
  assert.match(releaseScriptSource, /KWorks-\$\{version\}-mac-arm64\.dmg/);
  assert.match(releaseScriptSource, /KWorks-\$\{version\}-mac-x64\.dmg/);
  assert.match(releaseScriptSource, /KWorks-\$\{version\}-linux-x86_64\.AppImage/);
  assert.match(releaseScriptSource, /latest-mac\.yml/);
});

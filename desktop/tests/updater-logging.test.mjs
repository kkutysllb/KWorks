import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const updaterSource = readFileSync(
  new URL("../src/updater.ts", import.meta.url),
  "utf8",
);

test("dev updater IPC no-ops stay quiet when autoUpdater is unavailable", () => {
  assert.match(updaterSource, /ipcMain\.handle\("updater:check"/);
  assert.match(updaterSource, /return \{ available: false \}/);
  assert.match(updaterSource, /ipcMain\.handle\("updater:install"/);
  assert.match(updaterSource, /return false/);
  assert.doesNotMatch(updaterSource, /check skipped: autoUpdater not initialized/);
  assert.doesNotMatch(updaterSource, /install skipped: autoUpdater not initialized/);
});

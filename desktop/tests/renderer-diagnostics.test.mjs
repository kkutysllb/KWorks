import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ipcSource = readFileSync(
  new URL("../src/ipc.ts", import.meta.url),
  "utf8",
);
const mainSource = readFileSync(
  new URL("../src/main.ts", import.meta.url),
  "utf8",
);
const preloadSource = readFileSync(
  new URL("../src/preload.ts", import.meta.url),
  "utf8",
);

test("desktop logs renderer crashes, load failures, and global renderer errors", () => {
  assert.match(mainSource, /render-process-gone/);
  assert.match(mainSource, /did-fail-load/);
  assert.match(mainSource, /unresponsive/);
  assert.match(preloadSource, /window\.addEventListener\("error"/);
  assert.match(preloadSource, /window\.addEventListener\("unhandledrejection"/);
  assert.match(preloadSource, /ipcRenderer\.send\("renderer:error"/);
  assert.match(ipcSource, /ipcMain\.on\("renderer:error"/);
});

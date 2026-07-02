import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const envSource = readFileSync(new URL("../src/process-env.ts", import.meta.url), "utf8");
const backendSource = readFileSync(new URL("../src/backend.ts", import.meta.url), "utf8");
const ipcSource = readFileSync(new URL("../src/ipc.ts", import.meta.url), "utf8");

test("desktop child processes inherit a login-shell style executable PATH", () => {
  assert.match(envSource, /DEFAULT_EXECUTABLE_PATH_ENTRIES/);
  assert.match(envSource, /"\/opt\/homebrew\/bin"/);
  assert.match(envSource, /"\/opt\/homebrew\/sbin"/);
  assert.match(envSource, /"\/usr\/local\/bin"/);
  assert.match(envSource, /"\/usr\/bin"/);
  assert.match(envSource, /"\/bin"/);
  assert.match(envSource, /"\/usr\/sbin"/);
  assert.match(envSource, /"\/sbin"/);
  assert.match(envSource, /env\.HOME/);
  assert.match(envSource, /env\.USERPROFILE/);
  assert.match(envSource, /\.local\/bin/);
  assert.match(envSource, /KWORKS_EXECUTABLE_PATH/);
});

test("qiongqi backend and embedded terminals use the shared child process env", () => {
  assert.match(backendSource, /import \{ buildChildProcessEnv \} from "\.\/process-env\.js"/);
  assert.match(backendSource, /buildChildProcessEnv\(\s*process\.env,/);
  assert.match(ipcSource, /import \{ buildChildProcessEnv \} from "\.\/process-env\.js"/);
  assert.match(ipcSource, /buildChildProcessEnv\(process\.env\)/);
  assert.doesNotMatch(ipcSource, /DEFAULT_TERMINAL_PATH/);
});

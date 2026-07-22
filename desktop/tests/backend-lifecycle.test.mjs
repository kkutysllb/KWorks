import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const backendSource = readFileSync(
  new URL("../src/backend.ts", import.meta.url),
  "utf8",
);

test("backend stop closes log stream and clears child state", () => {
  assert.match(backendSource, /private async closeLogStream\(\)/);
  assert.match(backendSource, /await this\.closeLogStream\(\)/);
  assert.match(backendSource, /this\.logStream = null/);
});

test("backend log ingestion clamps oversized QiongQi event lines", () => {
  assert.match(backendSource, /MAX_BACKEND_LOG_LINE_CHARS/);
  assert.match(backendSource, /function sanitizeBackendLogLine/);
  assert.match(backendSource, /truncated \$\{line\.length - MAX_BACKEND_LOG_LINE_CHARS\} chars/);
  assert.match(backendSource, /sanitizeBackendLogLine\(line\)/);
});

test("windows backend termination waits for taskkill to finish or timeout", () => {
  assert.match(backendSource, /spawn\("taskkill"/);
  assert.match(backendSource, /taskkill\.once\("exit"/);
  assert.match(backendSource, /setTimeout\(\(\) =>/);
});

test("unix backend runs in its own process group and terminates the tree gracefully", () => {
  assert.match(backendSource, /detached:\s*process\.platform !== "win32"/);
  assert.match(backendSource, /BACKEND_TERMINATION_GRACE_MS\s*=\s*8_000/);
  assert.match(backendSource, /process\.kill\(-child\.pid,\s*"SIGTERM"\)/);
  assert.match(backendSource, /process\.kill\(-child\.pid!?,\s*"SIGKILL"\)/);
});

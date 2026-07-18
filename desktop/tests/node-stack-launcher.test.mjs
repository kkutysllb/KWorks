import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const serveSource = readFileSync(new URL("../../scripts/serve.mjs", import.meta.url), "utf8");
const startSource = readFileSync(new URL("../../start.sh", import.meta.url), "utf8");
const preloadSource = readFileSync(new URL("../src/preload.ts", import.meta.url), "utf8");
const makefileUrl = new URL("../../Makefile", import.meta.url);

test("legacy repo web-stack launcher is disabled in Electron-only mode", () => {
  assert.match(serveSource, /KWorks is Electron-only/);
  assert.match(serveSource, /legacy Node \+ standalone Next\.js web stack has been removed/);
  assert.match(serveSource, /process\.exit\(1\)/);
  assert.doesNotMatch(serveSource, /NEXT_PUBLIC_BACKEND_BASE_URL/);
  assert.doesNotMatch(serveSource, /NEXT_PUBLIC_RUNTIME_API_BASE_URL/);
  assert.doesNotMatch(serveSource, /next", "dev/);
  assert.doesNotMatch(serveSource, /serve-entry\.js/);
  assert.doesNotMatch(serveSource, /uvicorn/);
});

test("top-level start script delegates to Electron desktop commands", () => {
  assert.match(startSource, /pnpm -C desktop run dev/);
  assert.match(startSource, /pnpm -C desktop run build:app/);
  assert.doesNotMatch(startSource, /scripts\/serve\.mjs/);
  assert.doesNotMatch(startSource, /next dev/);
});

test("top-level Makefile is not required for Electron-only launch", () => {
  assert.equal(existsSync(makefileUrl), false);
});

test("Electron preload exposes the runtime gateway port instead of a web build constant", () => {
  assert.match(preloadSource, /process\.env\.GATEWAY_PORT/);
  assert.match(preloadSource, /gatewayPort: RUNTIME_GATEWAY_PORT/);
});

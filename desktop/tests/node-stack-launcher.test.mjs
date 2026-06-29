import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const serveSource = readFileSync(new URL("../../scripts/serve.mjs", import.meta.url), "utf8");
const startSource = readFileSync(new URL("../../start.sh", import.meta.url), "utf8");
const makefileUrl = new URL("../../Makefile", import.meta.url);

test("repo launcher starts the Node QiongQi runtime directly", () => {
  assert.match(serveSource, /serve-entry\.js/);
  assert.match(serveSource, /"qiongqi"/);
  assert.doesNotMatch(serveSource, /third_party/);
  assert.match(serveSource, /process\.execPath/);
  assert.match(serveSource, /NEXT_PUBLIC_BACKEND_BASE_URL/);
  assert.doesNotMatch(serveSource, /uvicorn/);
  assert.doesNotMatch(serveSource, /uv run/);
  assert.doesNotMatch(serveSource, /cd backend/);
});

test("top-level start script delegates to the Node stack launcher", () => {
  assert.match(startSource, /node --env-file=\.env scripts\/serve\.mjs start/);
  assert.doesNotMatch(startSource, /uvicorn/);
  assert.doesNotMatch(startSource, /uv run/);
  assert.doesNotMatch(startSource, /cd backend/);
});

test("top-level Makefile is not required for the Node stack launcher", () => {
  assert.equal(existsSync(makefileUrl), false);
});

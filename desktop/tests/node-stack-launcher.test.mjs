import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const serveSource = readFileSync(new URL("../../scripts/serve.mjs", import.meta.url), "utf8");
const startSource = readFileSync(new URL("../../start.sh", import.meta.url), "utf8");
const makefileSource = readFileSync(new URL("../../Makefile", import.meta.url), "utf8");

test("repo launcher starts the Node QiongQi runtime directly", () => {
  assert.match(serveSource, /serve-entry\.js/);
  assert.match(serveSource, /third_party", "qiongqi"/);
  assert.match(serveSource, /process\.execPath/);
  assert.match(serveSource, /NEXT_PUBLIC_BACKEND_BASE_URL/);
  assert.doesNotMatch(serveSource, /uvicorn/);
  assert.doesNotMatch(serveSource, /uv run/);
  assert.doesNotMatch(serveSource, /cd backend/);
});

test("top-level start script delegates to the Node stack launcher", () => {
  assert.match(startSource, /node scripts\/serve\.mjs start/);
  assert.doesNotMatch(startSource, /uvicorn/);
  assert.doesNotMatch(startSource, /uv run/);
  assert.doesNotMatch(startSource, /cd backend/);
});

test("top-level Makefile no longer installs or starts the Python backend", () => {
  assert.match(makefileSource, /third_party\/qiongqi/);
  assert.match(makefileSource, /node scripts\/serve\.mjs start dev/);
  assert.doesNotMatch(makefileSource, /uv sync/);
  assert.doesNotMatch(makefileSource, /uv run/);
  assert.doesNotMatch(makefileSource, /cd backend/);
});

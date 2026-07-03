#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import process from "node:process";

const realCodesign = process.env.KWORKS_REAL_CODESIGN || "/usr/bin/codesign";
const maxAttempts = 3;
const configuredRetryDelayMs = Number.parseInt(
  process.env.KWORKS_CODESIGN_RETRY_DELAY_MS || "",
  10,
);
const retryDelayMs = Number.isFinite(configuredRetryDelayMs)
  ? configuredRetryDelayMs
  : 15_000;

let lastResult = null;

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const result = spawnSync(realCodesign, process.argv.slice(2), {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  });
  lastResult = result;

  writeOutput(result);

  if (result.status === 0) {
    process.exit(0);
  }

  if (attempt === maxAttempts || !isRetryableCodesignFailure(result)) {
    process.exit(result.status ?? 1);
  }

  console.error(
    `[codesign-retry] transient codesign timestamp failure, retrying ${attempt + 1}/${maxAttempts} in ${retryDelayMs / 1000}s`,
  );
  sleep(retryDelayMs);
}

process.exit(lastResult?.status ?? 1);

function writeOutput(result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

function isRetryableCodesignFailure(result) {
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  return [
    /A timestamp was expected but was not found/i,
    /timestamp authority/i,
    /timestamp service/i,
    /timestamp server/i,
    /timestamp.*(malfunction|refus|unavailable|cannot be contacted|timed? out)/i,
  ].some((pattern) => pattern.test(output));
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

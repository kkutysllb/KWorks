#!/usr/bin/env node
/**
 * One-time migration: merge legacy dev-mode data from
 * ~/.kworks-workspace/data/qiongqi/ into the canonical packaged-mode layout
 * ~/.kworks-workspace/users/runtime/ (threads, workspace) and
 * ~/.kworks-workspace/system/data/kworks.sqlite (user data).
 *
 * Safe to run multiple times — existing files are never overwritten.
 * After successful migration the source directory is renamed to
 * data/qiongqi.migrated-<timestamp> as a backup.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, cpSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { homedir } from "node:os";

const ROOT = join(homedir(), ".kworks-workspace");
const DEV_DATA = join(ROOT, "data", "qiongqi");
const PKG_DATA = join(ROOT, "users", "runtime");
const PKG_SQLITE = join(ROOT, "system", "data", "kworks.sqlite");
const DEV_SQLITE = join(DEV_DATA, "system", "data", "kworks.sqlite");

let migrated = 0;
let skipped = 0;

function log(msg) { console.log(`[migrate] ${msg}`); }

function copyDirMerge(src, dest) {
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const s = join(src, entry);
    const d = join(dest, entry);
    if (existsSync(d)) { skipped++; continue; }
    cpSync(s, d, { recursive: true });
    migrated++;
    log(`  copied: ${entry}`);
  }
}

// ── 1. Migrate threads ──────────────────────────────────────────────────
function migrateThreads() {
  const devThreads = join(DEV_DATA, "threads");
  const pkgThreads = join(PKG_DATA, "threads");
  if (!existsSync(devThreads)) { log("no dev threads found"); return; }
  mkdirSync(pkgThreads, { recursive: true });

  // Copy thread directories
  for (const entry of readdirSync(devThreads)) {
    if (entry === "index.json" || entry === "task-migrations.jsonl") continue;
    const s = join(devThreads, entry);
    const d = join(pkgThreads, entry);
    if (!statSync(s).isDirectory()) continue;
    if (existsSync(d)) { skipped++; continue; }
    cpSync(s, d, { recursive: true });
    migrated++;
    log(`  thread: ${entry}`);
  }

  // Merge index.json (union of order arrays, latest updatedAt wins)
  const devIndex = join(devThreads, "index.json");
  const pkgIndex = join(pkgThreads, "index.json");
  if (existsSync(devIndex)) {
    const dev = JSON.parse(readFileSync(devIndex, "utf8"));
    const pkg = existsSync(pkgIndex) ? JSON.parse(readFileSync(pkgIndex, "utf8")) : { order: [], updatedAt: "" };
    const merged = new Set([...(pkg.order || []), ...(dev.order || [])]);
    const updatedAt = (dev.updatedAt || "") > (pkg.updatedAt || "") ? dev.updatedAt : pkg.updatedAt;
    writeFileSync(pkgIndex, JSON.stringify({ order: [...merged], updatedAt }));
    log(`  index.json merged: ${dev.order?.length ?? 0} dev + ${pkg.order?.length ?? 0} pkg → ${merged.size} total`);
  }

  // Append task-migrations.jsonl
  const devMig = join(devThreads, "task-migrations.jsonl");
  const pkgMig = join(pkgThreads, "task-migrations.jsonl");
  if (existsSync(devMig)) {
    const devLines = readFileSync(devMig, "utf8").trim();
    if (devLines) {
      const pkgLines = existsSync(pkgMig) ? readFileSync(pkgMig, "utf8").trim() : "";
      const existing = new Set(pkgLines ? pkgLines.split("\n") : []);
      const newLines = devLines.split("\n").filter((l) => !existing.has(l));
      if (newLines.length > 0) {
        const append = (pkgLines ? "\n" : "") + newLines.join("\n") + "\n";
        writeFileSync(pkgMig, pkgLines + append);
        log(`  task-migrations.jsonl: +${newLines.length} lines`);
      }
    }
  }
}

// ── 2. Migrate workspace files ──────────────────────────────────────────
function migrateWorkspace() {
  const devWs = join(DEV_DATA, "users", "runtime", "workspace");
  const pkgWs = join(PKG_DATA, "workspace");
  if (!existsSync(devWs)) { log("no dev workspace found"); return; }
  log("workspace files:");
  copyDirMerge(devWs, pkgWs);
}

// ── 3. Migrate dev user directories to root users/ ──────────────────────
function migrateUsers() {
  const devUsers = join(DEV_DATA, "users");
  if (!existsSync(devUsers)) return;
  for (const entry of readdirSync(devUsers)) {
    if (entry === "runtime") continue; // handled by workspace migration
    const s = join(devUsers, entry);
    const d = join(ROOT, "users", entry);
    if (!statSync(s).isDirectory()) continue;
    if (existsSync(d)) {
      // Merge subdirectories
      log(`user ${entry}: merging into existing`);
      copyDirMerge(s, d);
    } else {
      cpSync(s, d, { recursive: true });
      migrated++;
      log(`user ${entry}: copied`);
    }
  }
}

// ── 4. Merge SQLite (dev user → pkg sqlite) ─────────────────────────────
function migrateSqlite() {
  if (!existsSync(DEV_SQLITE) || !existsSync(PKG_SQLITE)) {
    log("sqlite: source or target missing, skipping");
    return;
  }
  const tables = ["users", "auth_sessions", "user_state", "user_settings", "model_profiles", "model_secrets", "usage_events"];
  const sql = [
    `ATTACH DATABASE '${DEV_SQLITE}' AS dev;`,
    ...tables.map((t) => `INSERT OR IGNORE INTO main.${t} SELECT * FROM dev.${t};`),
    "DETACH DATABASE dev;",
  ].join("\n");
  try {
    execSync(`sqlite3 '${PKG_SQLITE}' "${sql.replace(/"/g, '\\"')}"`, { encoding: "utf8" });
    log("sqlite: dev rows merged into pkg database");
  } catch (err) {
    log(`sqlite merge warning: ${err.message?.split("\n")[0]}`);
  }
}

// ── Main ────────────────────────────────────────────────────────────────
if (!existsSync(DEV_DATA)) {
  log(`source ${DEV_DATA} does not exist — nothing to migrate`);
  process.exit(0);
}

log(`source: ${DEV_DATA}`);
log(`target: ${PKG_DATA}`);
log("");

log("── threads ──");
migrateThreads();
log("── workspace ──");
migrateWorkspace();
log("── users ──");
migrateUsers();
log("── sqlite ──");
migrateSqlite();

log("");
log(`done: ${migrated} items migrated, ${skipped} skipped (already exist)`);

// Rename source as backup
const backup = `${DEV_DATA}.migrated-${Date.now()}`;
renameSync(DEV_DATA, backup);
log(`source renamed to: ${backup}`);
log("you can safely delete the backup after verifying the migration");

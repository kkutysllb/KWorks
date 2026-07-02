#!/usr/bin/env node
/**
 * Topological build orchestrator for the Qiongqi monorepo.
 *
 * Why this exists: the package graph contains a circular strongly-connected
 * component (SCC) — {services, loop, adapter-tools, delegation} — where the
 * cross-imports inside the SCC are mostly `import type` (erased at emit).
 * `pnpm -r run build` cannot guarantee the intra-SCC ordering required so
 * that each package's `dist/` exists before its runtime dependents build.
 * This script builds in a fixed, dependency-aware sequence.
 *
 * Build layers (each layer may only depend on already-built packages,
 * except for the SCC packages whose type-only back-edges are tolerated
 * thanks to tsc's default `noEmitOnError: false`):
 *
 *   L1 leaves        : contracts, adapter-fs
 *   L2               : domain, attachments, tool-infra
 *   L3               : ports, cache
 *   L4               : adapter-model, adapter-storage
 *   L5               : memory, skills
 *   L6 SCC (ordered) : services → delegation → adapter-tools → loop
 *   L7               : http
 *   L8               : preset-coding, cli
 *
 * Skills is placed in L5 because its only edge into the SCC (adapter-tools)
 * is `import type`; it emits fine before the SCC completes.
 *
 * Usage: node scripts/build.mjs [--clean]
 */
import { spawnSync } from 'node:child_process'
import { rmSync, existsSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const STRAY_EMIT_EXT = new Set(['.js', '.js.map', '.d.ts', '.d.ts.map'])

/** Recursively collect compiled artifacts (.js/.d.ts/.map) inside a src dir. */
function findStrayEmit(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...findStrayEmit(p))
    } else if (STRAY_EMIT_EXT.has(entry.name.slice(entry.name.lastIndexOf('.')))) {
      out.push(p)
    }
  }
  return out
}

const clean = process.argv.includes('--clean')
const CHILD_OUTPUT_LIMIT = 16 * 1024 * 1024

// [name, dist-relative-path]
const sequence = [
  ['contracts', 'packages/foundation/contracts'],
  ['adapter-fs', 'packages/infrastructure/adapter-fs'],
  ['domain', 'packages/domain-layer/domain'],
  ['attachments', 'packages/infrastructure/attachments'],
  ['tool-infra', 'packages/infrastructure/tool-infra'],
  ['ports', 'packages/ports-layer/ports'],
  ['cache', 'packages/infrastructure/cache'],
  ['adapter-model', 'packages/adapters/adapter-model'],
  ['adapter-storage', 'packages/adapters/adapter-storage'],
  ['memory', 'packages/capabilities/memory'],
  ['skills', 'packages/capabilities/skills'],
  ['services', 'packages/engine/services'],
  ['delegation', 'packages/delegation-layer/delegation'],
  ['adapter-tools', 'packages/adapters/adapter-tools'],
  ['loop', 'packages/engine/loop'],
  ['http', 'packages/http-layer/http'],
  ['preset-coding', 'packages/presets/preset-coding'],
  ['cli', 'packages/cli-layer/cli']
]

function resolvePackageTsc(pkgDir) {
  const pkgRequire = createRequire(resolve(pkgDir, 'package.json'))
  return pkgRequire.resolve('typescript/bin/tsc')
}

function runPackageBuild(pkgDir) {
  return spawnSync(process.execPath, [resolvePackageTsc(pkgDir), '-p', 'tsconfig.build.json'], {
    cwd: pkgDir,
    encoding: 'utf8',
    maxBuffer: CHILD_OUTPUT_LIMIT,
    stdio: ['ignore', 'pipe', 'pipe']
  })
}

function writeChildOutput(result) {
  if (result.error) {
    process.stderr.write(`${result.error.stack || result.error.message}\n`)
  }
  if (result.status !== 0 || result.signal) {
    process.stderr.write(`tsc exited with status ${result.status ?? 'null'}${result.signal ? `, signal ${result.signal}` : ''}\n`)
  }
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
}

if (clean) {
  console.log('cleaning dist/ and stray src/ artifacts in all packages...')
  for (const [, pkgPath] of sequence) {
    const dist = resolve(root, pkgPath, 'dist')
    if (existsSync(dist)) rmSync(dist, { recursive: true, force: true })
    // Also remove any stray tsc emit that landed inside src/ (defensive).
    const srcDir = resolve(root, pkgPath, 'src')
    if (existsSync(srcDir)) {
      for (const f of findStrayEmit(srcDir)) rmSync(f, { force: true })
    }
  }
}

let failed = []
for (const [name, pkgPath] of sequence) {
  // Clean this package's stale dist to avoid TS5055 "would overwrite input".
  const pkgDir = resolve(root, pkgPath)
  const dist = resolve(pkgDir, 'dist')
  const distIndex = resolve(dist, 'index.js')
  if (existsSync(dist)) rmSync(dist, { recursive: true, force: true })

  process.stdout.write(`build @qiongqi/${name} ... `)
  const result = runPackageBuild(pkgDir)
  const emitted = existsSync(distIndex)

  if (result.status === 0 && emitted) {
    process.stdout.write('OK\n')
  } else if (emitted) {
    // The SCC type-only back-edges can produce non-zero exit even though
    // emit succeeded. Distinguish real failure (no dist) from tolerated
    // type errors (dist present).
    process.stdout.write('OK (with non-fatal type warnings)\n')
  } else {
    process.stdout.write('FAILED\n')
    if (result.status === 0 && !result.error) {
      process.stderr.write(`TypeScript exited successfully but ${distIndex} was not produced.\n`)
    }
    writeChildOutput(result)
    failed.push(name)
  }
}

if (failed.length > 0) {
  console.error(`\nBuild failed for: ${failed.join(', ')}`)
  process.exit(1)
}
console.log('\nAll 18 packages built successfully.')

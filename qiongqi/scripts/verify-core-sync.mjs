import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const upstream = process.env.QIONGQI_UPSTREAM_DIR
if (!upstream) throw new Error('QIONGQI_UPSTREAM_DIR is required')
const root = resolve(process.cwd())
const allow = [
  'packages/foundation/contracts/src/runtime-kernel.ts',
  'packages/foundation/contracts/src/memory.ts',
  'packages/foundation/contracts/src/qiongqi-config.ts',
  'packages/ports-layer/ports/src/model-client.ts',
  'packages/ports-layer/ports/src/tool-host.ts',
  'packages/ports-layer/ports/src/thread-store.ts',
  'packages/foundation/contracts/src/task-state.ts',
  'packages/infrastructure/cache/src/prefix-volatility.ts',
  'packages/adapters/adapter-model/src/model-compat-client.ts',
  'packages/engine/loop/package.json',
  'packages/infrastructure/attachments/package.json',
  'packages/http-layer/http/src/kworks-workspace-paths.ts',
  'packages/http-layer/http/src/node-http-server.ts',
  'packages/adapters/adapter-storage/src/index.ts',
  'packages/adapters/adapter-storage/src/file-lock.ts',
  'packages/adapters/adapter-storage/src/file-run-state-store.ts',
  'packages/adapters/adapter-storage/src/file-run-event-store.ts',
  'packages/engine/loop/src/index.ts',
  'packages/engine/loop/src/execution-graph.ts',
  'packages/engine/loop/src/middleware-chain.ts',
  'packages/engine/loop/src/runtime-kernel-context.ts',
  'packages/engine/loop/src/runtime-middleware.ts',
  'packages/engine/loop/src/runtime-kernel.ts',
  'packages/engine/loop/src/model-proposal.ts',
  'packages/engine/loop/src/model-protocol-normalizer.ts',
  'packages/engine/loop/src/model-proposal-runner.ts',
  'packages/engine/loop/src/kernel-v3-graph.ts',
  'packages/engine/loop/src/kernel-v3-node-handlers.ts',
  'packages/engine/loop/src/kernel-v3-turn-runner.ts',
  'packages/engine/loop/src/prompt-builder.ts',
  'packages/engine/loop/src/compaction-governor.ts',
  'packages/engine/loop/src/loop-governor.ts',
  'packages/engine/loop/src/task-progress-projector.ts',
  'packages/engine/loop/src/middleware/loop-governor-middleware.ts',
  'packages/engine/loop/src/effect-commit.ts',
  'packages/engine/loop/src/tool-runtime-v3.ts',
  'packages/engine/loop/src/durable-task-capsule.ts',
  'packages/engine/loop/src/runtime-event-projection.ts',
  'packages/engine/loop/src/turn-event-types.ts',
  'packages/engine/loop/src/context-compactor.ts',
  'packages/engine/loop/src/model-context-profile.ts',
  'packages/engine/loop/src/tool-call-coordinator.ts',
  'packages/engine/loop/src/turn-orchestrator.ts',
  'packages/engine/services/src/runtime-event-recorder.ts',
  'packages/capabilities/memory/src/memory-store.ts',
  'packages/capabilities/memory/src/retrieval.ts',
  'packages/http-layer/http/src/runtime-factory.ts'
]
const sharedRoots = [
  'packages/foundation/contracts/src',
  'packages/domain-layer/domain/src',
  'packages/ports-layer/ports/src',
  'packages/engine/loop/src',
  'packages/engine/services/src',
  'packages/adapters/adapter-storage/src',
  'packages/adapters/adapter-model/src',
  'packages/adapters/adapter-tools/src',
  'packages/infrastructure/attachments/src',
  'packages/infrastructure/cache/src',
  'packages/http-layer/http/src',
]
async function sourceFiles(relativeDir) {
  const absolute = join(root, relativeDir)
  const entries = await readdir(absolute, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const relative = join(relativeDir, entry.name)
    if (entry.isDirectory()) return sourceFiles(relative)
    return (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) || entry.name.endsWith('.json') ? [relative] : []
  }))
  return nested.flat()
}
const files = [...new Set([...allow, ...(await Promise.all(sharedRoots.map(sourceFiles))).flat()])]
for (const file of files) {
  const localPath = join(root, file)
  const upstreamPath = join(resolve(upstream), file)
  try {
    const [local, other] = await Promise.all([readFile(localPath), readFile(upstreamPath)])
    const a = createHash('sha256').update(local).digest('hex')
    const b = createHash('sha256').update(other).digest('hex')
    if (a !== b) { console.error(`core sync mismatch: ${file}`); process.exit(1) }
  } catch {
    console.error(`core sync missing: ${file}`); process.exit(1)
  }
}
console.log(`core sync ok (${files.length} explicit files)`)

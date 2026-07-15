# QiongQi Task Continuity Kernel V3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the delegating Kernel v3 shell with a real persisted execution graph whose authoritative TaskState survives compaction, provider discontinuity, process restart, and legacy-thread migration without crossing owner or task boundaries.

**Architecture:** Add a versioned TaskState contract and CAS store keyed by full RunIdentity, then make RuntimeKernel execute concrete restore/context/model/evaluate/tool/recovery/commit nodes. Compaction summaries become derived model views committed atomically with TaskState revisions; classic remains an explicit runtime-factory branch and is never invoked inside kernel_v3.

**Tech Stack:** TypeScript 5.8, Zod, pnpm workspaces, Vitest, JSON/JSONL atomic file adapters, existing ModelClient/ToolHost/TurnService/RuntimeEventRecorder ports, existing HTTP/SSE compatibility shell.

**Specification:** `docs/superpowers/specs/2026-07-15-task-continuity-and-desktop-artifact-navigation-design.md`

---

## File Responsibility Map

- `packages/foundation/contracts/src/task-state.ts`: persisted TaskState schema, action/artifact/tool-ledger schemas, constructors, identity checks.
- `packages/ports-layer/ports/src/task-state.ts`: TaskState store CAS and migration-record ports.
- `packages/adapters/adapter-storage/src/{in-memory,file}-task-state-store.ts`: scoped TaskState persistence.
- `packages/engine/loop/src/task-state-builder.ts`: deterministic creation from current turn facts.
- `packages/engine/loop/src/legacy-task-state-migrator.ts`: one-time reconstruction from trusted legacy thread/history data.
- `packages/engine/loop/src/compaction-transaction.ts`: prepare/validate/commit boundary for TaskState plus compaction item.
- `packages/engine/loop/src/kernel-v3-graph.ts`: production graph definition only.
- `packages/engine/loop/src/kernel-v3-node-handlers.ts`: node behavior and dependencies.
- `packages/engine/loop/src/task-context-projection.ts`: bounded model-facing projection of TaskState.
- `packages/engine/loop/src/proposal-classifier.ts`: provider-neutral proposal class; no loop decisions.
- `packages/engine/loop/src/context-recovery.ts`: recovery entry and structured recovery transitions.
- `packages/engine/loop/src/runtime-kernel.ts`: graph interpreter, checkpoint/replay, middleware commands, terminal monotonicity.
- `packages/http-layer/http/src/runtime-factory.ts`: explicit classic/kernel composition, no hidden delegate.
- `tests/task-continuity-production-path.test.ts`: end-to-end composition regression.
- `tests/task-state-*.test.ts`: contracts, stores, migration, compaction, and isolation.
- `tests/runtime-kernel-*.test.ts`: graph, crash, provider, and parity gates.

All shared files and tests are implemented first in `/Users/libing/kk_Projects/KWorks/qiongqi`, then mirrored byte-for-byte into `/Users/libing/kk_Projects/QiongQi` before the task commit.

## Task 1: Prove the production topology is currently wrong

**Files:**
- Create: `qiongqi/tests/task-continuity-production-path.test.ts`
- Modify: `qiongqi/tests/kernel-turn-runner.test.ts`
- Modify: `qiongqi/tests/runtime-factory-rollout.test.ts`

- [ ] **Step 1: Add a failing topology test**

Add a source-level guard and a composition assertion:

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('kernel v3 production topology', () => {
  it('does not delegate the entire turn to classic orchestration', () => {
    const source = readFileSync(resolve('packages/http-layer/http/src/runtime-factory.ts'), 'utf8')
    expect(source).not.toContain('delegate: (threadId, turnId) => classic.runTurn(threadId, turnId)')
    expect(source).toContain('createKernelV3TurnRunner')
  })

  it('uses the production multi-node graph', async () => {
    const { productionKernelV3Graph } = await import('@qiongqi/loop')
    expect(productionKernelV3Graph().nodes.map((node) => node.id)).toEqual([
      'prepare-turn', 'restore-task', 'build-context', 'invoke-model',
      'normalize-proposal', 'evaluate', 'commit-assistant', 'prepare-tools',
      'commit-tools', 'recover-context', 'wait-user', 'fail'
    ])
  })
})
```

- [ ] **Step 2: Run RED**

Run:

```bash
cd /Users/libing/kk_Projects/KWorks/qiongqi
pnpm exec vitest run tests/task-continuity-production-path.test.ts tests/kernel-turn-runner.test.ts tests/runtime-factory-rollout.test.ts
```

Expected: FAIL because `createKernelV3TurnRunner` and `productionKernelV3Graph` do not exist and runtime-factory still contains the classic delegate.

- [ ] **Step 3: Record the baseline without changing production**

Document the exact RED output in `progress.md`; do not weaken the test or add a temporary alias.

- [ ] **Step 4: Commit the characterization test**

```bash
git add tests/task-continuity-production-path.test.ts tests/kernel-turn-runner.test.ts tests/runtime-factory-rollout.test.ts
git commit -m "test: expose delegating kernel production path"
```

Mirror and commit the same tests upstream.

## Task 2: Define authoritative TaskState contracts

**Files:**
- Create: `qiongqi/packages/foundation/contracts/src/task-state.ts`
- Modify: `qiongqi/packages/foundation/contracts/src/index.ts`
- Create: `qiongqi/tests/task-state-contracts.test.ts`

- [ ] **Step 1: Write failing schema tests**

```ts
import { describe, expect, it } from 'vitest'
import { makeTaskState, TaskStateV1Schema } from '@qiongqi/contracts'

const identity = { ownerUserId: 'u1', workspaceKey: '/w1', threadId: 't1', turnId: 'tu1', runId: 'r1' }

describe('TaskStateV1', () => {
  it('requires full run identity and a source objective item', () => {
    const task = makeTaskState({
      identity, revision: 1,
      source: { objectiveItemId: 'item-user-1', sourceItemIds: ['item-user-1'], sourceDigest: 'digest-1' },
      objective: '完成宁德时代深度分析', constraints: [], completedActions: [], pendingActions: [],
      activeSkillIds: ['kk-stock-analysis'], artifacts: [], toolLedger: [],
      createdAt: '2026-07-15T00:00:00.000Z', updatedAt: '2026-07-15T00:00:00.000Z'
    })
    expect(task.identity).toEqual(identity)
    expect(task.revision).toBe(1)
  })

  it('rejects an empty objective and duplicate action ids', () => {
    const value = {
      version: 1, identity, revision: 1,
      source: { objectiveItemId: 'i1', sourceItemIds: ['i1'], sourceDigest: 'd1' },
      objective: '', constraints: [],
      completedActions: [{ id: 'a1', text: 'done', status: 'completed' }, { id: 'a1', text: 'again', status: 'completed' }],
      pendingActions: [], activeSkillIds: [], artifacts: [], toolLedger: [],
      createdAt: 'now', updatedAt: 'now'
    }
    expect(TaskStateV1Schema.safeParse(value).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run tests/task-state-contracts.test.ts
```

Expected: FAIL because the module and exports are absent.

- [ ] **Step 3: Implement the contract**

Create schemas with these exact public shapes:

```ts
export const TaskActionSchema = z.object({
  id: NonEmptyString,
  text: NonEmptyString,
  status: z.enum(['pending', 'in_progress', 'completed', 'failed', 'blocked']),
  evidenceItemIds: z.array(NonEmptyString).default([])
}).strict()

export const TaskArtifactRefSchema = z.object({
  path: NonEmptyString,
  kind: z.enum(['file', 'artifact', 'report', 'dashboard']),
  producedByCallId: NonEmptyString.optional()
}).strict()

export const TaskToolLedgerEntrySchema = z.object({
  callId: NonEmptyString,
  toolName: NonEmptyString,
  status: z.enum(['prepared', 'committed', 'failed', 'suspended']),
  resultDigest: NonEmptyString.optional()
}).strict()

export const TaskStateV1Schema = z.object({
  version: z.literal(1),
  identity: RunIdentitySchema,
  revision: z.number().int().positive(),
  source: z.object({
    objectiveItemId: NonEmptyString,
    sourceItemIds: z.array(NonEmptyString).min(1),
    sourceDigest: NonEmptyString
  }).strict(),
  objective: NonEmptyString,
  constraints: z.array(NonEmptyString),
  completedActions: z.array(TaskActionSchema),
  pendingActions: z.array(TaskActionSchema),
  activePlan: z.object({ planId: NonEmptyString, relativePath: NonEmptyString.optional() }).strict().optional(),
  activeSkillIds: z.array(NonEmptyString),
  artifacts: z.array(TaskArtifactRefSchema),
  toolLedger: z.array(TaskToolLedgerEntrySchema),
  waitingFor: z.object({ kind: z.enum(['approval', 'user_input', 'effect_verification']), id: NonEmptyString }).strict().optional(),
  migration: z.object({ source: z.literal('legacy_thread'), sourceDigest: NonEmptyString, confidence: z.enum(['high', 'medium']) }).strict().optional(),
  createdAt: NonEmptyString,
  updatedAt: NonEmptyString
}).strict().superRefine(rejectDuplicateActionAndCallIds)

export type TaskStateV1 = z.infer<typeof TaskStateV1Schema>
export function makeTaskState(input: Omit<TaskStateV1, 'version'>): TaskStateV1 {
  return TaskStateV1Schema.parse({ version: 1, ...input })
}
```

- [ ] **Step 4: Run GREEN and typecheck**

```bash
pnpm exec vitest run tests/task-state-contracts.test.ts
pnpm --filter @qiongqi/contracts run typecheck
```

Expected: PASS.

- [ ] **Step 5: Sync and commit**

Commit `feat: define authoritative task state contracts` in both repositories.

## Task 3: Add scoped CAS TaskState stores

**Files:**
- Create: `qiongqi/packages/ports-layer/ports/src/task-state.ts`
- Modify: `qiongqi/packages/ports-layer/ports/src/index.ts`
- Create: `qiongqi/packages/adapters/adapter-storage/src/in-memory-task-state-store.ts`
- Create: `qiongqi/packages/adapters/adapter-storage/src/file-task-state-store.ts`
- Modify: `qiongqi/packages/adapters/adapter-storage/src/index.ts`
- Create: `qiongqi/tests/task-state-store.test.ts`

- [ ] **Step 1: Write failing CAS and isolation tests**

```ts
it('rejects stale task revisions', async () => {
  const store = new InMemoryTaskStateStore()
  const first = await store.prepare(task(1), 0)
  await store.commit(first)
  await expect(store.prepare(task(2), 0)).rejects.toThrow('task revision conflict')
  const second = await store.prepare(task(2), 1)
  await store.commit(second)
  expect((await store.load(identity))?.revision).toBe(2)
})

it('isolates identical ids by owner and workspace', async () => {
  const store = new InMemoryTaskStateStore()
  const prepared = await store.prepare(task(1), 0)
  await store.commit(prepared)
  expect(await store.load({ ...identity, ownerUserId: 'u2' })).toBeUndefined()
  expect(await store.load({ ...identity, workspaceKey: '/w2' })).toBeUndefined()
})
```

Add a file-store test that creates two instances, saves revision 1, then proves only one concurrent revision-2 CAS succeeds.

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run tests/task-state-store.test.ts
```

Expected: FAIL because the store port and adapters are absent.

- [ ] **Step 3: Define the port**

```ts
export type TaskStatePreparedRevision = {
  identity: RunIdentity
  revision: number
  expectedRevision: number
  token: string
}

export type TaskStateMigrationRecord = {
  identity: RunIdentity
  sourceDigest: string
  taskRevision: number
  migratedAt: string
}

export interface TaskStateStore {
  load(identity: RunIdentity): Promise<TaskStateV1 | undefined>
  prepare(state: TaskStateV1, expectedRevision: number): Promise<TaskStatePreparedRevision>
  commit(prepared: TaskStatePreparedRevision): Promise<void>
  abort(prepared: TaskStatePreparedRevision): Promise<void>
  listForThread(scope: Pick<RunIdentity, 'ownerUserId' | 'workspaceKey' | 'threadId'>): Promise<TaskStateV1[]>
  appendMigrationRecord(record: TaskStateMigrationRecord): Promise<void>
}
```

- [ ] **Step 4: Implement in-memory and file adapters**

Use `runtimeScopeDigest(identity)` as the in-memory key and file directory. `prepare()` validates the active revision and writes an immutable revision file without changing the active pointer. `commit()` atomically replaces `active.json` only when its expected previous revision still matches. File CAS must use a cross-process lock created with `open(lockPath, 'wx')`, bounded retry, stale-lock expiry, and `finally` cleanup; an adapter-local Promise queue alone is insufficient.

Store files at:

```text
<runtime-v3-root>/task-state/<runtimeScopeDigest>/revisions/<revision>-<token>.json
<runtime-v3-root>/task-state/<runtimeScopeDigest>/active.json
<runtime-v3-root>/task-migrations.jsonl
```

`load()` reads only the revision referenced by `active.json`, so an interrupted prepare cannot become authoritative. `abort()` removes an unreferenced prepared revision best-effort; abandoned files may also be removed by retention cleanup.

Do not store raw owner, workspace, or objective in directory names.

- [ ] **Step 5: Run GREEN and typecheck**

```bash
pnpm exec vitest run tests/task-state-store.test.ts
pnpm --filter @qiongqi/ports run typecheck
pnpm --filter @qiongqi/adapter-storage run typecheck
```

- [ ] **Step 6: Sync and commit**

Commit `feat: persist scoped task state revisions` in both repositories.

## Task 4: Build and migrate TaskState from trusted facts

**Files:**
- Create: `qiongqi/packages/engine/loop/src/task-state-builder.ts`
- Create: `qiongqi/packages/engine/loop/src/legacy-task-state-migrator.ts`
- Modify: `qiongqi/packages/engine/loop/src/index.ts`
- Create: `qiongqi/tests/task-state-builder.test.ts`
- Create: `qiongqi/tests/legacy-task-state-migration.test.ts`

- [ ] **Step 1: Write failing objective-authority tests**

```ts
it('keeps the latest substantive user task instead of continue or assistant text', () => {
  const state = buildTaskState({
    identity,
    thread: threadWithGoal(undefined),
    turn: currentTurn,
    items: [user('分析宁德时代并输出 MD 和 HTML'), assistant('下一步分析股指期货'), user('继续')],
    nowIso: () => '2026-07-15T00:00:00.000Z'
  })
  expect(state.objective).toContain('宁德时代')
  expect(state.objective).not.toContain('股指期货')
})

it('does not use an unverifiable compaction summary as objective', async () => {
  const result = await migrateLegacyTaskState({ identity, thread, items: [legacyCompactionWithoutDigest], store, nowIso })
  expect(result.kind).toBe('insufficient_trusted_source')
})
```

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run tests/task-state-builder.test.ts tests/legacy-task-state-migration.test.ts
```

- [ ] **Step 3: Implement deterministic builder**

`buildTaskState()` must select objective in this order: current turn user item, active thread goal, latest substantive user item. It must ignore continuation-only messages and every assistant item. Build completed/pending actions from explicit todos and committed tool ledger only. Compute `sourceDigest` from canonicalized source item ids plus texts.

Public signature:

```ts
export function buildTaskState(input: {
  identity: RunIdentity
  thread: ThreadRecord
  turn: Turn
  items: readonly TurnItem[]
  activeSkillIds?: readonly string[]
  nowIso: () => string
}): TaskStateV1
```

- [ ] **Step 4: Implement idempotent legacy migration**

```ts
export type LegacyMigrationResult =
  | { kind: 'created'; state: TaskStateV1 }
  | { kind: 'existing'; state: TaskStateV1 }
  | { kind: 'insufficient_trusted_source'; reason: string }
  | { kind: 'scope_violation'; reason: string }
```

Verify thread owner/workspace first. If a state already exists, return it. If source ids/digest exist, verify them against loaded items. Never copy a task from another thread. Write a migration record only after `prepare()` and `commit()` succeed.

- [ ] **Step 5: Run GREEN**

```bash
pnpm exec vitest run tests/task-state-builder.test.ts tests/legacy-task-state-migration.test.ts
```

- [ ] **Step 6: Sync and commit**

Commit `feat: build and migrate trusted task state` in both repositories.

## Task 5: Expand RuntimeKernel for real graph data and replay

**Files:**
- Modify: `qiongqi/packages/foundation/contracts/src/runtime-kernel.ts`
- Modify: `qiongqi/packages/engine/loop/src/runtime-kernel-context.ts`
- Modify: `qiongqi/packages/engine/loop/src/runtime-middleware.ts`
- Modify: `qiongqi/packages/engine/loop/src/runtime-kernel.ts`
- Create: `qiongqi/packages/engine/loop/src/kernel-v3-graph.ts`
- Modify: `qiongqi/packages/engine/loop/src/index.ts`
- Modify: `qiongqi/tests/runtime-kernel.test.ts`
- Create: `qiongqi/tests/runtime-kernel-replay.test.ts`

- [ ] **Step 1: Write failing node-value and replay tests**

Test that node output is persisted in `RunStateV3.nodeData`, checkpoint policy is respected, and events after `checkpointSeq` are reduced before the next node runs. Test terminal state cannot transition back to running.

```ts
expect(restored.nodeData['restore-task']).toEqual({ taskRevision: 2 })
expect(restored.status).toBe('completed')
await expect(kernel.run(identity)).resolves.toEqual(restored.outcome)
```

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run tests/runtime-kernel.test.ts tests/runtime-kernel-replay.test.ts
```

- [ ] **Step 3: Extend state and commands**

Add JSON-safe fields:

```ts
nodeData: z.record(z.string(), z.unknown()).default({}),
taskRevision: z.number().int().nonnegative().default(0)
```

Add commands:

```ts
| { type: 'set-node-data'; nodeId: string; value: unknown }
| { type: 'set-task-revision'; revision: number }
| { type: 'jump'; nodeId: string; condition: string; reason: string }
| { type: 'suspend'; outcome: RunOutcome }
```

- [ ] **Step 4: Implement event replay and checkpoint policy**

Before executing a node, load `events.listAfter(identity, state.cursor.checkpointSeq)`, reduce known kernel events, reject identity mismatches, and save the replayed state. Save only at node checkpoint boundaries declared by `node.checkpoint`; always save on effect prepare/commit and terminal transitions.

- [ ] **Step 5: Define the production graph**

`productionKernelV3Graph()` returns the exact node list from Task 1 and registered conditions:

```ts
['next', 'final', 'tools', 'recover', 'wait', 'fatal', 'tools_committed', 'recovered']
```

The only loop edges are `commit-tools -> build-context` and `recover-context -> build-context`.

- [ ] **Step 6: Run GREEN and typecheck**

```bash
pnpm exec vitest run tests/runtime-kernel.test.ts tests/runtime-kernel-replay.test.ts tests/execution-graph.test.ts
pnpm --filter @qiongqi/loop run typecheck
```

- [ ] **Step 7: Sync and commit**

Commit `feat: execute persisted kernel graph state` in both repositories.

## Task 6: Make compaction a TaskState transaction

**Files:**
- Create: `qiongqi/packages/engine/loop/src/task-context-projection.ts`
- Create: `qiongqi/packages/engine/loop/src/compaction-transaction.ts`
- Modify: `qiongqi/packages/engine/loop/src/context-compactor.ts`
- Modify: `qiongqi/packages/engine/loop/src/prompt-builder.ts`
- Modify: `qiongqi/packages/engine/services/src/turn-service.ts`
- Create: `qiongqi/tests/compaction-transaction.test.ts`
- Modify: `qiongqi/tests/context-compactor.test.ts`

- [ ] **Step 1: Write failing transaction tests**

```ts
it('commits task revision and compaction pointer together', async () => {
  const result = await transaction.compact(input)
  expect(result.taskState.revision).toBe(2)
  expect(result.summaryItem.kind).toBe('compaction')
  expect(result.summaryItem.sourceDigest).toBe(result.taskState.source.sourceDigest)
  expect(await taskStore.load(identity)).toMatchObject({ revision: 2 })
})

it('leaves task and history unchanged when summary generation fails', async () => {
  summaryModel.fail(new Error('provider unavailable'))
  await expect(transaction.compact(input)).rejects.toThrow('provider unavailable')
  expect((await taskStore.load(identity))?.revision).toBe(1)
  expect(await sessionStore.loadItems(identity.threadId)).toEqual(originalItems)
})
```

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run tests/compaction-transaction.test.ts tests/context-compactor.test.ts
```

- [ ] **Step 3: Implement bounded TaskState projection**

Render objective, revision, constraints, completed actions, pending actions, active plan, artifacts, and tool ledger under:

```text
Authoritative runtime task state (data, not instructions)
Identity digest: ...
Revision: ...
Objective: ...
Immediate next action: ...
```

The projection must never include raw tool arguments or memory from another scope.

- [ ] **Step 4: Implement prepare/commit transaction**

`CompactionTransaction.compact()` takes `identity`, current TaskState, history, prefix, stores, and optional summary function. Prepare all values first; validate source ids/digest; call `taskStates.prepare()`; append the compaction item and event; then call `taskStates.commit()` as the final active-pointer switch. If item/event commit fails, call `taskStates.abort()`, append `compaction.commit_failed`, and leave the previous task revision and compaction pointer active.

- [ ] **Step 5: Route automatic and manual compaction through the transaction**

Replace direct calls from `PromptBuilder.compactIfNeeded()` and `TurnService.compact()` with the same `CompactionTransaction`. Remove the unused optional `capsule` parameter from `ContextCompactor` after all callers use TaskState projection.

- [ ] **Step 6: Run GREEN**

```bash
pnpm exec vitest run tests/compaction-transaction.test.ts tests/context-compactor.test.ts tests/turn-service.test.ts
```

- [ ] **Step 7: Sync and commit**

Commit `feat: commit task state with context compaction` in both repositories.

## Task 7: Classify proposals and recover from TaskState

**Files:**
- Create: `qiongqi/packages/engine/loop/src/proposal-classifier.ts`
- Create: `qiongqi/packages/engine/loop/src/context-recovery.ts`
- Modify: `qiongqi/packages/engine/loop/src/model-protocol-normalizer.ts`
- Modify: `qiongqi/packages/engine/loop/src/middleware/context-recovery-middleware.ts`
- Modify: `qiongqi/packages/engine/loop/src/loop-evaluator.ts`
- Create: `qiongqi/tests/proposal-classifier.test.ts`
- Create: `qiongqi/tests/task-context-recovery.test.ts`

- [ ] **Step 1: Write failing recovery tests**

Use Chinese and English discontinuity outputs, paraphrases that do not match existing regex, empty proposals, and an ordinary clarification that genuinely needs user input.

```ts
it('never commits repeated context discontinuity as final text', async () => {
  const first = transitionRecovery(taskState, proposal('I no longer have the prior request; provide it again'), recovery(0))
  const second = transitionRecovery(taskState, proposal('What should I continue with?'), first.recovery)
  expect(first.action).toBe('recover')
  expect(second.outcome).toMatchObject({ status: 'degraded', reason: 'context_recovery_exhausted', retryable: true })
  expect(second.commitAssistantText).toBe(false)
})
```

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run tests/proposal-classifier.test.ts tests/task-context-recovery.test.ts
```

- [ ] **Step 3: Implement provider-neutral proposal classes**

```ts
export type ProposalClass =
  | 'final_text' | 'tool_intents' | 'empty' | 'length_limited'
  | 'safety_or_refusal' | 'protocol_error' | 'context_discontinuity'

export function classifyProposal(input: {
  proposal: ModelProposal
  task: TaskStateV1
  providerSignals?: readonly string[]
}): ProposalClass
```

Use normalized stop/integrity metadata first. A bounded multilingual discontinuity detector may classify the proposal, but it returns data only; it cannot retry, stop, or create user-visible text.

- [ ] **Step 4: Implement recovery transition and entry**

```ts
export function transitionContextRecovery(input: {
  task: TaskStateV1
  recovery: RecoveryState
  proposalClass: ProposalClass
}): { action: 'accept' | 'recover' | 'degrade'; recovery: RecoveryState; outcome?: RunOutcome }
```

`renderRecoveryContinuationEntry(task)` includes exactly one immediate pending action, completed actions, artifacts, and task revision. It does not ask the model to infer the task.

- [ ] **Step 5: Demote classic regex handling to compatibility only**

Keep `looksLikeContextLossClarification()` solely for explicit classic mode. Kernel node handlers must import `classifyProposal` and `transitionContextRecovery`, not `defaultLoopEvaluator`.

- [ ] **Step 6: Run GREEN**

```bash
pnpm exec vitest run tests/proposal-classifier.test.ts tests/task-context-recovery.test.ts tests/loop-evaluator.test.ts
```

- [ ] **Step 7: Sync and commit**

Commit `feat: recover kernel tasks from structured state` in both repositories.

## Task 8: Implement production Kernel node handlers

**Files:**
- Create: `qiongqi/packages/engine/loop/src/kernel-v3-node-handlers.ts`
- Create: `qiongqi/packages/engine/loop/src/kernel-v3-turn-runner.ts`
- Modify: `qiongqi/packages/engine/loop/src/index.ts`
- Create: `qiongqi/tests/kernel-v3-node-handlers.test.ts`
- Create: `qiongqi/tests/kernel-v3-turn-runner.test.ts`

- [ ] **Step 1: Write failing graph-path tests**

Cover final text, tool loop, context recovery, waiting user input, fatal provider error, and abort. Assert each path's node sequence from recorded `node.started` events.

```ts
expect(nodeSequence(events)).toEqual([
  'prepare-turn', 'restore-task', 'build-context', 'invoke-model',
  'normalize-proposal', 'evaluate', 'commit-assistant'
])
```

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run tests/kernel-v3-node-handlers.test.ts tests/kernel-v3-turn-runner.test.ts
```

- [ ] **Step 3: Define explicit dependencies**

```ts
export type KernelV3NodeDependencies = {
  threadStore: ThreadStore
  sessionStore: SessionStore
  taskStates: TaskStateStore
  turns: TurnService
  events: RuntimeEventRecorder
  promptBuilder: PromptBuilder
  proposalRunner: ModelProposalRunner
  toolRuntime: ToolRuntimeV3
  compaction: CompactionTransaction
  ids: IdGenerator
  nowIso: () => string
}
```

- [ ] **Step 4: Implement handlers**

Each handler reads only its declared `nodeData`, returns commands/condition/value, and performs effects only in effect nodes. `commit-assistant` materializes a completed assistant item exactly once using an idempotency key. `restore-task` loads or migrates TaskState. `evaluate` never calls model, tools, or stores.

- [ ] **Step 5: Implement KernelV3TurnRunner**

Runner responsibilities are limited to identity resolution, Kernel construction, run invocation, and mapping structured outcome to legacy turn status. It must not accept a classic delegate.

- [ ] **Step 6: Run GREEN**

```bash
pnpm exec vitest run tests/kernel-v3-node-handlers.test.ts tests/kernel-v3-turn-runner.test.ts tests/runtime-kernel.test.ts
```

- [ ] **Step 7: Sync and commit**

Commit `feat: run turns through kernel v3 graph nodes` in both repositories.

## Task 9: Persist effect results and make tool replay complete

**Files:**
- Modify: `qiongqi/packages/foundation/contracts/src/runtime-kernel.ts`
- Modify: `qiongqi/packages/ports-layer/ports/src/runtime-kernel.ts`
- Create: `qiongqi/packages/adapters/adapter-storage/src/file-effect-result-store.ts`
- Create: `qiongqi/packages/adapters/adapter-storage/src/in-memory-effect-result-store.ts`
- Modify: `qiongqi/packages/engine/loop/src/effect-commit.ts`
- Modify: `qiongqi/packages/engine/loop/src/tool-runtime-v3.ts`
- Modify: `qiongqi/tests/runtime-kernel-crash-recovery.test.ts`
- Create: `qiongqi/tests/effect-result-store.test.ts`

- [ ] **Step 1: Write failing restart replay tests**

Create one coordinator, commit a result, discard it, create a second coordinator over the same file store, and assert the second returns the committed result without executing the tool.

```ts
expect(executeCount).toBe(1)
expect(second.replayed).toBe(true)
expect(second.result).toEqual(first.result)
```

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run tests/effect-result-store.test.ts tests/runtime-kernel-crash-recovery.test.ts
```

Expected: FAIL because `EffectCommitCoordinator.resultCache` is process-local.

- [ ] **Step 3: Add EffectResultStore**

```ts
export interface EffectResultStore {
  load(identity: RunIdentity, idempotencyKey: string): Promise<{ resultDigest: string; result: unknown } | undefined>
  save(identity: RunIdentity, idempotencyKey: string, resultDigest: string, result: unknown): Promise<void>
}
```

File storage uses full scope digest and a hash of idempotencyKey. Validate result digest on read.

- [ ] **Step 4: Remove process-local result authority**

Delete `resultCache`. `commit()` persists result before `effect.committed`; replay loads and validates it. A prepared non-idempotent effect with no committed result suspends for verification and is never executed automatically.

- [ ] **Step 5: Run GREEN**

```bash
pnpm exec vitest run tests/effect-result-store.test.ts tests/effect-commit.test.ts tests/tool-runtime-v3.test.ts tests/runtime-kernel-crash-recovery.test.ts
```

- [ ] **Step 6: Sync and commit**

Commit `feat: persist kernel effect results for replay` in both repositories.

## Task 10: Wire real Kernel v3 in runtime factory

**Files:**
- Modify: `qiongqi/packages/http-layer/http/src/runtime-factory.ts`
- Delete: `qiongqi/packages/engine/loop/src/kernel-turn-runner.ts`
- Modify: `qiongqi/packages/engine/loop/src/index.ts`
- Modify: `qiongqi/tests/task-continuity-production-path.test.ts`
- Modify: `qiongqi/tests/runtime-factory-rollout.test.ts`
- Modify: `qiongqi/tests/http-server.test.ts`

- [ ] **Step 1: Add failing composition assertions**

Assert runtime factory injects FileTaskStateStore, FileEffectResultStore, production graph, middleware chain, ModelProposalRunner, CompactionTransaction, and KernelV3TurnRunner. Assert explicit classic creates TurnOrchestrator and no Kernel stores.

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run tests/task-continuity-production-path.test.ts tests/runtime-factory-rollout.test.ts tests/http-server.test.ts
```

- [ ] **Step 3: Extract `createKernelV3TurnRunner()`**

```ts
export function createKernelV3TurnRunner(input: {
  options: QiongqiServeRuntimeOptions
  core: CoreRuntime
  orch: KernelV3OrchestrationDependencies
}): KernelV3TurnRunner
```

Construct all V3 stores under `<dataDir>/runtime-v3`, build the production graph and default middleware, and pass explicit dependencies. Do not instantiate TurnOrchestrator in this function.

- [ ] **Step 4: Keep classic as a separate branch**

```ts
const loop = orchestrationMode === 'kernel_v3'
  ? createKernelV3TurnRunner({ options, core, orch: kernelDependencies })
  : orchestrationMode === 'evented_v2'
    ? createEventedTurnRunner(...)
    : new TurnOrchestrator(classicOptions)
```

Delete the delegating runner and update exports.

- [ ] **Step 5: Run GREEN**

```bash
pnpm exec vitest run tests/task-continuity-production-path.test.ts tests/runtime-factory-rollout.test.ts tests/http-server.test.ts
pnpm --filter @qiongqi/http run typecheck
pnpm --filter @qiongqi/loop run typecheck
```

- [ ] **Step 6: Sync and commit**

Commit `feat: activate real kernel v3 orchestration` in both repositories.

## Task 11: Complete full-scope isolation audit

**Files:**
- Modify: `qiongqi/packages/engine/loop/src/prompt-builder.ts`
- Modify: `qiongqi/packages/engine/loop/src/effect-commit.ts`
- Modify: `qiongqi/packages/adapters/adapter-storage/src/file-run-state-store.ts`
- Modify: `qiongqi/packages/adapters/adapter-storage/src/in-memory-run-state-store.ts`
- Modify: other files identified by the audit command below
- Create: `qiongqi/tests/runtime-scope-audit.test.ts`

- [ ] **Step 1: Audit mutable maps and unscoped store keys**

Run:

```bash
rg -n "new Map|new Set|\.set\(|\.get\(|leases.*runId|join\([^\n]*threadId|join\([^\n]*runId" packages/engine packages/adapters packages/capabilities
```

Classify every mutable map as immutable catalog, process-global infrastructure, or run-scoped state. Add each run-scoped key to a table in the test fixture.

- [ ] **Step 2: Write failing collision tests**

Use identical thread/turn/run ids with different owners and workspaces. Exercise prompt pressure, model route, tool catalog, recovery, loop window, lease, task state, effect result, and memory.

- [ ] **Step 3: Introduce one key helper**

```ts
export function runtimeMutableStateKey(identity: RunIdentity, purpose: ScopePurpose): string {
  return encodeScopeKey({ ...identity, purpose })
}
```

Replace threadId/runId-only keys. Change RunLeaseStore methods to accept RunIdentity rather than runId, then update file lease paths to the full scope digest.

- [ ] **Step 4: Run GREEN**

```bash
pnpm exec vitest run tests/runtime-scope-audit.test.ts tests/runtime-kernel-isolation.test.ts tests/memory-owner-isolation.test.ts tests/memory-retrieval.test.ts
```

- [ ] **Step 5: Sync and commit**

Commit `fix: enforce full scope on mutable runtime state` in both repositories.

## Task 12: Add provider, migration, crash, and production gates

**Files:**
- Modify: `qiongqi/tests/runtime-kernel-provider-matrix.test.ts`
- Modify: `qiongqi/tests/runtime-kernel-crash-recovery.test.ts`
- Modify: `qiongqi/tests/runtime-kernel-isolation.test.ts`
- Modify: `qiongqi/tests/runtime-kernel-e2e.test.ts`
- Modify: `qiongqi/tests/runtime-kernel-parity.test.ts`
- Modify: `qiongqi/scripts/verify-core-sync.mjs`
- Modify: `qiongqi/docs/architecture.en.md`
- Modify: `qiongqi/docs/architecture.zh.md`

- [ ] **Step 1: Add normalized provider fixtures**

For DeepSeek, official MiniMax M3, Kimi, local vLLM, and OpenRouter, include normal final, native tool call, empty stop, context discontinuity, leaked protocol, malformed arguments, safety, length, and transport failure. Assert proposal class, node path, committed items, tool execution count, and structured outcome.

- [ ] **Step 2: Add crash matrix**

Inject crashes after model proposal, compaction prepare, compaction commit, tool prepare, tool execution, tool commit, task revision commit, and final item commit. Restart with new store/runner instances and assert no duplicate side effects/items/events.

- [ ] **Step 3: Add legacy migration fixtures**

Cover substantive task plus “继续”, incorrect assistant next task, valid old digest, missing digest, owner mismatch, two parallel threads, fork, and child run.

- [ ] **Step 4: Run focused GREEN**

```bash
pnpm exec vitest run \
  tests/task-continuity-production-path.test.ts \
  tests/runtime-kernel-provider-matrix.test.ts \
  tests/runtime-kernel-crash-recovery.test.ts \
  tests/runtime-kernel-isolation.test.ts \
  tests/runtime-kernel-e2e.test.ts \
  tests/runtime-kernel-parity.test.ts \
  tests/legacy-task-state-migration.test.ts
```

- [ ] **Step 5: Run full repository verification**

```bash
pnpm test
pnpm run typecheck
pnpm run build
QIONGQI_UPSTREAM_DIR=/Users/libing/kk_Projects/QiongQi node scripts/verify-core-sync.mjs
```

Run the same test/typecheck/build commands in `/Users/libing/kk_Projects/QiongQi`.

- [ ] **Step 6: Update architecture docs and commit**

Document TaskState authority, the real graph, migration rules, structured recovery, and explicit classic fallback. Commit `test: gate task continuity kernel production rollout` in both repositories.

## Final Verification Checklist

- [ ] Default kernel_v3 contains no full-turn classic delegate.
- [ ] Automatic and manual compaction use the same TaskState transaction.
- [ ] Two consecutive context discontinuities never commit the provider's restatement request.
- [ ] Process restart loads TaskState and committed effect results from disk.
- [ ] Old thread migration preserves the latest trusted user objective.
- [ ] Owner/workspace/thread/turn/run collision tests pass.
- [ ] Provider fixtures pass without live network calls.
- [ ] KWorks and upstream QiongQi core sync verifier passes.
- [ ] Both repositories are on `main` with no task-created branches or worktrees.

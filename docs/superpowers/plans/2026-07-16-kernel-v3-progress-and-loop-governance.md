# Kernel v3 Progress and Loop Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist and display provider reasoning or engine progress while preventing tool and compaction storms through run-scoped budgets, progress projection, and multi-signal governance.

**Architecture:** Extend Kernel v3 with deterministic proposal materialization, budget accounting, structured tool observations, TaskState projection, a persisted LoopGovernor, and an effectiveness-aware CompactionGovernor. Shared contracts and engine code remain identical in KWorks `qiongqi/` and `/Users/libing/kk_Projects/QiongQi`; KWorks alone owns frontend rendering and packaged desktop verification.

**Tech Stack:** TypeScript, Zod, Vitest, React 19, Next.js, Electron, pnpm, JSONL/file-backed Kernel v3 stores.

---

## File Map

Shared QiongQi files modified in both repositories:

- `packages/foundation/contracts/src/runtime-kernel.ts`: budget commands, outcome reasons, governor state contracts, model proposal usage.
- `packages/foundation/contracts/src/items.ts`: `runtime_progress` TurnItem contract.
- `packages/foundation/contracts/src/task-state.ts`: progress metadata and structured evidence references.
- `packages/ports-layer/ports/src/tool-host.ts`: ToolHost semantic metadata and ToolObservation inputs.
- `packages/engine/loop/src/model-proposal-runner.ts`: aggregate one model call's usage into its proposal result.
- `packages/engine/loop/src/runtime-middleware.ts`: atomic budget increments and structured facts.
- `packages/engine/loop/src/runtime-kernel-context.ts`: node results expose persisted middleware facts.
- `packages/engine/loop/src/runtime-kernel.ts`: apply budget deltas and pass node facts through middleware.
- `packages/engine/loop/src/kernel-v3-graph.ts`: materialization, accounting, projection, checkpoint, and governance nodes.
- `packages/engine/loop/src/kernel-v3-node-handlers.ts`: production node implementations and idempotent user-visible commits.
- `packages/engine/loop/src/kernel-v3-turn-runner.ts`: production middleware injection.
- `packages/engine/loop/src/tool-runtime-v3.ts`: emit structured, replay-aware ToolObservation.
- `packages/engine/loop/src/context-compactor.ts`: predicted net savings and compaction lineage.
- `packages/engine/loop/src/prompt-builder.ts`: prompt-pressure breakdown and compaction cooldown integration.
- `packages/http-layer/http/src/runtime-factory.ts`: wire usage, governance, progress, and termination events.

Shared QiongQi files created in both repositories:

- `packages/engine/loop/src/proposal-materializer.ts`: validate and materialize proposal reasoning/text/progress.
- `packages/engine/loop/src/tool-observation.ts`: canonical tool and result fingerprints.
- `packages/engine/loop/src/task-progress-projector.ts`: CAS projection from todos/evidence/artifacts to TaskState.
- `packages/engine/loop/src/loop-governor.ts`: pure persisted multi-signal state transition.
- `packages/engine/loop/src/middleware/loop-governor-middleware.ts`: Kernel command adapter for LoopGovernor.
- `packages/engine/loop/src/compaction-governor.ts`: pure effectiveness/cooldown/lineage decision.

KWorks-only frontend files:

- `frontend/src/core/threads/qiongqi-types.ts`: mirror `runtime_progress` item.
- `frontend/src/core/threads/qiongqi-client.ts`: preserve progress as typed message metadata.
- `frontend/src/components/workspace/messages/message-steps.ts`: create a progress step separate from reasoning.
- `frontend/src/components/workspace/messages/message-group.tsx`: render collapsed “进度” and “思考” independently.
- `frontend/src/core/i18n/locales/zh-CN.ts`, `en-US.ts`, `types.ts`: progress labels.

Verification and sync files:

- `qiongqi/scripts/verify-core-sync.mjs`: include every new shared contract/engine file.
- `qiongqi/tests/*.test.ts`: focused RED/GREEN coverage described below.
- `frontend/tests/unit/core/qiongqi-stream.test.ts` and `frontend/tests/unit/components/workspace/message-group-steps.test.tsx`: item projection and rendering.

### Task 1: Add provider-neutral governance contracts

**Files:**
- Modify: `qiongqi/packages/foundation/contracts/src/runtime-kernel.ts`
- Modify: `qiongqi/packages/foundation/contracts/src/items.ts`
- Modify: `qiongqi/packages/foundation/contracts/src/task-state.ts`
- Modify: `qiongqi/packages/ports-layer/ports/src/tool-host.ts`
- Modify: `qiongqi/packages/domain-layer/domain/src/item.ts`
- Test: `qiongqi/tests/kernel-governance-contracts.test.ts`

- [ ] **Step 1: Write the failing contract tests**

```ts
it('parses runtime progress, proposal usage, and tool observations', () => {
  expect(TurnItem.safeParse(makeRuntimeProgressItem({
    id: 'item-progress', threadId: 't', turnId: 'tu', phase: 'executing',
    summary: '正在整理证据', modelSteps: 2, toolCalls: 3
  })).success).toBe(true)
  expect(ModelProposalSchema.parse({ ...proposal(), usage: usage() }).usage?.promptTokens).toBe(100)
  expect(ToolObservationSchema.parse(observation()).resourceKeys).toEqual(['/workspace/a.md'])
})

it('accepts context capacity as a structured terminal reason', () => {
  expect(RunOutcomeSchema.parse({
    status: 'degraded', reason: 'context_capacity_exceeded', retryable: true
  }).reason).toBe('context_capacity_exceeded')
})
```

- [ ] **Step 2: Run the contract test and verify RED**

Run: `pnpm --dir qiongqi exec vitest run tests/kernel-governance-contracts.test.ts`

Expected: FAIL because the schemas and `makeRuntimeProgressItem` do not exist.

- [ ] **Step 3: Add the minimal contracts and constructor**

Add these shapes, using strict Zod objects and exports through existing barrel files:

```ts
export const RuntimeProgressTurnItem = TurnItemBase.extend({
  kind: z.literal('runtime_progress'),
  phase: z.enum(['preparing', 'executing', 'checkpoint', 'summarizing', 'terminated']),
  summary: z.string().min(1),
  modelSteps: z.number().int().nonnegative(),
  toolCalls: z.number().int().nonnegative(),
  evidenceCount: z.number().int().nonnegative().default(0),
  artifactCount: z.number().int().nonnegative().default(0),
  reason: z.string().optional()
})

export const ToolObservationSchema = z.object({
  callId: NonEmptyString,
  toolName: NonEmptyString,
  effect: z.enum(['read', 'idempotent-write', 'non-idempotent-write']),
  capabilityClass: NonEmptyString,
  resourceKeys: z.array(NonEmptyString),
  canonicalArgumentsDigest: NonEmptyString,
  resultDigest: NonEmptyString,
  resultItemId: NonEmptyString,
  artifactRefs: z.array(TaskArtifactRefSchema),
  failed: z.boolean(),
  replayed: z.boolean()
}).strict()
```

Extend `ModelProposalSchema` with optional `usage: UsageSnapshotSchema`, add `context_capacity_exceeded` to `RunOutcomeReasonSchema`, and add optional `semantic` metadata to `ToolHostResult`:

```ts
semantic?: {
  capabilityClass: string
  resourceKeys: string[]
  artifactRefs?: TaskArtifactRef[]
}
```

- [ ] **Step 4: Run contracts and typecheck**

Run: `pnpm --dir qiongqi exec vitest run tests/kernel-governance-contracts.test.ts tests/contracts.test.ts && pnpm --dir qiongqi typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the contract slice**

```bash
git add qiongqi/packages/foundation qiongqi/packages/ports-layer qiongqi/packages/domain-layer qiongqi/tests/kernel-governance-contracts.test.ts
git commit -m "feat(kernel): add governance contracts"
```

### Task 2: Materialize tool-proposal reasoning before tool execution

**Files:**
- Create: `qiongqi/packages/engine/loop/src/proposal-materializer.ts`
- Modify: `qiongqi/packages/engine/loop/src/kernel-v3-graph.ts`
- Modify: `qiongqi/packages/engine/loop/src/kernel-v3-node-handlers.ts`
- Modify: `qiongqi/packages/engine/loop/src/index.ts`
- Test: `qiongqi/tests/kernel-v3-node-handlers.test.ts`
- Test: `qiongqi/tests/proposal-materializer.test.ts`

- [ ] **Step 1: Add RED tests for ordering, quarantine, and replay**

```ts
it('commits reasoning and text before a valid tool proposal executes', async () => {
  const harness = await createHarness([
    proposal({ reasoning: '先确认文件结构。', text: '我先读取数据。', stopClass: 'tool_calls',
      toolIntents: [{ callId: 'c1', toolName: 'read_data', arguments: { path: 'a.json' } }] }),
    proposal({ text: '完成。' })
  ])
  await harness.kernel.run(identity)
  expect(harness.applied.map((item) => item.kind)).toEqual([
    'assistant_reasoning', 'assistant_text', 'tool_call', 'tool_result', 'assistant_text'
  ])
})

it.each(['leakedProtocolText', 'malformedToolCall'] as const)(
  'quarantines %s proposals', async (flag) => {
    const result = materializableProposal(proposal({ integrity: integrity({ [flag]: true }) }))
    expect(result).toEqual({ reasoning: '', text: '' })
  }
)
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `pnpm --dir qiongqi exec vitest run tests/proposal-materializer.test.ts tests/kernel-v3-node-handlers.test.ts`

Expected: FAIL because tool proposals still go directly to `prepare-tools`.

- [ ] **Step 3: Implement deterministic materialization**

Create a pure validator and an idempotent commit helper:

```ts
export function materializableProposal(proposal: ModelProposal) {
  if (proposal.integrity.leakedProtocolText || proposal.integrity.malformedToolCall) {
    return { reasoning: '', text: '' }
  }
  return { reasoning: proposal.reasoning.trim(), text: proposal.text.trim() }
}
```

Add a non-terminal `materialize-proposal` node between `evaluate(tools)` and `prepare-tools`. Reuse deterministic ids `item_kernel_reasoning_${proposalId}` and `item_kernel_text_${proposalId}`. Keep recovery/fatal branches quarantined and leave `materialize-final` terminal.

- [ ] **Step 4: Verify ordering and existing recovery behavior**

Run: `pnpm --dir qiongqi exec vitest run tests/proposal-materializer.test.ts tests/kernel-v3-node-handlers.test.ts tests/task-context-recovery.test.ts`

Expected: PASS; node sequence includes `materialize-proposal` before `prepare-tools`.

- [ ] **Step 5: Commit proposal materialization**

```bash
git add qiongqi/packages/engine/loop qiongqi/tests/proposal-materializer.test.ts qiongqi/tests/kernel-v3-node-handlers.test.ts
git commit -m "fix(kernel): preserve reasoning across tool proposals"
```

### Task 3: Persist logical budgets and model usage

**Files:**
- Modify: `qiongqi/packages/engine/loop/src/model-proposal-runner.ts`
- Modify: `qiongqi/packages/engine/loop/src/runtime-middleware.ts`
- Modify: `qiongqi/packages/engine/loop/src/runtime-kernel-context.ts`
- Modify: `qiongqi/packages/engine/loop/src/runtime-kernel.ts`
- Modify: `qiongqi/packages/engine/loop/src/kernel-v3-node-handlers.ts`
- Modify: `qiongqi/packages/engine/loop/src/middleware/budget-middleware.ts`
- Create: `qiongqi/tests/model-proposal-runner.test.ts`
- Test: `qiongqi/tests/runtime-kernel-budget.test.ts`

- [ ] **Step 1: Write RED tests for aggregate usage and replay-safe counters**

```ts
it('aggregates the last provider usage into the proposal', async () => {
  const proposal = await runner([usageChunk(100, 20), completedChunk()]).run(request())
  expect(proposal.usage).toMatchObject({ promptTokens: 100, completionTokens: 20 })
})

it('counts model decisions once and each logical tool call once', async () => {
  const outcome = await harness.runToolProposalWithTwoCalls()
  expect(outcome.status).toBe('completed')
  expect((await harness.snapshot()).budgets).toMatchObject({
    stepsUsed: 2, toolCallsUsed: 2, inputTokens: 200, outputTokens: 40
  })
})
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --dir qiongqi exec vitest run tests/model-proposal-runner.test.ts tests/runtime-kernel-budget.test.ts`

Expected: FAIL with absent proposal usage and zero persisted budgets.

- [ ] **Step 3: Add atomic budget deltas**

Add this command and apply it in RuntimeKernel event reduction:

```ts
| { type: 'add-budget'; delta: Partial<BudgetState>; usageId?: string }
```

Extend `RuntimeNodeResult` and the persisted `node.completed` payload with `facts?: Record<string, unknown>`. RuntimeKernel passes the committed facts to `afterNode` middleware; replay reconstructs the same facts from the event rather than recalculating them.

`account-model` emits one delta per proposal:

```ts
{
  stepsUsed: 1,
  inputTokens: proposal.usage?.promptTokens ?? 0,
  outputTokens: proposal.usage?.completionTokens ?? 0,
  costUsd: proposal.usage?.costUsd ?? 0
}
```

`prepare-tools` increments `toolCallsUsed` by calls not already present in TaskState ledger. Store processed usage ids in versioned middleware state so event replay is idempotent.

- [ ] **Step 4: Verify budget caps and crash replay**

Run: `pnpm --dir qiongqi exec vitest run tests/runtime-kernel-budget.test.ts tests/runtime-kernel-crash-recovery.test.ts tests/runtime-middleware-governance.test.ts`

Expected: PASS; replay leaves counters unchanged and configured caps return structured outcomes.

- [ ] **Step 5: Commit budget accounting**

```bash
git add qiongqi/packages/engine/loop qiongqi/tests/model-proposal-runner.test.ts qiongqi/tests/runtime-kernel-budget.test.ts
git commit -m "feat(kernel): persist logical run budgets"
```

### Task 4: Produce structured tool observations

**Files:**
- Create: `qiongqi/packages/engine/loop/src/tool-observation.ts`
- Modify: `qiongqi/packages/engine/loop/src/tool-runtime-v3.ts`
- Modify: `qiongqi/packages/adapters/adapter-tools/src/local-tool-host.ts`
- Modify: `qiongqi/packages/engine/loop/src/index.ts`
- Test: `qiongqi/tests/tool-observation.test.ts`
- Test: `qiongqi/tests/tool-runtime-v3.test.ts`

- [ ] **Step 1: Write RED tests for canonicalization and replay**

```ts
it('canonicalizes equivalent object key order to one fingerprint', () => {
  expect(canonicalToolDigest(call({ arguments: { path: 'a', limit: 10 } })))
    .toBe(canonicalToolDigest(call({ arguments: { limit: 10, path: 'a' } })))
})

it('marks replayed effects without creating a second logical observation', async () => {
  const first = await runtime.execute(input())
  const replay = await runtime.execute({ ...input(), state: first.state })
  expect(first.observation?.replayed).toBe(false)
  expect(replay.observation?.replayed).toBe(true)
  expect(replay.observation?.resultDigest).toBe(first.observation?.resultDigest)
})
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --dir qiongqi exec vitest run tests/tool-observation.test.ts tests/tool-runtime-v3.test.ts`

Expected: FAIL because ToolRuntimeV3 returns no observation.

- [ ] **Step 3: Implement semantic observation without command regexes**

Use stable recursive key sorting for argument digests. Prefer `ToolHostResult.semantic`; otherwise derive `capabilityClass` from registered tool name, use an empty resource list, and retain exact/result digest protection.

```ts
export function observeTool(input: ObserveToolInput): ToolObservation {
  return ToolObservationSchema.parse({
    callId: input.call.callId,
    toolName: input.call.toolName,
    effect: input.policy.effect,
    capabilityClass: input.result.semantic?.capabilityClass ?? input.call.toolName,
    resourceKeys: input.result.semantic?.resourceKeys ?? [],
    canonicalArgumentsDigest: digestValue(canonicalize(input.call.arguments)),
    resultDigest: digestValue(input.result.item),
    resultItemId: input.result.item.id,
    artifactRefs: input.result.semantic?.artifactRefs ?? [],
    failed: input.result.item.kind === 'tool_result' && input.result.item.isError,
    replayed: input.replayed
  })
}
```

Local file/read/write tools return explicit capability and normalized workspace-relative resource keys. Bash remains fallback unless its executor supplies parsed semantic metadata; the governor never parses raw command strings.

- [ ] **Step 4: Verify tool runtime and host tests**

Run: `pnpm --dir qiongqi exec vitest run tests/tool-observation.test.ts tests/tool-runtime-v3.test.ts tests/builtin-tools.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit structured observations**

```bash
git add qiongqi/packages/engine/loop qiongqi/packages/adapters/adapter-tools qiongqi/tests/tool-observation.test.ts qiongqi/tests/tool-runtime-v3.test.ts
git commit -m "feat(kernel): observe tool effects structurally"
```

### Task 5: Project authoritative task progress

**Files:**
- Create: `qiongqi/packages/engine/loop/src/task-progress-projector.ts`
- Modify: `qiongqi/packages/engine/loop/src/kernel-v3-node-handlers.ts`
- Modify: `qiongqi/packages/engine/loop/src/kernel-v3-graph.ts`
- Modify: `qiongqi/packages/engine/loop/src/index.ts`
- Test: `qiongqi/tests/task-progress-projector.test.ts`
- Test: `qiongqi/tests/kernel-v3-node-handlers.test.ts`

- [ ] **Step 1: Write RED tests for strong, weak, and ledger-only progress**

```ts
it('projects todo completion and artifacts as strong progress', () => {
  const result = projectTaskProgress({ task: pendingTask(), todos: completedTodos(),
    observations: [artifactObservation('report.md')] })
  expect(result.task.completedActions).toHaveLength(1)
  expect(result.task.artifacts[0]?.path).toBe('report.md')
  expect(result.progress.kind).toBe('strong')
})

it('does not treat a ledger-only call as progress', () => {
  const result = projectTaskProgress({ task: pendingTask(), todos: [],
    observations: [observation({ resourceKeys: [], artifactRefs: [] })] })
  expect(result.progress.kind).toBe('none')
})
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --dir qiongqi exec vitest run tests/task-progress-projector.test.ts`

Expected: FAIL because the projector does not exist.

- [ ] **Step 3: Implement a pure projector plus CAS node**

Return a stable digest that excludes call ids and ledger length:

```ts
type ProjectedProgress = {
  task: TaskStateV1
  progress: { kind: 'strong' | 'weak' | 'none'; digest: string; evidenceCount: number }
}
```

Map current thread todos by stable id/text, move completed actions, attach observation result item ids as evidence only when resource/result is novel, and merge structured artifact refs. `project-progress` loads current TaskState and todos, calculates the next revision, and commits with existing prepare/commit CAS. On revision conflict, reload once and recompute.

- [ ] **Step 4: Verify projection and graph ordering**

Run: `pnpm --dir qiongqi exec vitest run tests/task-progress-projector.test.ts tests/kernel-v3-node-handlers.test.ts tests/task-state-store.test.ts`

Expected: PASS; graph sequence places `project-progress` after `commit-tools`.

- [ ] **Step 5: Commit task projection**

```bash
git add qiongqi/packages/engine/loop qiongqi/tests/task-progress-projector.test.ts qiongqi/tests/kernel-v3-node-handlers.test.ts
git commit -m "feat(kernel): project authoritative task progress"
```

### Task 6: Add the persisted multi-signal LoopGovernor

**Files:**
- Create: `qiongqi/packages/engine/loop/src/loop-governor.ts`
- Create: `qiongqi/packages/engine/loop/src/middleware/loop-governor-middleware.ts`
- Modify: `qiongqi/packages/engine/loop/src/kernel-v3-graph.ts`
- Modify: `qiongqi/packages/engine/loop/src/kernel-v3-node-handlers.ts`
- Modify: `qiongqi/packages/engine/loop/src/kernel-v3-turn-runner.ts`
- Modify: `qiongqi/packages/engine/loop/src/index.ts`
- Test: `qiongqi/tests/loop-governor.test.ts`
- Test: `qiongqi/tests/kernel-v3-loop-governance.test.ts`

- [ ] **Step 1: Write RED table tests for every signal**

```ts
it.each([
  ['exact call', repeat(exactObservation(), 3), 'terminate'],
  ['same result', sameResultDifferentCalls(4), 'terminate'],
  ['same resource', sameResourceReads(6), 'checkpoint'],
  ['no progress tools', novelNoProgressReads(12), 'checkpoint']
] as const)('%s produces %s', (_name, observations, expected) => {
  const result = observations.reduce((state, observation) =>
    advanceLoopGovernor(state.state, { observation, progress: noProgress() }), initialResult())
  expect(result.decision.kind).toBe(expected)
})

it('resets windows on strong progress and isolates independent states', () => {
  const warned = feed(initialLoopGovernorState(), sameResourceReads(5))
  expect(advanceLoopGovernor(warned, { progress: strongProgress() }).state.noProgressTools).toBe(0)
  expect(initialLoopGovernorState()).not.toBe(warned)
})
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --dir qiongqi exec vitest run tests/loop-governor.test.ts tests/kernel-v3-loop-governance.test.ts`

Expected: FAIL because no persisted governor exists.

- [ ] **Step 3: Implement the pure state machine and graph checkpoint**

The transition API must remain deterministic:

```ts
export function advanceLoopGovernor(
  previous: LoopGovernorState,
  input: { proposalClass?: ProposalClass; observation?: ToolObservation; progress?: ProgressSignal }
): { state: LoopGovernorState; decision: { kind: 'allow' } | { kind: 'checkpoint'; reason: string } | { kind: 'terminate'; reason: string } }
```

Persist state using `set-middleware-state`. Add `progress-checkpoint`, which updates the one runtime progress item and injects a structured TaskState checkpoint into the next build-context. Mark `checkpointUsed`; a second checkpoint request becomes `loop_capped` termination.

- [ ] **Step 4: Verify crash recovery, checkpoint once, and isolation**

Run: `pnpm --dir qiongqi exec vitest run tests/loop-governor.test.ts tests/kernel-v3-loop-governance.test.ts tests/runtime-kernel-crash-recovery.test.ts tests/runtime-kernel-isolation.test.ts`

Expected: PASS; snapshot reload retains the governor window.

- [ ] **Step 5: Commit LoopGovernor**

```bash
git add qiongqi/packages/engine/loop qiongqi/tests/loop-governor.test.ts qiongqi/tests/kernel-v3-loop-governance.test.ts
git commit -m "feat(kernel): govern tool loops persistently"
```

### Task 7: Prevent ineffective compaction loops

**Files:**
- Create: `qiongqi/packages/engine/loop/src/compaction-governor.ts`
- Modify: `qiongqi/packages/engine/loop/src/context-compactor.ts`
- Modify: `qiongqi/packages/engine/loop/src/prompt-builder.ts`
- Modify: `qiongqi/packages/engine/loop/src/compaction-transaction.ts`
- Modify: `qiongqi/packages/engine/loop/src/index.ts`
- Test: `qiongqi/tests/compaction-governor.test.ts`
- Test: `qiongqi/tests/context-compactor.test.ts`
- Test: `qiongqi/tests/compaction-transaction.test.ts`

- [ ] **Step 1: Write RED tests for fixed overhead, savings, cooldown, and lineage**

```ts
it('does not compact small history solely because fixed prompt overhead is high', () => {
  expect(planGovernedCompaction({ providerPromptTokens: 120_000,
    compactableHistoryTokens: 500, predictedResultTokens: 450, prior: emptyState() })).toBeNull()
})

it('requires useful net savings and new history growth', () => {
  expect(planGovernedCompaction({ compactableHistoryTokens: 20_000,
    predictedResultTokens: 19_500, prior: emptyState() })).toBeNull()
  expect(planGovernedCompaction({ compactableHistoryTokens: 20_000,
    predictedResultTokens: 10_000, prior: recentCompactionState() })).toBeNull()
})

it('never compacts a summary-only source', () => {
  expect(compactor.planCompaction([compactionItem()], pressure())).toBeNull()
})
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --dir qiongqi exec vitest run tests/compaction-governor.test.ts tests/context-compactor.test.ts tests/compaction-transaction.test.ts`

Expected: FAIL because total provider pressure still dominates planning.

- [ ] **Step 3: Implement pressure breakdown and governed planning**

Use this pure decision input:

```ts
type CompactionPressure = {
  providerPromptTokens?: number
  fixedTokens: number
  compactableHistoryTokens: number
  predictedResultTokens: number
  historyItemCount: number
  modelStep: number
}
```

Require `netSaving >= max(1024, compactableHistoryTokens * 0.10)`, at least 2048 new history tokens or 8 new items since the prior success, and 6 model steps of cooldown unless hard capacity is reached. Carry lineage/source digest in CompactionPlan and retain exactly one active summary.

If fixed overhead remains over capacity after optional prompt shedding, return `context_capacity_exceeded`; do not issue another compaction plan.

- [ ] **Step 4: Verify compaction transaction and recovery**

Run: `pnpm --dir qiongqi exec vitest run tests/compaction-governor.test.ts tests/context-compactor.test.ts tests/compaction-transaction.test.ts tests/task-context-recovery.test.ts`

Expected: PASS; a simulated high fixed overhead produces zero repeated compactions.

- [ ] **Step 5: Commit compaction governance**

```bash
git add qiongqi/packages/engine/loop qiongqi/tests/compaction-governor.test.ts qiongqi/tests/context-compactor.test.ts qiongqi/tests/compaction-transaction.test.ts
git commit -m "fix(kernel): prevent ineffective compaction loops"
```

### Task 8: Wire production governance and user-visible termination

**Files:**
- Modify: `qiongqi/packages/http-layer/http/src/runtime-factory.ts`
- Modify: `qiongqi/packages/engine/loop/src/kernel-v3-turn-runner.ts`
- Modify: `qiongqi/packages/engine/loop/src/runtime-kernel.ts`
- Modify: `qiongqi/packages/engine/loop/src/kernel-v3-node-handlers.ts`
- Test: `qiongqi/tests/kernel-v3-turn-runner.test.ts`
- Test: `qiongqi/tests/task-continuity-production-path.test.ts`
- Test: `qiongqi/tests/kernel-v3-production-governance.test.ts`

- [ ] **Step 1: Write a RED production-factory test**

```ts
it('wires persisted governance and commits diagnosis before loop termination', async () => {
  const runtime = await productionHarness({ proposals: repeatingReadProposals(20) })
  const status = await runtime.runTurn('thread-1', 'turn-1')
  expect(status).toBe('failed')
  expect(await runtime.outcome()).toMatchObject({ reason: 'loop_capped', userVisibleItemId: expect.any(String) })
  expect((await runtime.items()).filter((item) => item.kind === 'runtime_progress')).toHaveLength(1)
  expect(await runtime.modelCallCount()).toBeLessThan(20)
})
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --dir qiongqi exec vitest run tests/kernel-v3-production-governance.test.ts tests/kernel-v3-turn-runner.test.ts`

Expected: FAIL because production runner has no middleware and no progress item.

- [ ] **Step 3: Construct and inject the default chain**

Runtime factory constructs a chain with identity, commit integrity, budget, LoopGovernor, terminal response, and observability middleware. `KernelV3TurnRunnerOptions` requires the chain and passes it to RuntimeKernel. Node results expose proposal/usage/observation/progress facts through persisted node data.

Before any governor termination, call a shared helper:

```ts
await upsertRuntimeProgress({
  phase: 'terminated', summary: diagnosticSummary(decision, task),
  reason: decision.reason, modelSteps: state.budgets.stepsUsed,
  toolCalls: state.budgets.toolCallsUsed
})
```

Set `RunOutcome.userVisibleItemId` to the deterministic progress item id.

- [ ] **Step 4: Verify production path and existing Kernel behavior**

Run: `pnpm --dir qiongqi exec vitest run tests/kernel-v3-production-governance.test.ts tests/kernel-v3-turn-runner.test.ts tests/task-continuity-production-path.test.ts tests/runtime-middleware-governance.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit production wiring**

```bash
git add qiongqi/packages/http-layer qiongqi/packages/engine/loop qiongqi/tests/kernel-v3-production-governance.test.ts qiongqi/tests/kernel-v3-turn-runner.test.ts qiongqi/tests/task-continuity-production-path.test.ts
git commit -m "feat(kernel): wire production loop governance"
```

### Task 9: Render reasoning and engine progress separately

**Files:**
- Modify: `frontend/src/core/threads/qiongqi-types.ts`
- Modify: `frontend/src/core/threads/qiongqi-client.ts`
- Modify: `frontend/src/components/workspace/messages/message-steps.ts`
- Modify: `frontend/src/components/workspace/messages/message-group.tsx`
- Modify: `frontend/src/core/i18n/locales/zh-CN.ts`
- Modify: `frontend/src/core/i18n/locales/en-US.ts`
- Modify: `frontend/src/core/i18n/locales/types.ts`
- Test: `frontend/tests/unit/core/qiongqi-stream.test.ts`
- Test: `frontend/tests/unit/components/workspace/message-group-steps.test.tsx`

- [ ] **Step 1: Write RED adapter and rendering tests**

```tsx
test('keeps runtime progress separate from provider reasoning', () => {
  const messages = itemsToMessages([reasoningItem('模型推理'), progressItem('正在整理证据')])
  render(<MessageGroup messages={messages} />)
  expect(screen.getByText('思考')).toBeInTheDocument()
  expect(screen.getByText('进度')).toBeInTheDocument()
  expect(screen.queryByText('正在整理证据')).not.toBeVisible()
})

test('updates one progress item in place from stream events', () => {
  const reducer = new QiongQiStreamReducer()
  reducer.apply(itemCreated(progressItem('准备')))
  reducer.apply(itemUpdated(progressItem('汇总')))
  expect(reducer.getItems().filter((item) => item.kind === 'runtime_progress')).toHaveLength(1)
})
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --dir frontend exec vitest run tests/unit/core/qiongqi-stream.test.ts tests/unit/components/workspace/message-group-steps.test.tsx`

Expected: FAIL because frontend types and renderer do not know `runtime_progress`.

- [ ] **Step 3: Implement typed progress rendering**

Map runtime progress to an AI message with `additional_kwargs.qiongqi_runtime_progress`. Extend `convertToSteps()` with:

```ts
type CoTProgressStep = GenericCoTStep<'progress'> & {
  progress: RuntimeProgressTurnItem
}
```

Render a separate collapsed block using the existing Collapsible primitive, label it `t.toolCalls.runtimeProgress`, and keep reasoning under the existing Reasoning component. Do not place progress text into `reasoning_content`.

- [ ] **Step 4: Verify frontend tests and typecheck**

Run: `pnpm --dir frontend exec vitest run tests/unit/core/qiongqi-stream.test.ts tests/unit/components/workspace/message-group-steps.test.tsx tests/unit/core/reasoning-trigger.test.ts && pnpm --dir frontend typecheck`

Expected: PASS.

- [ ] **Step 5: Commit frontend progress UI**

```bash
git add frontend/src frontend/tests/unit/core/qiongqi-stream.test.ts frontend/tests/unit/components/workspace/message-group-steps.test.tsx
git commit -m "feat(ui): distinguish reasoning from runtime progress"
```

### Task 10: Add provider-neutral storm regression fixtures

**Files:**
- Create: `qiongqi/tests/fixtures/kernel-governance/minimax-m3-tool-storm.json`
- Create: `qiongqi/tests/fixtures/kernel-governance/no-reasoning-tool-loop.json`
- Create: `qiongqi/tests/kernel-v3-provider-governance.test.ts`
- Modify: `qiongqi/tests/runtime-kernel-provider-matrix.test.ts`
- Modify: `qiongqi/tests/provider-compatibility.test.ts`

- [ ] **Step 1: Add a minimized fixture derived from the production sequence**

The fixture contains no user data or API credentials. Retain only normalized frames:

```json
{
  "provider": "minimax",
  "model": "MiniMax-M3",
  "objective": "完成分析报告",
  "frames": [
    {"reasoning":"检查工作区状态","tool":{"name":"todo_list","arguments":{}}},
    {"reasoning":"再次确认状态","tool":{"name":"todo_list","arguments":{}}},
    {"reasoning":"继续确认状态","tool":{"name":"todo_list","arguments":{}}}
  ]
}
```

- [ ] **Step 2: Write the RED replay assertion**

```ts
it.each(providerFixtures)('$provider terminates repeated evidence without provider rules', async (fixture) => {
  const run = await replayFixture(fixture)
  expect(run.outcome.reason).toBe('loop_capped')
  expect(run.modelCalls).toBeLessThanOrEqual(4)
  expect(run.items.some((item) => item.kind === 'runtime_progress')).toBe(true)
})
```

- [ ] **Step 3: Run and diagnose any provider-neutral gaps**

Run: `pnpm --dir qiongqi exec vitest run tests/kernel-v3-provider-governance.test.ts tests/runtime-kernel-provider-matrix.test.ts tests/provider-compatibility.test.ts`

Expected before final wiring: FAIL only where a fixture bypasses structured observation; do not add provider-name branches.

- [ ] **Step 4: Close gaps through shared normalization only**

Any fixture gap must be fixed in `model-protocol-normalizer.ts`, `tool-observation.ts`, or provider-neutral adapter metadata. The implementation must not check `provider === 'minimax'`, `kimi`, `deepseek`, or model names inside LoopGovernor.

- [ ] **Step 5: Re-run and commit fixtures**

Run: `pnpm --dir qiongqi exec vitest run tests/kernel-v3-provider-governance.test.ts tests/runtime-kernel-provider-matrix.test.ts tests/provider-compatibility.test.ts tests/routed-model-compat-client.test.ts`

Expected: PASS.

```bash
git add qiongqi/tests qiongqi/packages/engine/loop qiongqi/packages/adapters/adapter-model
git commit -m "test(kernel): cover provider-neutral storm governance"
```

### Task 11: Synchronize upstream and enforce parity

**Files:**
- Modify: `qiongqi/scripts/verify-core-sync.mjs`
- Mirror: all shared files from `qiongqi/packages/**` and `qiongqi/tests/**` into `/Users/libing/kk_Projects/QiongQi`

- [ ] **Step 1: Add every new shared file to the sync verifier**

Extend the explicit allow list with contracts, domain items, tool adapter metadata, proposal materializer, observations, projector, governors, middleware, graph/handlers, and their shared tests. The verifier must fail on a missing file as it does today.

- [ ] **Step 2: Run sync verification and confirm RED before mirroring**

Run: `QIONGQI_UPSTREAM_DIR=/Users/libing/kk_Projects/QiongQi pnpm --dir qiongqi exec node scripts/verify-core-sync.mjs`

Expected: FAIL listing the first unsynchronized file.

- [ ] **Step 3: Mirror shared files without copying KWorks-only frontend/runtime configuration**

Use `rsync -aR` from the `qiongqi/` directory with the explicit file list produced by the verifier. Review both repository diffs; do not overwrite unrelated upstream changes.

- [ ] **Step 4: Run focused and full tests in both repositories**

Run:

```bash
pnpm --dir qiongqi exec vitest run tests/kernel-v3-node-handlers.test.ts tests/runtime-kernel-budget.test.ts tests/loop-governor.test.ts tests/compaction-governor.test.ts tests/kernel-v3-provider-governance.test.ts
pnpm --dir qiongqi test
pnpm --dir qiongqi typecheck
pnpm --dir qiongqi build
pnpm --dir /Users/libing/kk_Projects/QiongQi test
pnpm --dir /Users/libing/kk_Projects/QiongQi typecheck
pnpm --dir /Users/libing/kk_Projects/QiongQi build
QIONGQI_UPSTREAM_DIR=/Users/libing/kk_Projects/QiongQi pnpm --dir qiongqi exec node scripts/verify-core-sync.mjs
```

Expected: all PASS and `core sync ok`.

- [ ] **Step 5: Commit upstream and sync verifier on each main branch**

```bash
git -C /Users/libing/kk_Projects/QiongQi add packages tests
git -C /Users/libing/kk_Projects/QiongQi commit -m "feat(kernel): add persistent progress and loop governance"
git add qiongqi/scripts/verify-core-sync.mjs
git commit -m "test(kernel): enforce upstream governance parity"
```

### Task 12: Production and packaged-desktop verification

**Files:**
- Modify only if a verification defect is found: `desktop/scripts/verify-package-resources.mjs`
- Record results: `.planning/2026-07-16-agent-reasoning-visibility/progress.md`

- [ ] **Step 1: Run complete KWorks frontend and desktop static gates**

Run:

```bash
pnpm --dir frontend test
pnpm --dir frontend check
pnpm --dir frontend build:desktop
pnpm --dir desktop build
pnpm --dir desktop prepare:package-resources
pnpm --dir desktop verify:package-resources
```

Expected: all PASS without warnings attributable to this change.

- [ ] **Step 2: Start the development desktop/runtime and run representative tasks**

Use configured official MiniMax M3 and local vLLM DeepSeek profiles. Verify:

```text
provider reasoning present -> collapsed 思考 visible
provider reasoning absent  -> collapsed 进度 visible
repeated todo/read loop    -> one checkpoint, then structured stop
legitimate multi-file task -> continues and produces artifact
```

Capture model call count, tool call count, compaction count, outcome, and final TaskState revision. Do not capture credentials or full sensitive prompts.

- [ ] **Step 3: Build the packaged app and repeat the click/stream smoke**

Run: `pnpm --dir desktop build:app`

Expected: packaged macOS app starts its bundled QiongQi runtime, reasoning/progress blocks render, and a governed stop remains interactive and returns to the task normally.

- [ ] **Step 4: Run final repository hygiene checks**

Run:

```bash
git branch --show-current
git status --short
git -C /Users/libing/kk_Projects/QiongQi branch --show-current
git -C /Users/libing/kk_Projects/QiongQi status --short
```

Expected: both branches are `main`; only intentional generated/package artifacts, if any, remain untracked and are documented rather than committed.

- [ ] **Step 5: Commit any verification-only fixes and record evidence**

If Step 1-3 exposed a real defect, first add a failing automated regression test, implement the minimal fix, rerun the affected full gate, and commit it with a scoped `fix:` message. Update the planning progress log with exact command outcomes and packaged app path.

## Final Acceptance Checklist

- [ ] Tool proposal reasoning/text is persisted before tool execution and survives replay.
- [ ] No-reasoning providers show engine progress without fabricated thought content.
- [ ] RunState budgets and governor state are non-zero, durable, and fully scoped.
- [ ] Exact repetition, repeated evidence, semantic resource churn, and no-progress windows are covered.
- [ ] TaskState projects todos, evidence, and artifacts; ledger growth alone is not progress.
- [ ] Compaction uses predicted net savings, cooldown, growth, and lineage guards.
- [ ] Governance termination commits a visible diagnostic and structured outcome.
- [ ] Provider fixtures contain no provider-specific LoopGovernor branches.
- [ ] KWorks and upstream QiongQi pass full test/typecheck/build and core sync.
- [ ] Development and packaged desktop behavior is manually verified.

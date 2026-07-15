# QiongQi Runtime Kernel Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Incrementally introduce a persisted, middleware-governed `kernel_v3` runtime for QiongQi while preserving the classic loop, current `/v1` and KWorks APIs, SSE behavior, desktop startup, and synchronized upstream code.

**Architecture:** Add serializable kernel contracts in `@qiongqi/contracts`, ports for run events/snapshots/leases/effects in `@qiongqi/ports`, file/in-memory adapters in `adapter-storage`, and a graph interpreter plus middleware pipeline in `@qiongqi/loop`. The existing `PromptBuilder`, `ModelStepRunner`, `ToolCallCoordinator`, `TurnService`, and `RuntimeEventRecorder` remain the compatibility boundary while kernel_v3 takes over control flow behind an explicit rollout flag.

**Tech Stack:** TypeScript 5.8, pnpm workspaces, Vitest, JSONL/file storage, existing `RuntimeEventRecorder`, `TurnService`, `ModelClient`, `ToolHost`, Node.js filesystem APIs, and the current HTTP/SSE composition root.

**Specification:** `docs/superpowers/specs/2026-07-15-qiongqi-runtime-kernel-redesign.md`

---

## Execution Rules

Every task below is implemented in `/Users/libing/kk_Projects/KWorks/qiongqi` first and then synchronized byte-for-byte for the listed core files and tests into `/Users/libing/kk_Projects/QiongQi`. KWorks-only desktop or compatibility changes remain in KWorks. Each task ends with tests in both repositories, `typecheck` where affected, and a small commit in each repository. Never use `git reset --hard`, `git checkout --`, or overwrite unrelated work.

The default runtime remains `classic` until the rollout task explicitly changes a local configuration. A failed kernel_v3 startup may fall back before any model/tool/effect side effect; after an effect is prepared, the run must be resumed or marked suspended rather than silently switching engines.

## Task 1: Freeze contracts and scope identity

**Files:**
- Create: `qiongqi/packages/foundation/contracts/src/runtime-kernel.ts`
- Modify: `qiongqi/packages/foundation/contracts/src/index.ts`
- Create: `qiongqi/packages/ports-layer/ports/src/runtime-kernel.ts`
- Modify: `qiongqi/packages/ports-layer/ports/src/index.ts`
- Test: `qiongqi/tests/runtime-kernel-contracts.test.ts`
- Test: `qiongqi/tests/scope-key.test.ts`
- Mirror the same files and tests under `/Users/libing/kk_Projects/QiongQi`.

- [x] **Step 1: Add failing contract tests for identity and terminal outcomes.**

Add tests that construct a complete identity and reject missing owner/run fields:

```ts
it('requires owner, thread, turn, run, and workspace identity', () => {
  expect(() => makeRunIdentity({
    ownerUserId: 'u1', threadId: 't1', turnId: 'tu1', runId: 'r1', workspaceKey: 'w1'
  })).not.toThrow()
  expect(() => makeRunIdentity({
    ownerUserId: '', threadId: 't1', turnId: 'tu1', runId: 'r1', workspaceKey: 'w1'
  })).toThrow('ownerUserId')
})

it('keeps terminal outcome reasons structured', () => {
  const outcome = makeRunOutcome({
    status: 'degraded', reason: 'loop_capped', retryable: false
  })
  expect(outcome.reason).toBe('loop_capped')
})
```

Add scope tests proving purpose and owner are part of the encoded key and that two owners never collide even when thread ids match.

- [x] **Step 2: Run the focused tests and verify RED.**

Run in each repository:

```bash
pnpm exec vitest run tests/runtime-kernel-contracts.test.ts tests/scope-key.test.ts
```

Expected: FAIL because the runtime-kernel contract module and constructors do not exist.

- [x] **Step 3: Implement serializable contracts.**

In `contracts/src/runtime-kernel.ts`, define `RunStatus`, `RunOutcomeReason`, `RunOutcome`, `RunIdentity`, `ScopeKey`, `BudgetState`, `RecoveryState`, `EffectIntent`, `CommittedEffectRef`, `RunStateV3`, `RunEventEnvelope`, and `MiddlewareState`. Keep fields JSON-safe and export constructors that reject empty identity components. Use `ownerUserId` as required; do not create an implicit global owner in the contract layer.

In `ports/src/runtime-kernel.ts`, define:

```ts
export interface RunEventStore {
  append(event: RunEventEnvelope): Promise<RunEventEnvelope>
  listAfter(identity: RunIdentity, seq: number): Promise<RunEventEnvelope[]>
}

export interface RunSnapshotStore {
  save(state: RunStateV3): Promise<void>
  load(identity: RunIdentity): Promise<RunStateV3 | undefined>
}

export interface RunLeaseStore {
  acquire(runId: string, holderId: string, ttlMs: number): Promise<{ acquired: boolean; expiresAt?: string }>
  renew(runId: string, holderId: string, ttlMs: number): Promise<boolean>
  release(runId: string, holderId: string): Promise<void>
}
```

Add `encodeScopeKey(scope: ScopeKey): string` with stable field ordering and explicit escaping. Export all new types from both package indexes.

- [x] **Step 4: Run GREEN and typecheck.**

```bash
pnpm exec vitest run tests/runtime-kernel-contracts.test.ts tests/scope-key.test.ts
pnpm --filter @qiongqi/contracts run typecheck
pnpm --filter @qiongqi/ports run typecheck
```

Expected: all focused tests pass and both packages typecheck.

- [x] **Step 5: Sync and commit both repositories.**

Copy only the listed contracts, ports, indexes, and tests to the upstream repository, rerun the same commands there, then commit:

```bash
git add packages/foundation/contracts packages/ports-layer/ports tests/runtime-kernel-contracts.test.ts tests/scope-key.test.ts
git commit -m "feat: add runtime kernel identity contracts"
```

Use the same commit subject in both repositories.

## Task 2: Add event, snapshot, replay, and lease adapters

**Files:**
- Create: `qiongqi/packages/adapters/adapter-storage/src/in-memory-run-state-store.ts`
- Create: `qiongqi/packages/adapters/adapter-storage/src/file-run-state-store.ts`
- Create: `qiongqi/packages/adapters/adapter-storage/src/in-memory-run-event-store.ts`
- Create: `qiongqi/packages/adapters/adapter-storage/src/file-run-event-store.ts`
- Modify: `qiongqi/packages/adapters/adapter-storage/src/index.ts`
- Test: `qiongqi/tests/run-state-store.test.ts`
- Test: `qiongqi/tests/run-event-store.test.ts`
- Mirror the same files and tests under `/Users/libing/kk_Projects/QiongQi`.

- [x] **Step 1: Write crash and ordering tests.**

Cover atomic snapshot replacement, replay after a sequence number, owner/thread/run filtering, monotonic per-thread sequence assignment, stale lease rejection, lease renewal, and lease release. Include a test that writes a V2 state fixture and confirms the adapter returns a V3 migration result only when the owner can be resolved from the supplied identity.

- [x] **Step 2: Run RED.**

```bash
pnpm exec vitest run tests/run-state-store.test.ts tests/run-event-store.test.ts
```

Expected: FAIL because the four adapters are absent.

- [x] **Step 3: Implement in-memory adapters.**

Use `Map<string, RunStateV3>` keyed by `encodeScopeKey` plus run id for snapshots. Use a per-thread sequence counter for events and reject an append whose identity does not match the event envelope. Store leases with holder and expiry; a non-expired lease can only be renewed or released by its holder.

- [x] **Step 4: Implement file adapters with atomic writes.**

Use the existing `atomicWriteFile` helper. Store snapshots under `<root>/run-state/<ownerHash>/<threadId>/<turnId>/<runId>/snapshot.json`, events as JSONL under the same run directory, and leases as an atomic JSON file. Validate every loaded record before returning it. A malformed snapshot is ignored and replay starts from an empty state; a malformed event line is reported through a structured read error rather than silently merged.

- [x] **Step 5: Run GREEN and storage package verification.**

```bash
pnpm exec vitest run tests/run-state-store.test.ts tests/run-event-store.test.ts
pnpm --filter @qiongqi/adapter-storage run typecheck
```

Expected: all adapter tests pass and the storage package typechecks.

- [x] **Step 6: Sync and commit both repositories.**

Mirror the adapter files, index exports, and tests, run the same tests in `/Users/libing/kk_Projects/QiongQi`, then commit `feat: add durable runtime state adapters` in both repositories.

## Task 3: Build the graph interpreter and middleware chain

**Files:**
- Create: `qiongqi/packages/engine/loop/src/execution-graph.ts`
- Create: `qiongqi/packages/engine/loop/src/runtime-kernel-context.ts`
- Create: `qiongqi/packages/engine/loop/src/runtime-middleware.ts`
- Create: `qiongqi/packages/engine/loop/src/middleware-chain.ts`
- Create: `qiongqi/packages/engine/loop/src/runtime-kernel.ts`
- Modify: `qiongqi/packages/engine/services/src/runtime-event-recorder.ts`
- Modify: `qiongqi/packages/engine/loop/src/index.ts`
- Test: `qiongqi/tests/execution-graph.test.ts`
- Test: `qiongqi/tests/runtime-middleware.test.ts`
- Test: `qiongqi/tests/runtime-kernel.test.ts`
- Test: `qiongqi/tests/runtime-event-recorder-kernel.test.ts`
- Mirror core files and tests under `/Users/libing/kk_Projects/QiongQi`.

- [x] **Step 1: Define the graph and middleware RED tests.**

Test that a graph rejects duplicate node ids, unknown edges, cycles that are not explicitly marked as loop edges, and unregistered predicates. Test middleware ordering with `before`/`after` anchors and reject conflicting anchors. Test a fake graph that executes `prepare -> model -> evaluate -> complete`, persists cursor checkpoints, and returns `completed`.

- [x] **Step 2: Run RED.**

```bash
pnpm exec vitest run tests/execution-graph.test.ts tests/runtime-middleware.test.ts tests/runtime-kernel.test.ts
```

Expected: FAIL because the graph, chain, and kernel modules are absent.

- [x] **Step 3: Implement graph validation and cursor transitions.**

`execution-graph.ts` must expose `RuntimeNode`, `RuntimeEdge`, `ExecutionGraph`, and `validateExecutionGraph()`. `RuntimeEdge` includes `loop?: boolean`; cycles are accepted only when the edge explicitly opts into loop semantics. The interpreter may only transition through a registered edge or a registered predicate result. Use `stepIndex`, `nodeId`, `attempt`, and `checkpointSeq` from `RunStateV3`; do not infer the next node from model text.

- [x] **Step 4: Implement middleware context and deterministic ordering.**

`runtime-middleware.ts` defines `RuntimeHook`, `MiddlewareContext`, `MiddlewareCommand`, `MiddlewareResult`, and `RuntimeMiddleware`. `middleware-chain.ts` performs a topological sort from `before`/`after` anchors, rejects cycles and duplicate ids, and invokes the same declared order for each hook. The context exposes read-only state plus typed commands; middleware cannot call `TurnService`, `ToolHost`, or `ModelClient` directly.

- [x] **Step 5: Implement the kernel over injected ports.**

Extend `RuntimeEventRecorder` with `recordKernelEvent()` that delegates durable run events to the injected `RunEventStore` while leaving the public `record()` path unchanged. `runtime-kernel.ts` accepts `RunEventStore`, `RunSnapshotStore`, `RunLeaseStore`, a graph, a middleware chain, and node handlers. `run()` acquires a lease, loads or creates state, saves a checkpoint before and after each node, applies commands, appends events through `recordKernelEvent()`, and releases the lease in `finally`. It must return a structured `RunOutcome`; thrown errors become `runtime_error` and never become completed.

- [x] **Step 6: Run GREEN and package checks.**

```bash
pnpm exec vitest run tests/execution-graph.test.ts tests/runtime-middleware.test.ts tests/runtime-kernel.test.ts
pnpm --filter @qiongqi/loop run typecheck
```

Expected: focused tests pass and the loop package typechecks while classic tests remain unchanged.

- [x] **Step 7: Sync and commit both repositories.**

Mirror the new loop files and tests, run focused tests and typecheck upstream, then commit `feat: add persisted runtime kernel interpreter` in both repositories.

## Task 4: Normalize provider frames and separate proposal from commit

**Files:**
- Modify: `qiongqi/packages/ports-layer/ports/src/model-client.ts`
- Modify: `qiongqi/packages/adapters/adapter-model/src/model-compat-client.ts`
- Modify: `qiongqi/packages/adapters/adapter-model/src/provider-compatibility.ts`
- Create: `qiongqi/packages/engine/loop/src/model-proposal.ts`
- Create: `qiongqi/packages/engine/loop/src/model-protocol-normalizer.ts`
- Create: `qiongqi/packages/engine/loop/src/model-proposal-runner.ts`
- Modify: `qiongqi/packages/engine/loop/src/index.ts`
- Test: `qiongqi/tests/model-proposal.test.ts`
- Modify: `qiongqi/tests/provider-compatibility.test.ts`
- Test: `qiongqi/tests/model-protocol-normalizer.test.ts`
- Mirror core files and tests under `/Users/libing/kk_Projects/QiongQi`.

- [x] **Step 1: Add RED fixtures for all provider stop classes.**

Use fake streams for normal stop, native tool calls, MiniMax reasoning/tool streams, vLLM parser metadata, `content_filter`/safety, refusal, length, malformed tool JSON, and transport error. Assert that raw protocol markers such as `<action>` or `(tool call)` without a structured tool frame set `leakedProtocolText: true` and produce no `ToolIntent`.

- [x] **Step 2: Run RED.**

```bash
pnpm exec vitest run tests/model-proposal.test.ts tests/model-protocol-normalizer.test.ts tests/provider-compatibility.test.ts
```

Expected: new proposal/normalizer tests fail, while existing compatibility tests continue to show the current baseline.

- [x] **Step 3: Extend the model port additively.**

Add optional provider metadata to completed/error chunks without removing `stopReason: 'stop' | 'tool_calls' | 'length' | 'error'`. Define `NormalizedModelCompletion` and `ModelProposal` in `packages/foundation/contracts/src/runtime-kernel.ts`, with `stopClass`, `providerReason`, endpoint format, raw metadata, integrity flags, text, reasoning, and validated tool intents.

- [x] **Step 4: Normalize in the adapter, not in the loop policy.**

Update `ModelCompatClient` to map each endpoint/provider response into the normalized completion fields, preserve only redacted metadata, and keep MiniMax M3 official versus vLLM parser behavior distinct. `model-protocol-normalizer.ts` must validate tool argument objects and refuse partial or unpaired calls.

- [x] **Step 5: Implement proposal runner with provisional projections.**

`model-proposal-runner.ts` consumes the existing model stream, accumulates a `ModelProposal`, emits provisional delta events for SSE compatibility, and only exposes `toolIntents` after a complete normalized frame. It must not call `TurnService.applyItem()` for completed assistant items; a later commit node owns that mutation.

- [x] **Step 6: Run GREEN and provider checks.**

```bash
pnpm exec vitest run tests/model-proposal.test.ts tests/model-protocol-normalizer.test.ts tests/provider-compatibility.test.ts
pnpm --filter @qiongqi/adapter-model run typecheck
pnpm --filter @qiongqi/loop run typecheck
```

Expected: all fixtures pass, including no tool execution for leaked protocol text and distinct provider stop metadata.

- [x] **Step 7: Sync and commit both repositories.**

Mirror the model port, adapter, loop proposal files, and tests; run the same commands upstream; commit `feat: normalize model proposals before loop decisions` in both repositories.

## Task 5: Migrate governance middleware

**Files:**
- Create: `qiongqi/packages/engine/loop/src/middleware/identity-scope-middleware.ts`
- Create: `qiongqi/packages/engine/loop/src/middleware/budget-middleware.ts`
- Create: `qiongqi/packages/engine/loop/src/middleware/history-integrity-middleware.ts`
- Create: `qiongqi/packages/engine/loop/src/middleware/context-recovery-middleware.ts`
- Create: `qiongqi/packages/engine/loop/src/middleware/safety-termination-middleware.ts`
- Create: `qiongqi/packages/engine/loop/src/middleware/loop-detection-middleware.ts`
- Create: `qiongqi/packages/engine/loop/src/middleware/terminal-response-middleware.ts`
- Create: `qiongqi/packages/engine/loop/src/middleware/commit-integrity-middleware.ts`
- Create: `qiongqi/packages/engine/loop/src/middleware/observability-middleware.ts`
- Modify: `qiongqi/packages/engine/loop/src/index.ts`
- Test: `qiongqi/tests/runtime-middleware-governance.test.ts`
- Modify: `qiongqi/tests/loop-evaluator.test.ts`
- Modify: `qiongqi/tests/continuation-policy.test.ts`
- Mirror core files and tests under `/Users/libing/kk_Projects/QiongQi`.

- [x] **Step 1: Convert existing regressions into kernel middleware tests.**

Cover recoverable context-loss clarification, tool-after-empty terminal retry, fallback after recovery exhaustion, max step/token/cost budgets, safety stop with partial tool calls, strict history pairing, repeated tool-call warn/hard-stop, and old-run warning isolation. Each test asserts a `MiddlewareCommand` or `RunOutcome`, not a regex-cleaned user-visible string.

- [x] **Step 2: Run RED for the new middleware suite.**

```bash
pnpm exec vitest run tests/runtime-middleware-governance.test.ts
```

Expected: FAIL because kernel middleware modules are absent.

- [x] **Step 3: Implement identity and budget middleware.**

`identity-scope-middleware.ts` compares every event and context identity against the run identity and returns `fail` on mismatch. `budget-middleware.ts` stores counters in versioned middleware state and returns `terminate` with `step_capped`, `token_capped`, `cost_capped`, or `loop_capped` before another node can run.

- [x] **Step 4: Implement history, context, safety, and terminal middleware.**

Reuse `repairModelHistoryItems`, `context-recovery-guard.ts`, and the current compaction metadata. History middleware repairs dangling/orphan pairs before serialization. Context middleware injects only a run-scoped hidden recovery entry. Safety middleware removes partial tool intents when normalized stop class is safety/refusal and records the provider reason. Terminal middleware retries one empty post-tool proposal and then returns `degraded/tool_completed_no_final_text` with a materialized fallback item.

- [x] **Step 5: Implement loop detection and commit integrity.**

Move the current `ToolStormBreaker` behavior into a run-scoped sliding window keyed by stable `(toolName, salientArgs)` hashes. Warnings are queued for the next model request only after tool results are paired. `commit-integrity-middleware.ts` checks idempotency keys and prevents a terminal run from being overwritten by late events.

`observability-middleware.ts` records hook duration, structured outcome reason, provider class, and redacted identity hash through `RuntimeEventRecorder`; it never records raw tool arguments or safety-filtered provider content.

- [x] **Step 6: Run GREEN and classic regression tests.**

```bash
pnpm exec vitest run tests/runtime-middleware-governance.test.ts tests/loop-evaluator.test.ts tests/continuation-policy.test.ts tests/tool-storm-breaker.test.ts
pnpm --filter @qiongqi/loop run typecheck
```

Expected: all new and existing governance tests pass; classic behavior remains available.

- [x] **Step 7: Sync and commit both repositories.**

Mirror middleware and tests, run the same focused suite upstream, then commit `feat: move loop governance into kernel middleware` in both repositories.

## Task 6: Add effect intents and idempotent Tool Runtime execution

**Files:**
- Create: `qiongqi/packages/engine/loop/src/effect-commit.ts`
- Create: `qiongqi/packages/engine/loop/src/tool-runtime-v3.ts`
- Modify: `qiongqi/packages/engine/loop/src/tool-call-coordinator.ts`
- Modify: `qiongqi/packages/ports-layer/ports/src/tool-host.ts`
- Modify: `qiongqi/packages/foundation/contracts/src/runtime-kernel.ts`
- Test: `qiongqi/tests/effect-commit.test.ts`
- Test: `qiongqi/tests/tool-runtime-v3.test.ts`
- Test: `qiongqi/tests/runtime-kernel-crash-recovery.test.ts`
- Mirror core files and tests under `/Users/libing/kk_Projects/QiongQi`.

- [x] **Step 1: Add RED effect tests.**

Test read tools replay safely, idempotent writes return the committed result for the same key, non-idempotent writes suspend after an injected crash between execution and commit, approvals are never duplicated, and tool results are externalized when the inline budget is exceeded.

- [x] **Step 2: Run RED.**

```bash
pnpm exec vitest run tests/effect-commit.test.ts tests/tool-runtime-v3.test.ts tests/runtime-kernel-crash-recovery.test.ts
```

Expected: FAIL because effect commit and V3 tool runtime do not exist.

- [x] **Step 3: Define effect policy and intent records.**

Add `ToolEffectPolicy` to `packages/foundation/contracts/src/runtime-kernel.ts` with `effect`, `replay`, and optional `concurrencyKey`. `effect-commit.ts` creates `EffectIntent`, writes `effect.prepared`, looks up an existing commit by idempotency key, and writes `effect.committed` only once.

- [x] **Step 4: Implement Tool Runtime facade.**

`tool-runtime-v3.ts` validates tool schema, identity/workspace scope, skill allow-list, approval policy, effect policy, and idempotency before delegating to `ToolCallCoordinator`. It returns normalized `ToolResult` plus `EffectCommitStatus`; it never executes a tool from plain text protocol markers.

- [x] **Step 5: Add crash injection and result budget coverage.**

Expose a test-only `CrashPoint` callback on the kernel dependency object. Inject failures at prepare, after tool execution, before commit, and after commit. Assert replay uses the committed effect or suspends for verification instead of executing a non-idempotent write twice.

- [x] **Step 6: Run GREEN and adapter checks.**

```bash
pnpm exec vitest run tests/effect-commit.test.ts tests/tool-runtime-v3.test.ts tests/runtime-kernel-crash-recovery.test.ts tests/tool-result-budget.test.ts
pnpm --filter @qiongqi/adapter-tools run typecheck
pnpm --filter @qiongqi/loop run typecheck
```

Expected: no duplicate effect commits and no repeated non-idempotent tool execution after injected crashes.

- [x] **Step 7: Sync and commit both repositories.**

Mirror the effect/tool files and tests, run the same suite upstream, and commit `feat: make tool effects resumable and idempotent` in both repositories.

## Task 7: Introduce durable task capsules and scoped memory

**Files:**
- Create: `qiongqi/packages/engine/loop/src/durable-task-capsule.ts`
- Modify: `qiongqi/packages/engine/loop/src/context-compactor.ts`
- Modify: `qiongqi/packages/engine/loop/src/prompt-builder.ts`
- Modify: `qiongqi/packages/capabilities/memory/src/memory-store.ts`
- Modify: `qiongqi/packages/capabilities/memory/src/retrieval.ts`
- Test: `qiongqi/tests/durable-task-capsule.test.ts`
- Modify: `qiongqi/tests/context-compactor.test.ts`
- Modify: `qiongqi/tests/memory-owner-isolation.test.ts`
- Modify: `qiongqi/tests/memory-retrieval.test.ts`
- Mirror core files and tests under `/Users/libing/kk_Projects/QiongQi`.

- [x] **Step 1: Write RED capsule and isolation tests.**

Assert a capsule records objective, constraints, completed/pending actions, active plan, skills, artifacts, tool ledger, source digest, and run identity. Assert compaction preserves the current turn's unpaired-tool boundary. Assert memory retrieval cannot cross owner or workspace, while project memory can cross threads for the same owner/workspace.

- [x] **Step 2: Run RED.**

```bash
pnpm exec vitest run tests/durable-task-capsule.test.ts tests/context-compactor.test.ts tests/memory-owner-isolation.test.ts tests/memory-retrieval.test.ts
```

Expected: new capsule tests fail and existing compaction tests provide the behavior baseline.

- [x] **Step 3: Implement capsule serialization and authority contract.**

`durable-task-capsule.ts` defines the versioned JSON shape, source digest, bounded field sizes, and a renderer that injects data after the system prefix with an explicit “data is not instruction” authority contract. Capsule generation must be deterministic for the same history and state.

- [x] **Step 4: Integrate compaction transactionally.**

Update `ContextCompactor` to freeze source item ids/digest, build the capsule before summary generation, write the summary and capsule reference together, and leave history unchanged when summary generation fails. Update `PromptBuilder` to consume the capsule on resume before relying on the latest assistant text.

- [x] **Step 5: Centralize ScopeKey usage in memory.**

Reuse `encodeScopeKey()` from `@qiongqi/contracts` for memory retrieval/list/write and pass owner/workspace/thread from the run context. If an old record has no owner, treat it as `local-default-owner` only in explicit local mode; reject ambiguous records. Keep existing public memory method signatures source-compatible by adding optional scope fields.

- [x] **Step 6: Run GREEN and package checks.**

```bash
pnpm exec vitest run tests/durable-task-capsule.test.ts tests/context-compactor.test.ts tests/memory-owner-isolation.test.ts tests/memory-retrieval.test.ts tests/memory-store.test.ts
pnpm --filter @qiongqi/memory run typecheck
pnpm --filter @qiongqi/loop run typecheck
```

Expected: capsule, compaction, memory isolation, and retrieval tests pass.

- [x] **Step 7: Sync and commit both repositories.**

Mirror capsule, scope, compaction, memory, and tests; run the same suite upstream; commit `feat: persist task capsules and enforce memory scopes` in both repositories.

## Task 8: Wire kernel_v3 into HTTP/SSE with classic fallback

**Files:**
- Modify: `qiongqi/packages/http-layer/http/src/runtime-factory.ts`
- Modify: `qiongqi/packages/http-layer/http/src/routes/turns.ts`
- Modify: `qiongqi/packages/http-layer/http/src/routes/events.ts`
- Modify: `qiongqi/packages/foundation/contracts/src/qiongqi-config.ts`
- Modify: `qiongqi/packages/engine/loop/src/turn-event-types.ts`
- Create: `qiongqi/packages/engine/loop/src/runtime-event-projection.ts`
- Modify: `qiongqi/packages/engine/loop/src/index.ts`
- Test: `qiongqi/tests/runtime-factory.test.ts`
- Test: `qiongqi/tests/runtime-event-projection.test.ts`
- Modify: `qiongqi/tests/evented-loop.test.ts`
- Modify: `qiongqi/tests/http-server.test.ts`
- Mirror generic core changes and tests under `/Users/libing/kk_Projects/QiongQi`; keep KWorks-only desktop changes local.

- [x] **Step 1: Add RED rollout and projection tests.**

Test `orchestrationMode: 'kernel_v3'` selects the kernel, `'classic'` remains the default, legacy `'evented'` maps to `evented_v2`, startup failure before any side effect falls back when configured, and post-effect failure returns a suspended/failure outcome without launching a second orchestrator. Test V3 events project to existing SSE event kinds and add only additive runtime metadata.

- [x] **Step 2: Run RED.**

```bash
pnpm exec vitest run tests/runtime-factory.test.ts tests/runtime-event-projection.test.ts tests/evented-loop.test.ts tests/http-server.test.ts
```

Expected: new rollout/projection tests fail because kernel_v3 and its projection are not wired.

- [x] **Step 3: Add rollout configuration and composition.**

Extend config types with `kernel_v3` and `KernelRolloutConfig`. In `runtime-factory.ts`, construct the kernel with injected stores, graph, middleware, model proposal runner, and tool runtime. Keep the existing classic/evented branches and guard fallback so it is allowed only before `effect.prepared`.

- [x] **Step 4: Implement compatible event projection.**

`runtime-event-projection.ts` maps `RunEventEnvelope` to current `RuntimeEvent`/SSE payloads, preserves thread sequence and `Last-Event-ID` replay, and adds `{ runtime: { mode, run_id, outcome_reason } }` only when available. It must not emit internal capsule content, raw tool arguments, or provider secrets.

- [x] **Step 5: Run GREEN and full HTTP/loop checks.**

```bash
pnpm exec vitest run tests/runtime-factory.test.ts tests/runtime-event-projection.test.ts tests/evented-loop.test.ts tests/http-server.test.ts
pnpm --filter @qiongqi/http run typecheck
pnpm --filter @qiongqi/loop run typecheck
```

Expected: rollout tests pass, classic HTTP tests remain green, and SSE compatibility is preserved.

- [x] **Step 6: Sync and commit both repositories.**

Mirror generic composition/config/projection files and tests, run the same commands upstream, and commit `feat: expose kernel v3 behind runtime rollout flag` in both repositories.

## Task 9: Add parity, provider matrix, crash, and isolation gates

**Files:**
- Create: `qiongqi/tests/runtime-kernel-parity.test.ts`
- Create: `qiongqi/tests/runtime-kernel-provider-matrix.test.ts`
- Create: `qiongqi/tests/runtime-kernel-isolation.test.ts`
- Create: `qiongqi/tests/runtime-kernel-e2e.test.ts`
- Create: `qiongqi/scripts/verify-core-sync.mjs`
- Modify: `qiongqi/README.md`
- Modify: `qiongqi/docs/architecture.zh.md`
- Modify: `qiongqi/docs/architecture.en.md`
- Mirror generic tests/script/docs under `/Users/libing/kk_Projects/QiongQi`.

- [x] **Step 1: Create deterministic golden fixtures.**

Record normalized model frames and tool results for normal stop, tool loop, empty terminal, context-loss clarification, safety stop, length stop, and provider protocol failure. The fixture runner must never call a live provider or execute a real workspace mutation.

- [x] **Step 2: Add classic/kernel parity assertions.**

For each fixture, compare user-visible assistant text, tool names/arguments, item terminal statuses, compatible event order, usage totals, and structured outcome. Permit additive `kernel_v3` audit events; fail on removed or reordered legacy events.

- [x] **Step 3: Add provider and isolation gates.**

Run the same normalized fixtures through DeepSeek, official MiniMax M3, Kimi, local vLLM profile, and OpenRouter metadata profiles. Add two-owner same-thread, parallel-thread compaction, two-turn, stale warning, fork, and child-run cases. Assert no cross-owner memory, event, budget, loop, or capsule state.

- [x] **Step 4: Add the core sync verifier.**

`qiongqi/scripts/verify-core-sync.mjs` accepts `QIONGQI_UPSTREAM_DIR`, compares an explicit allow-list of shared `packages/*` core files and `tests/runtime-kernel*` files, ignores generated `dist`, and exits non-zero with the first differing path. Run it from KWorks with:

```bash
QIONGQI_UPSTREAM_DIR=/Users/libing/kk_Projects/QiongQi node qiongqi/scripts/verify-core-sync.mjs
```

- [x] **Step 5: Run the complete verification matrix.**

```bash
pnpm exec vitest run tests/runtime-kernel-parity.test.ts tests/runtime-kernel-provider-matrix.test.ts tests/runtime-kernel-isolation.test.ts tests/runtime-kernel-e2e.test.ts
pnpm run typecheck
pnpm run build
QIONGQI_UPSTREAM_DIR=/Users/libing/kk_Projects/QiongQi node qiongqi/scripts/verify-core-sync.mjs
```

Run the same test/typecheck/build/sync commands in the upstream repository. Live smoke is opt-in through provider-specific environment variables and is never required for offline CI.

- [x] **Step 6: Commit the gates and documentation.**

Commit `test: add kernel parity and dual-repository release gates` in both repositories after the sync verifier passes.

## Task 10: Controlled rollout and deprecation checkpoint

**Files:**
- Modify: `qiongqi/packages/http-layer/http/src/runtime-factory.ts`
- Modify: `qiongqi/docs/architecture.zh.md`
- Modify: `qiongqi/docs/architecture.en.md`
- Modify: `qiongqi/README.md`
- Test: `qiongqi/tests/runtime-rollout.test.ts`
- Mirror generic changes and tests under `/Users/libing/kk_Projects/QiongQi`.

- [x] **Step 1: Add rollout metrics tests.**

Assert counters for `run_outcome`, `recovery`, `effect_deduplicated`, `scope_violation`, middleware duration, and classic fallback include mode/provider/reason labels without secrets or raw tool arguments.

- [x] **Step 2: Implement staged defaults.**

Keep `classic` as the default while development/test configuration can select `kernel_v3`. Enable thread override only through explicit metadata, keep active runs pinned to their mode, and retain classic for two stable release cycles. Set the documented promotion gate to seven consecutive days without blocking regression and less than 1% pre-effect startup fallback for new kernel runs.

- [x] **Step 3: Run release verification.**

```bash
pnpm exec vitest run tests/runtime-rollout.test.ts tests/runtime-kernel-parity.test.ts tests/runtime-kernel-isolation.test.ts
pnpm run typecheck
pnpm run build
pnpm --dir /Users/libing/kk_Projects/KWorks/desktop run build
CI=true pnpm --dir /Users/libing/kk_Projects/KWorks/frontend run build:desktop
```

Expected: all runtime tests and QiongQi build pass, desktop main/preload and static desktop frontend build pass, and no release publication occurs in this task.

- [x] **Step 4: Sync, verify, and commit the rollout checkpoint.**

Run the same generic checks upstream, run `verify-core-sync.mjs`, and commit `chore: gate kernel v3 rollout` in both repositories. Do not remove classic or evented_v2 in this commit.

## Plan Self-Review Checklist

- [x] Contracts and ports are introduced before adapters or engine code.
- [x] Every new persisted type has a focused test and a V1/V2 compatibility path.
- [x] Every governance behavior is asserted as a structured command/outcome rather than a text regex.
- [x] Model proposal normalization precedes tool execution and completed item mutation.
- [x] Non-idempotent effects suspend instead of being blindly replayed.
- [x] Context capsules carry owner/thread/turn/run identity and an authority contract.
- [x] Classic remains the default and fallback cannot duplicate a prepared effect.
- [x] HTTP/SSE compatibility and `Last-Event-ID` replay are covered.
- [x] Provider fixtures cover DeepSeek, MiniMax M3, Kimi, vLLM, and OpenRouter profiles.
- [x] Every shared core task has a mirrored upstream commit and sync verification.
- [x] No task contains an unresolved placeholder or an unbounded future step.

# Kernel Tool Recovery and Skill Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Kernel v3 recover from invalid model tool names and provide a validated, turn-scoped `activate_skill` operation, then synchronize the shared engine changes to the local upstream QiongQi repository.

**Architecture:** Keep tool rejection classification shared by classic and Kernel v3. Kernel v3 will materialize recoverable dispatch failures as failed tool results while preserving earlier successful effects. Add `explicitSkillIds` to the turn contract, expose `activate_skill` from the main capability registry, and merge explicit ids with automatic skill resolution on the next prompt build.

**Tech Stack:** TypeScript, Zod contracts, Vitest, pnpm workspace packages, QiongQi RuntimeKernel v3, LocalToolHost/CapabilityRegistry.

---

## File Map

- Modify `qiongqi/packages/engine/loop/src/tool-call-coordinator.ts`: consume a shared recoverable-dispatch classifier.
- Create `qiongqi/packages/engine/loop/src/tool-dispatch-errors.ts`: define the shared recoverable error predicate and rejection payload helpers.
- Modify `qiongqi/packages/engine/loop/src/kernel-v3-node-handlers.ts`: convert recoverable `commit-tools` exceptions to failed tool results and ledger observations.
- Modify `qiongqi/packages/foundation/contracts/src/turns.ts`: add turn-scoped `explicitSkillIds`.
- Modify `qiongqi/packages/domain-layer/domain/src/turn.ts` and `qiongqi/packages/engine/services/src/turn-service.ts`: create and patch the new field.
- Modify `qiongqi/packages/capabilities/skills/src/plugin-host.ts`: support forced skill ids and validate effective skill availability.
- Create `qiongqi/packages/adapters/adapter-tools/src/skill-activation-tool.ts`: build the validated `activate_skill` LocalTool.
- Modify `qiongqi/packages/adapters/adapter-tools/src/index.ts`: export the activation-tool factory.
- Modify `qiongqi/packages/http-layer/http/src/runtime-factory.ts`: register `activate_skill` with runtime closures.
- Modify `qiongqi/packages/engine/loop/src/prompt-builder.ts`: merge explicit turn activations into skill resolution and context metadata.
- Modify `qiongqi/packages/foundation/contracts/src/capabilities.ts`: distinguish Skill IDs from callable Tools and document `activate_skill`.
- Modify `qiongqi/tests/kernel-v3-node-handlers.test.ts`: regression tests for recoverable and non-recoverable tool failures.
- Create `qiongqi/tests/tool-dispatch-errors.test.ts`: classifier parity tests.
- Modify `qiongqi/tests/work-mode-skill-runtime.test.ts` and `qiongqi/tests/skill-tool-provider.test.ts`: activation validation and turn-scope tests.
- Modify `qiongqi/tests/skill-runtime.test.ts`: forced skill resolution tests.
- Modify `qiongqi/tests/contracts.test.ts` and `qiongqi/tests/domain.test.ts` for the new optional/default field.

## Task 1: Add Failing Kernel Recovery Tests

**Files:**
- Modify: `qiongqi/tests/kernel-v3-node-handlers.test.ts`
- Create: `qiongqi/tests/tool-dispatch-errors.test.ts`

- [x] **Step 1: Add the production-graph regression.** Extend the existing harness so its fake `toolRuntime.execute` throws `new Error('unknown tool: skill-manage')` for a selected call. Add a test with proposals `[tool_intents(valid read_data + invalid skill-manage), final text]` that expects `normal_stop`, a failed `tool_result` for `skill-manage`, a committed ledger entry for `read_data`, a failed ledger entry for `skill-manage`, and a second model request.
- [x] **Step 2: Add the terminal-error guard.** Add a test where the fake runtime throws `new Error('database write failed')`; expect `status: 'failed'`, `reason: 'runtime_error'`, and no recovery proposal.
- [x] **Step 3: Add classifier tests.** Test that `unknown tool:`, `is not provided by`, `is not advertised`, and `is disabled by policy` return true; test that lease, storage, abort, and arbitrary execution errors return false.
- [x] **Step 4: Run the tests before implementation.** Run `pnpm exec vitest run tests/kernel-v3-node-handlers.test.ts tests/tool-dispatch-errors.test.ts` from `/Users/libing/kk_Projects/KWorks/qiongqi`. Expected result: the new tests fail because Kernel v3 currently propagates the exception and the helper does not exist.

## Task 2: Implement Shared Dispatch Classification and Kernel Recovery

**Files:**
- Create: `qiongqi/packages/engine/loop/src/tool-dispatch-errors.ts`
- Modify: `qiongqi/packages/engine/loop/src/tool-call-coordinator.ts`
- Modify: `qiongqi/packages/engine/loop/src/kernel-v3-node-handlers.ts`
- Modify: `qiongqi/packages/engine/loop/src/index.ts` to export the shared helper

- [x] **Step 1: Implement the shared predicate.** Move the exact current predicate from `ToolCallCoordinator.isRecoverableToolDispatchError` into an exported function and have the coordinator delegate to it. Do not broaden the recoverable set.
- [x] **Step 2: Add a rejection result builder.** Build a `tool_result` with `code: 'tool_dispatch_rejected'`, the original error string, `isError: true`, and guidance to use only tools advertised in the current turn. Keep the original call id and tool name.
- [x] **Step 3: Wrap each Kernel `commit-tools` execution.** Catch only errors accepted by the shared predicate. For those errors, update the pre-created tool-call item to `failed`, apply the rejection result, append a failed `TaskToolLedgerEntry`, and append an observation marked failed. Continue the prepared-call loop. Keep non-recoverable errors on the existing throw path.
- [x] **Step 4: Preserve effect state and progress projection.** Ensure a mixed batch returns `tools_committed` with both ledger entries and the runtime state's pending/committed effects, so `project-progress` and the next model step still execute.
- [x] **Step 5: Run focused tests.** Run the two Task 1 test files. Expected result: all new recovery and terminal-error tests pass, and existing kernel node-handler tests remain green.

## Task 3: Add Turn-Scoped Explicit Skill State

**Files:**
- Modify: `qiongqi/packages/foundation/contracts/src/turns.ts`
- Modify: `qiongqi/packages/domain-layer/domain/src/turn.ts`
- Modify: `qiongqi/packages/engine/services/src/turn-service.ts`
- Modify: `qiongqi/tests/contracts.test.ts` and any turn-service/domain fixture that asserts exact turn shape

- [x] **Step 1: Add `explicitSkillIds`.** Add `explicitSkillIds: z.array(z.string().min(1)).default([])` beside `activeSkillIds`. It is optional on disk through the default, so old records remain valid.
- [x] **Step 2: Initialize the field.** Update `createTurnRecord` to return `explicitSkillIds: []`.
- [x] **Step 3: Patch the field through TurnService.** Extend `updateTurnMetadata`'s accepted patch keys and copy the array defensively, preserving existing active-skill behavior.
- [x] **Step 4: Add contract coverage.** Parse a legacy turn without the field and assert `[]`; create a new turn and assert both arrays are independent; update metadata and assert only the requested field changes.
- [x] **Step 5: Run contract/domain tests.** Run the relevant contract and turn tests before moving on.

## Task 4: Add Forced Skill Resolution and Activation Validation

**Files:**
- Modify: `qiongqi/packages/capabilities/skills/src/plugin-host.ts`
- Modify: `qiongqi/tests/skill-runtime.test.ts`
- Modify: `qiongqi/tests/work-mode-skill-runtime.test.ts`

- [x] **Step 1: Extend `resolveTurn`.** Accept `forcedSkillIds?: readonly string[]`; validate each id against the effective work-mode ids and enabled loaded plugins; add valid forced skills ahead of prompt matches with a stable explicit-activation reason; deduplicate and respect the existing active limit.
- [x] **Step 2: Add a validation method.** Expose `resolveActivatableSkill(skillId, context)` returning `{ ok: true, skill }` or `{ ok: false, code: 'unknown_skill' | 'skill_disabled' | 'skill_out_of_mode' }` without mutating host state. It must reject unknown, disabled, and out-of-mode ids deterministically.
- [x] **Step 3: Test forced resolution.** Assert a skill with no prompt match is injected when forced, an invalid id is omitted/rejected, and forced ids are stable-sorted/deduplicated.
- [x] **Step 4: Test mode isolation.** Assert a skill configured for another work mode cannot be activated through the validation method.
- [x] **Step 5: Run skill package tests.** Run `pnpm exec vitest run tests/skill-runtime.test.ts tests/work-mode-skill-runtime.test.ts tests/skill-tool-provider.test.ts`.

## Task 5: Implement and Register `activate_skill`

**Files:**
- Create: `qiongqi/packages/adapters/adapter-tools/src/skill-activation-tool.ts`
- Modify: `qiongqi/packages/adapters/adapter-tools/src/index.ts`
- Modify: `qiongqi/packages/http-layer/http/src/runtime-factory.ts`
- Modify: `qiongqi/tests/work-mode-skill-runtime.test.ts`
- Modify: `qiongqi/tests/skill-tool-provider.test.ts`

- [x] **Step 1: Define the factory contract.** Create `createActivateSkillTool` accepting `effectiveSkillIds(workModeId)`, `resolveSkill(skillId, context)`, and `activateTurnSkill(threadId, turnId, skillId)`. The returned LocalTool is named `activate_skill`, has a required `skill_id` string schema, and is a normal `tool_call`.
- [x] **Step 2: Implement execution.** Trim and validate `skill_id`; reject invalid ids with `skill_activation_rejected` and `isError: true`; on success update `explicitSkillIds` and return `{ code: 'skill_activated', skill_id }`.
- [x] **Step 3: Register the tool.** Add the tool to the main capability registry in `createToolMatrix`, closing over `SkillPluginHost` and `core.turnService`. Do not add it to child-agent registries unless the child has an independently scoped turn service.
- [x] **Step 4: Test the tool.** Exercise successful activation, duplicate activation, disabled skill, out-of-mode skill, and unknown skill. Assert rejected calls do not mutate turn metadata.
- [x] **Step 5: Run adapter/http tests.** Run the focused tool, work-mode, and HTTP runtime tests.

## Task 6: Merge Explicit Activations Into Prompt Context

**Files:**
- Modify: `qiongqi/packages/engine/loop/src/prompt-builder.ts`
- Modify: `qiongqi/packages/foundation/contracts/src/capabilities.ts`
- Modify: `qiongqi/tests/skill-runtime.test.ts`

- [x] **Step 1: Read turn explicit state.** In `PromptBuilder.build`, pass `turn.explicitSkillIds` to `SkillPluginHost.resolveTurn({ forcedSkillIds })`.
- [x] **Step 2: Persist the resolved projection.** Continue writing the merged resolved ids to `activeSkillIds`, while leaving `explicitSkillIds` unchanged except through `activate_skill`.
- [x] **Step 3: Preserve runtime tool context.** Ensure `activeSkillIds`, allowed declarative skill tools, and skill instructions all use the merged resolution on the next step.
- [x] **Step 4: Update prompt wording.** Add concise Skill-vs-Tool rules and the canonical `activate_skill` instruction to the finance capability prompt. Remove wording that suggests calling a skill id directly.
- [x] **Step 5: Add prompt regression.** Extend the existing skill-runtime/prompt harness with a turn whose original prompt does not match `chart-visualization`, activate it, build again, and assert the request contains the skill instruction and any declared skill tools.
- [x] **Step 6: Run prompt and finance tests.** Run the focused prompt, work-mode, capability, and kernel tests.

## Task 7: Run KWorks Verification and Synchronize Upstream

**Files:**
- Synchronize every changed shared file from `KWorks/qiongqi` to `/Users/libing/kk_Projects/QiongQi/qiongqi` (or the matching upstream package path).
- Synchronize the new/modified tests that exercise shared engine behavior.

- [x] **Step 1: Inspect KWorks diff.** Run `git diff --stat` and `git diff --check`; list only files belonging to this feature.
- [x] **Step 2: Run KWorks focused verification.** Run the focused Vitest files from Tasks 1–6 and `pnpm -r run typecheck` in `qiongqi`.
- [x] **Step 3: Compare upstream paths.** Check each target file in `/Users/libing/kk_Projects/QiongQi` and confirm its existing four dirty files are unrelated. Do not use reset, checkout, or broad rsync.
- [x] **Step 4: Apply file-by-file synchronization.** Copy only the feature files, preserving upstream local edits in `adapter-model` and `adapter-storage`; inspect `git diff` in both repositories.
- [x] **Step 5: Run upstream focused verification.** Run the same focused tests and typecheck in `/Users/libing/kk_Projects/QiongQi/qiongqi`.

## Task 8: Full Verification and Handoff

- [x] **Step 1: Run full KWorks QiongQi tests.** From `/Users/libing/kk_Projects/KWorks/qiongqi`, run `pnpm test`; record the exit code and failed-test count. Result: exit 1, 4 pre-existing storage/environment failures, 1124/1128 tests passed.
- [x] **Step 2: Run full upstream QiongQi tests.** From `/Users/libing/kk_Projects/QiongQi/qiongqi`, run `pnpm test`; record the exit code and failed-test count. Result: exit 1, 3 pre-existing storage/environment failures, 863/866 tests passed.
- [x] **Step 3: Run final typechecks.** Run `pnpm -r run typecheck` in both repositories; both passed.
- [x] **Step 4: Inspect synchronization diff.** Confirm feature files are behaviorally identical with `diff -u` while unrelated upstream changes remain untouched.
- [x] **Step 5: Report exact evidence.** Include the regression test names, test counts, typecheck results, synchronized paths, and any pre-existing failures. Do not claim completion without fresh command output.

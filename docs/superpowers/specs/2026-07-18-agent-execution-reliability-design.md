# Agent Execution Reliability Design

**Date:** 2026-07-18
**Status:** Approved architecture, pending implementation
**Scope:** KWorks QiongQi runtime, shared upstream QiongQi core, and the market-linkage finance skill

## Problem Statement

A finance-mode task using `tencent/hy3:free` completed, but only after repeated source inspection, failed file reads, three context compactions, and 54 tool calls in the resumed turn. Runtime evidence exposed several independent defects:

1. File tools silently rewrite trusted external absolute paths into the workspace.
2. A follow-up constraint replaces the active task objective and clears active skills.
3. Finance mode still receives a coding-agent stable system prompt.
4. LoopGovernor checkpoint jumps emitted by `afterNode` middleware are persisted but not applied.
5. Finance skill code contains stale update semantics and an unsafe calendar-date fallback.
6. The model can still misread complete output as truncated; the engine must reduce ambiguity and bound redundant exploration without provider-specific rules.

The repair must preserve filesystem isolation, task/user separation, crash replay, prompt-cache stability, provider neutrality, and upstream source parity.

## Design Principles

- Make access decisions explicit and structured; never repair a path by changing its meaning.
- Persist task semantics separately from conversational style constraints.
- Keep the immutable system prefix domain-neutral; bind domain behavior through work-mode contracts.
- Treat middleware commands identically whether emitted before, during, or after a node.
- Govern semantic progress at model and tool boundaries.
- Keep finance dates tied to exchange trading calendars and source availability.

## 1. Unified Trusted-Root Path Resolution

Introduce a shared path-capability registry used by `read`, `grep`, `find`, `ls`, `edit`, and `write`. Each root has:

- a stable id;
- a canonical real path;
- permissions (`read` or `read-write`);
- a source (`workspace`, `active-skill`, `artifact`, or runtime-provided mount).

The workspace remains read-write. Active skill package roots are read-only. Artifact/output roots retain their existing scoped permissions. A request is resolved by canonical containment against registered roots. Symlink escapes and path traversal are rejected after `realpath` when the target exists and against the canonical parent for new targets.

External absolute paths outside registered roots return a structured `path_outside_allowed_roots` error containing the requested path and allowed root ids. They are never converted to a basename. Relative paths continue to resolve against the workspace.

The active skill roots are supplied through `ToolHostContext`, derived from the skill plugin resolution for that turn. Search tools and file tools use the same resolver. Bash keeps its audit/approval contract, but the runtime prompt must not recommend bash as a workaround for a denied file-tool path. A later shell sandbox can enforce identical kernel-level roots; this change removes the current silent inconsistency without pretending the host shell is fully sandboxed.

## 2. Cross-Turn Task Semantics

Add a deterministic `TaskDirectiveClassifier` with four outcomes:

- `objective`: starts a new task when no unresolved task should be inherited;
- `constraint`: language, formatting, safety, scope, or preservation instructions that modify the active task;
- `continuation`: requests to continue the active task;
- `replacement`: explicit task replacement or cancellation.

Classification uses structured conversation state plus narrowly scoped multilingual directive rules. It does not call a model and does not infer from provider-specific output.

When the current message is a constraint or continuation, TaskState derives its objective from the latest unresolved prior user objective, stores the current message in `constraints`, and inherits the previous turn's active skill ids. An explicit replacement starts a fresh objective. Source ids and digests include both the objective and constraints so replay remains deterministic.

Task restoration must inspect only the same owner, workspace, and thread. It never loads state from another user or thread.

## 3. Work-Mode Prompt Contract

Replace the coding-specific stable prefix used by `qiongqi serve` with a provider-neutral agent prefix. The immutable prefix describes tool discipline, replay, isolation, verification, and response integrity without declaring a coding domain.

Work-mode behavior is injected after the stable prefix:

- coding mode receives the existing engineering workflow contract;
- finance mode receives a finance-analysis execution contract emphasizing skill activation, direct use of declared CLI/API entry points, data provenance, report/dashboard artifacts, and avoiding source-code archaeology unless execution fails;
- other modes receive their own existing work-mode instructions.

This keeps one byte-stable neutral prefix for prompt caching while making the selected work mode authoritative. Existing coding behavior is retained as a coding-mode instruction rather than a global identity.

## 4. Deterministic Skill Continuity

The skill plugin host continues to activate skills from the current objective. For constraint/continuation turns, resolution additionally receives inherited active skill ids from TaskState or the latest prior turn. Explicitly inherited skills are injected before description-keyword matches and remain limited by the current work mode's allowed skill set.

For `完成本周市场联动分析`, `kk-market-linkage-engine` must be active on the first turn. A follow-up such as `全程保持中文回答` must keep it active and add only the language constraint.

## 5. RuntimeKernel Command Semantics

Refactor cursor-command reduction so `jump` has one implementation used by node commands and `afterNode` middleware commands. An afterNode jump is applied after middleware state commands and before the next node starts. The target node and predicate are validated against the graph, recorded in the event stream, and replayed deterministically.

LoopGovernor middleware runs at two boundaries:

- after `account-model`, with `stage: model`;
- after `project-progress`, with `stage: tool` and structured observations.

A progress checkpoint resets the post-checkpoint model counter only when its node actually completes. Continued no-progress model steps then terminate with `loop_capped`. Provider names and model names remain absent from the governor.

Command-execution observations receive semantic resource keys derived from cwd plus safely extracted read targets where available. Empty `command_execution:` keys cannot count as distinct resource evidence.

## 6. Output Completeness Contract

Tool results already expose structured truncation metadata. The prompt contract will explicitly prohibit claiming truncation unless `truncated`, `truncation`, a cache-hygiene marker, or a model-input-budget marker indicates it. When output is complete, the result carries `truncation: null` and models should use the content already present.

Governor fingerprints detect repeated inspection of the same canonical resources even when commands differ only by presentation (`cat`, `sed`, `grep`, or `head`). This is implemented through semantic resource metadata, not shell-command regex termination.

## 7. Finance Date and Source Semantics

The market-linkage skill resolves the latest trade date in this order:

1. the latest valid date returned by its market data source;
2. the exchange trade calendar when available;
3. the most recent weekday as a conservative offline fallback.

It never returns a Saturday or Sunday. Daily and weekly reports record the resolved trade date and the resolution source. Tushare text consistently states that daily data updates after 18:00, subject to endpoint availability. All `T+1` text is removed from executable code, README, SKILL metadata, and packaged/deployed copies.

## 8. Error Handling and Observability

Add structured diagnostics for:

- denied paths and the matching capability roots;
- directive classification and inherited objective source;
- inherited versus newly activated skills;
- requested and applied middleware jumps;
- governor checkpoint and termination reasons;
- trade-date resolution source and fallback reason.

Diagnostics must not expose credentials or full sensitive prompts.

## 9. Test Strategy

Tests are written before production changes.

1. Path resolver tests cover workspace access, active-skill read access, denied writes, external denial, symlink escapes, and Windows-style normalization.
2. TaskState tests reproduce `完成本周市场联动分析` followed by `全程保持中文回答` and assert objective, constraints, isolation, and skill inheritance.
3. Prompt tests assert a neutral stable prefix and distinct coding/finance mode instructions.
4. RuntimeKernel replay tests assert an afterNode jump reaches `progress-checkpoint` exactly once before and after crash recovery.
5. LoopGovernor production tests assert model-stage counting and bounded unique inspection churn across all five provider fixtures.
6. Finance Python tests cover Saturday, Sunday, source failure, source success, daily/weekly dates, and rendered source text.
7. KWorks and upstream QiongQi run focused tests, full fast suites, typecheck, build, and core sync. Packaged skill resources are verified after synchronization.

## Acceptance Criteria

- A trusted active-skill file can be read with its original absolute or virtual path.
- An untrusted external path is rejected and is never remapped to the workspace.
- `全程保持中文回答` remains a constraint on the market-linkage task.
- The finance skill stays active across that follow-up turn.
- Finance mode no longer receives a coding-agent identity.
- An afterNode checkpoint jump starts `progress-checkpoint` and survives replay.
- Unique but semantically redundant inspection loops checkpoint and terminate within configured bounds.
- Complete tool output is not labeled truncated by engine-generated progress or summaries.
- Market-linkage reports use a valid trading weekday and say `每日 18:00 后更新`, not `T+1`.
- Shared core files are byte-identical in KWorks and upstream QiongQi.

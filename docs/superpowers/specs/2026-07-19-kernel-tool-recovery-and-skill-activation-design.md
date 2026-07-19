# Kernel Tool Recovery and Skill Activation Design

## Context

KWorks finance turns instruct models to activate and use skills, but the runtime
currently exposes only concrete tool schemas. A model can therefore confuse a
skill id such as `skill-manage` with a callable tool name. In classic execution,
unknown or unavailable tools are converted into failed tool results so the model
can self-correct. Kernel v3 bypasses that recovery path: the tool-host exception
escapes `commit-tools`, and `RuntimeKernel` terminates the turn with a retryable
runtime error.

The observed MiniMax-M3 failure followed this path after intermediate files had
already been created. DeepSeek completed a comparable task because it used the
advertised `bash` and `read` tools to follow skill instructions, not because the
runtime guaranteed model-independent behavior.

## Goals

- Make unknown, unavailable, and policy-rejected model tool calls recoverable in
  Kernel v3.
- Add one canonical runtime operation for activating an enabled skill during a
  turn.
- Preserve successfully committed calls when a sibling call is rejected.
- Keep classic and Kernel v3 tool-rejection behavior equivalent.
- Keep explicit skill activation scoped to the current turn and work mode.
- Synchronize shared QiongQi engine changes from KWorks to the local upstream
  repository at `/Users/libing/kk_Projects/QiongQi` without overwriting unrelated
  local changes.

## Non-Goals

- Automatically retry arbitrary transport, provider, or tool execution failures.
- Enable skills that are disabled or unavailable in the current work mode.
- Persist explicit activation across separate turns or threads.
- Rename the existing `skill-manage` instruction skill.
- Change provider-specific streaming or tool-call parsing.

## Considered Approaches

### 1. Prompt-only clarification

Clarify that skill ids are not tool names. This is small but cannot guarantee
model compliance and leaves Kernel v3 vulnerable to any hallucinated tool name.

### 2. Runtime auto-activation only

Infer finance deliverable skills from work-mode instructions. This reduces model
work but embeds domain-specific policy in the engine and still does not recover
other invalid tool calls.

### 3. Canonical activation plus recoverable rejection

Expose a validated `activate_skill` tool and make Kernel v3 convert recoverable
dispatch errors into failed tool results. This provides an explicit protocol and
a model-independent safety net. This is the selected approach.

## Architecture

### Recoverable Tool Rejection

Extract the existing recoverable dispatch classification into a shared helper.
The recoverable set remains narrow:

- unknown tool;
- provider mismatch;
- tool not advertised in the current context;
- tool disabled by active policy.

Kernel v3 `commit-tools` executes prepared calls in order. For a recoverable
rejection it creates a completed, error-valued `tool_result` containing the
rejection code, original message, and guidance to use advertised tools only. It
then updates the tool-call item as failed, records a failed ledger entry and an
observation, and continues with remaining calls. Non-recoverable exceptions still
escape and terminate the turn.

Already committed sibling calls are not rolled back. The complete batch is
projected into task state, after which the graph returns to the model. The next
model request therefore contains both successful results and actionable rejection
feedback.

### Explicit Skill Activation

Add an advertised built-in tool named `activate_skill` with one required
`skill_id` argument. Its runtime-bound executor:

1. reads the current turn and work mode;
2. obtains the effective skill ids for that work mode;
3. rejects unknown, disabled, or out-of-mode skill ids as a normal error result;
4. unions the validated id into the turn's explicit active-skill state;
5. returns a structured result identifying the activated skill.

Prompt construction merges explicit turn activations with skills automatically
matched for the original prompt. The merged ids are restricted to the current
effective work-mode set, deduplicated, and stable-sorted. Skill instructions and
declarative skill tools are then resolved from that merged set on the next model
step.

To avoid treating automatically inferred ids as permanent explicit requests, the
turn contract will store explicit activations separately from the existing
`activeSkillIds` projection. The latter remains the observable resolved set used
by the UI and tool context.

### Prompt Contract

The shared agent instruction will state:

- skills are instruction packages identified by skill ids;
- tools are callable functions listed in the current tool schema;
- use `activate_skill` to activate another enabled skill;
- never emit a tool call whose name is only a skill id.

This is preventive guidance only. Runtime validation remains authoritative.

## Data Flow

1. The model calls `activate_skill({ skill_id: "chart-visualization" })`.
2. The tool validates the skill against the current work mode and records the
   turn-scoped explicit activation.
3. Kernel commits the activation result and starts the next model step.
4. PromptBuilder resolves automatic matches plus explicit activations.
5. The model receives the activated skill instructions and any declared tools.
6. If the model instead calls `skill-manage`, Kernel records a failed tool result
   and continues, allowing the model to correct itself.

## Error Handling

- Invalid activation arguments return an error tool result, not an exception.
- Disabled or out-of-mode skills return a stable `skill_activation_rejected`
  code.
- Recoverable tool dispatch failures return `tool_dispatch_rejected`.
- Abort signals, storage failures, lease failures, malformed runtime state, and
  genuine tool implementation exceptions retain existing terminal behavior.
- A failed tool result counts against the tool-call budget to prevent unbounded
  invalid-call loops. Existing loop governance remains responsible for repeated
  no-progress behavior.

## Testing

Tests are written before production changes and must demonstrate the current
failure first.

- Kernel v3: a batch containing one valid call and one unknown call preserves the
  valid result, records the unknown call as failed, and continues to another
  model step.
- Kernel v3: a genuine tool implementation exception still fails the run.
- Parity: classic and Kernel classify the same dispatch errors as recoverable.
- Activation: an effective work-mode skill is added to explicit turn activation
  state and appears in the next resolved `activeSkillIds` set.
- Activation: unknown, disabled, and out-of-mode skills are rejected without
  mutating turn state.
- Prompt contract: Skill and Tool terminology plus `activate_skill` guidance is
  present.
- Integration: a MiniMax-style `skill-manage` tool intent receives rejection
  feedback and the simulated next proposal can use an advertised tool.

Verification includes focused package tests, QiongQi typechecking, and the full
QiongQi test suite in both repositories.

## Synchronization

Shared files and tests are implemented in KWorks first. After verification, each
changed shared file is compared and applied to `/Users/libing/kk_Projects/QiongQi`.
Existing upstream modifications in adapter-model, adapter-storage, and other
unrelated files are preserved. The upstream repository receives its own focused
tests, typecheck, and full-suite verification.

## Success Criteria

- The reproduced `unknown tool: skill-manage` condition no longer terminates a
  Kernel v3 turn.
- The model receives a failed tool result with corrective guidance and can take a
  subsequent action.
- `activate_skill` can activate `chart-visualization` only when it is enabled in
  the current work mode.
- Non-recoverable runtime failures remain terminal.
- KWorks and local upstream QiongQi contain behaviorally identical shared engine
  changes and pass their verification suites.

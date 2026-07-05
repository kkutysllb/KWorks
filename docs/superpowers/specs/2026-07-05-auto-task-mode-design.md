# Auto Task Mode Design

## Problem

The current task mode has only two user-facing states: execute (`agent`) and
plan (`plan`). This makes the normal workflow awkward: users often expect the
agent to plan first and then execute, but the UI currently asks them to manage
that transition manually. If the thread remains in Plan mode, the model can
surface internal mode-switching language instead of continuing the task.

## Goal

Add a default `auto` task mode that performs the normal workflow:

1. Plan the task.
2. Save the plan through `create_plan`.
3. Continue execution automatically in agent mode.

Explicit user selections still take precedence:

- `auto`: plan first, then automatically execute once.
- `plan`: only create/refine the plan and stop.
- `agent`: execute directly without a planning turn.

## Frontend Behavior

Extend the task mode type from `agent | plan` to `auto | agent | plan`.

The task mode menu should show three options in this order:

1. Auto
2. Execute
3. Plan

`auto` becomes the default local setting. The input trigger should make the
current mode clear without exposing backend details. Suggested labels:

- `自动`
- `执行`
- `规划`

When a user submits in `auto` mode, the first turn is sent to Qiongqi with
`is_plan_mode: true`. When the frontend observes a successful `create_plan`
tool result, it automatically starts a follow-up execution turn with
`taskMode: "agent"` and `is_plan_mode: false`.

## Auto Execution Guardrails

Auto execution must happen at most once for the submitted user task. It must
not trigger when:

- The user explicitly selected `plan`.
- The user explicitly selected `agent`.
- `create_plan` failed.
- The user stopped/cancelled the task.
- The runtime requested additional user input.
- An auto execution turn has already been started for the current plan result.

The automatic follow-up should be hidden from the chat transcript where
possible and should use a concise instruction such as:

`Continue executing the task according to the plan that was just saved.`

## Backend Behavior

The backend does not need a new native mode for this iteration. It continues to
receive the existing `mode: "plan"` for the planning turn and normal agent mode
for the execution turn. This keeps the change small and aligned with current
Qiongqi APIs.

The existing Plan-mode prompt guard remains in place: the model should not ask
users to switch GUI modes or explain GUI mode controls.

## Testing

Add focused frontend tests for:

- Default local task mode is `auto`.
- Auto mode submits the first turn as plan mode.
- Successful `create_plan` completion in auto mode triggers one hidden agent
  execution follow-up.
- Explicit `plan` mode does not auto-execute.
- Explicit `agent` mode does not plan first.
- Failed `create_plan` output does not auto-execute.

Existing Qiongqi Plan-mode instruction tests remain backend coverage for
keeping GUI mode-switching language out of user-visible replies.

## Out of Scope

This design does not add a backend-native `auto` mode and does not add a model
classifier to decide whether a task is complex enough to plan. Auto always
means deterministic plan-then-execute unless the user explicitly chooses a
single mode.

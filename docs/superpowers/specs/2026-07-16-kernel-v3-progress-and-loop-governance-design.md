# Kernel v3 推理可见性与循环治理规格

## 1. 文档状态

- 日期：2026-07-16
- 状态：已确认，待实施计划
- 用户决策：优先展示 provider 真实 reasoning；无 reasoning 时展示引擎进度
- 架构决策：采用持久化 Kernel Governance Plane，不采用命令正则补丁
- 适用仓库：
  - `/Users/libing/kk_Projects/KWorks/qiongqi`
  - `/Users/libing/kk_Projects/QiongQi`
  - KWorks 前端与桌面壳仅修改 `/Users/libing/kk_Projects/KWorks`

本文补充以下已确认规格：

- `2026-07-15-qiongqi-runtime-kernel-redesign.md`
- `2026-07-15-task-continuity-and-desktop-artifact-navigation-design.md`

本文解决 Kernel v3 上线后暴露的两类生产缺陷：带工具提案中的 reasoning/text 丢失，以及缺少持久化治理导致的工具风暴和压缩风暴。

## 2. 生产证据与根因

代表性任务 `thr_et4413gb` 使用官方 MiniMax M3 执行“完成昨日可转债全景分析”。终止前记录到：

- 171 次模型调用；
- 170 次上下文压缩；
- 286 个已执行工具结果；
- 572 条 append-only 工具调用记录；
- 114 次相同 `todo_list {}`；
- 38 次相同 `pwd && ls -la`；
- `cursor.stepIndex = 913`；
- RunState 中所有预算计数仍为 0。

provider 快照包含 reasoning 文本，但 thread 中 assistant text 和 assistant reasoning 均为 0。最新 TaskState 保留了正确 objective，却没有 completed action、pending action 和 artifact，仅包含持续增长的 tool ledger。

根因不是 MiniMax 独有行为，而是五个内核缺口相互放大：

1. `evaluate -> prepare-tools` 绕过 `commit-assistant`，中间 proposal 的 reasoning/text 被丢弃。
2. 生产 `KernelV3TurnRunner` 没有注入治理 middleware。
3. RuntimeKernel 不累计模型决策、工具调用、token 和 cost。
4. ToolRuntimeV3 绕过 classic coordinator 的 ToolStormBreaker，现有 breaker 又是不可恢复的进程内状态。
5. PromptBuilder 按包含固定开销的总 prompt pressure 反复压缩可变 history，即使压缩无法降低固定开销。

因此，本轮不能通过显示一个 reasoning 字段、接入现有 middleware 或拦截若干 shell 命令解决。

## 3. 目标与非目标

### 3.1 必须实现

1. 合法工具 proposal 中的 provider reasoning/text 在执行工具前幂等提交。
2. provider 无 reasoning 时，用户仍能看到真实、可审计的引擎阶段进度。
3. 模型决策、工具调用、token、cost 和治理窗口写入 RunState，并能在崩溃恢复后继续。
4. 循环检测同时识别精确重复、重复证据、同资源语义重复和任务无进展。
5. TaskState 从 todo、证据和 artifact 的权威结构化数据持续投影。
6. 上下文压缩只在预计产生有效净节省时执行，且不会压缩摘要到摘要。
7. 触发循环或预算上限时先提交用户可见诊断，再以结构化 outcome 停止。
8. 治理状态按 owner/workspace/thread/turn/run 完整隔离。
9. KWorks 与本地上游 QiongQi 的共享核心实现和测试保持一致。

### 3.2 非目标

- 不暴露 provider 未返回的隐藏 chain-of-thought。
- 不根据工具调用伪造“模型思考”。
- 不为 `ls`、`cat`、`pwd` 或某个 provider 添加专用拦截正则。
- 不保证所有复杂任务使用相同工具数量；阈值必须可配置并由多信号治理优先判断。
- 不删除显式 classic 模式，但 Kernel v3 默认配置不依赖 classic breaker。
- 不改变用户 objective，也不根据 assistant 文本推断新的 objective。

## 4. 总体架构

在 RuntimeKernel 中增加持久化 Governance Plane，由四个独立组件组成：

```text
ModelProposalMaterializer
  -> RunBudgetAccountant
  -> ProgressProjector
  -> LoopGovernor
  -> CompactionGovernor
```

组件通过 RunState、TaskState 和结构化 observation 协作，不直接解析前端文本。每个组件具有版本化状态、确定性输入和可独立测试的输出。

### 4.1 生产图调整

Kernel v3 图调整为：

```text
build-context
  -> invoke-model
  -> normalize-proposal
  -> account-model
  -> evaluate
       -> materialize-proposal -> govern-tools -> prepare-tools
       -> materialize-final -> complete
       -> recover-context -> build-context
       -> fail

prepare-tools
  -> commit-tools
  -> project-progress
  -> govern-progress
  -> build-context | progress-checkpoint | terminate
```

`materialize-proposal` 只接收已通过 normalize/evaluate 的合法 `tool_intents`。context discontinuity、safety/refusal、malformed tool call 和 leaked protocol text 保持 quarantine，不进入用户消息。

### 4.2 控制权边界

- Model Runtime 只产生 proposal 和 usage。
- Materializer 只负责用户可见 item 的幂等物化。
- ProgressProjector 只更新 TaskState，不决定是否停止。
- LoopGovernor 只读取 observation 和 progress digest，输出 allow、checkpoint 或 terminate。
- CompactionGovernor 只决定是否值得压缩，不生成任务事实。
- RuntimeKernel 提交命令、事件、快照和最终 outcome。

## 5. Proposal 物化与可见进度

### 5.1 幂等物化

每个 proposal 使用稳定 item id：

```text
item_kernel_reasoning_${proposalId}
item_kernel_text_${proposalId}
```

崩溃重放时 `TurnService.applyItem()` 必须返回已有 item 或执行幂等 upsert，不能追加副本。node completed 事件只有在 item 提交成功后记录。

物化规则：

- `proposal.reasoning` 非空：提交 `assistant_reasoning`，前端默认折叠为“思考”。
- `proposal.text` 非空且 integrity 合法：提交 `assistant_text`。
- tool proposal 可以同时提交 reasoning、简短 action preamble 和 tool call。
- reasoning 为空不创建空 reasoning item。
- leaked/malformed/context-discontinuity 内容不提交。

### 5.2 引擎进度回退

新增独立 `runtime_progress` item，而不是冒充 assistant reasoning。内容只来自结构化事实：

- 当前阶段：准备、检索、执行、汇总、生成产物；
- 已执行工具数与当前预算；
- 新增证据数、完成 action 数和 artifact 数；
- 当前 TaskState 的 immediate next action；
- checkpoint 或停止原因。

同一 run 使用固定 id `item_kernel_progress_${runId}` 并更新，不在每一步追加新卡片。provider 有 reasoning 时仍允许在重要阶段更新进度，但默认只在阶段变化、治理警告和终态时更新。

前端将 provider reasoning 和 runtime progress 显示为不同的折叠区块，避免用户误以为引擎状态是模型原始思维。

## 6. 真实预算核算

### 6.1 计数语义

现有 `BudgetState.stepsUsed` 明确定义为“已完成的模型决策次数”，不按 graph node 计数。

- `stepsUsed`：每个完整 normalized proposal 增加 1；
- `toolCallsUsed`：每个准备执行的逻辑 tool call 增加 1，replay 不重复增加；
- `inputTokens` / `outputTokens`：聚合 provider usage；
- `costUsd`：聚合 UsageService 已计算成本。

新增原子 `add-budget` command。禁止通过“读旧值 + set-budget”跨异步边界累计，避免并发或重放丢失增量。

### 6.2 usage 数据流

ModelProposalRunner 返回 proposal 与本次调用聚合 usage。usage 事件、UsageService 和 RunState budget 使用同一规范化数据，不再分别计算。没有 provider usage 时允许 estimator 生成 `estimated: true` 的计数，并在后续真实 usage 到达时按 usage id 去重校正。

### 6.3 默认硬限制

默认值可由运行配置覆盖：

- 每 run 最多 96 次模型决策；
- 每 run 最多 256 次逻辑工具执行；
- total token 上限为 `min(4_000_000, max(1_000_000, modelContextWindow * 24))`；
- cost 继续服从 thread/user 已配置预算；
- 用户 abort 和 provider safety 始终优先于预算结果。

硬限制是最后防线。正常循环应先被多信号 governor 识别，而不是等到 96 次模型调用。

## 7. 持久化 Loop Governor

### 7.1 ToolObservation

ToolRuntimeV3 在结果提交后生成 provider-neutral observation：

```ts
type ToolObservation = {
  callId: string
  toolName: string
  effect: 'read' | 'idempotent-write' | 'non-idempotent-write'
  capabilityClass: string
  resourceKeys: string[]
  canonicalArgumentsDigest: string
  resultDigest: string
  resultItemId: string
  artifactRefs: TaskArtifactRef[]
  failed: boolean
  replayed: boolean
}
```

`capabilityClass` 和 `resourceKeys` 由工具注册元数据或工具 adapter 提供。shell 工具应在 adapter 内通过结构化 invocation/AST 产生资源描述；LoopGovernor 不读取原始 shell 字符串，也不维护命令正则表。无法提供语义描述的工具退化到 canonical argument digest 和 result digest，仍受精确重复、证据重复和绝对预算保护。

### 7.2 持久状态

治理状态存入 `RunStateV3.middleware['loop-governor']`，至少包含：

- 最近 32 个 ToolObservation 的脱敏 fingerprint；
- 最近 16 个 proposal class；
- last strong/weak progress digest；
- consecutive no-progress model/tool counters；
- checkpoint requested/completed 状态；
- warning 和 termination reason；
- state schema version。

状态随 node completed 事件和 snapshot 一起提交。完整 identity 由 RunStateStore 保证，因此重启恢复不会清零，也不会跨用户或任务共享。

### 7.3 进展等级

强进展包括：

- todo/action 状态发生迁移；
- 新 artifact/report/dashboard 被结构化提交；
- required output 或 active plan milestone 完成；
- waiting state 被用户、审批或 verification 解除。

弱进展包括：

- 新资源产生此前未见的有效 result digest；
- 新证据 item 关联到 pending action。

以下不算进展：

- 仅增加 tool ledger call id；
- 相同结果被不同命令再次返回；
- prompt 重建、压缩或读取 todo；
- provider action preamble；
- 重放已提交 effect。

### 7.4 判定策略

默认阈值：

- 相同 canonical call 且无新进展连续 3 次：terminate；
- 相同 result digest 连续或窗口内出现 4 次：terminate；
- 同 capability/resource 的只读操作无新证据达到 6 次：checkpoint；
- 12 个 tool observation 或 8 个 model decision 没有强弱进展：checkpoint；
- 32 个弱进展只读操作仍没有强进展：checkpoint；
- checkpoint 后再出现 2 个无进展 model decision：terminate。

checkpoint 是确定性 graph 节点：提交 runtime progress，向模型注入当前 TaskState、已获取证据摘要和“必须汇总、更新计划或结束”的结构化约束。它最多执行一次，不能自身形成新 loop。

终止 outcome：

```ts
{
  status: 'degraded',
  reason: 'loop_capped',
  retryable: true,
  userVisibleItemId,
  details: {
    signal,
    repeatedCapability,
    repeatedResourceCount,
    modelSteps,
    toolCalls,
    taskRevision
  }
}
```

details 不包含敏感参数、完整文件内容或 API key。

## 8. TaskState 进度投影

新增 `TaskProgressProjector`，在每批 tool effect 提交后运行 CAS transaction：

1. 读取当前 thread/turn 的权威 todos；
2. 读取本批 ToolObservation；
3. 合并结构化 artifact refs；
4. 将 result item id 关联到对应 action evidence；
5. 更新 completed/pending actions；
6. 计算 strong/weak progress digest；
7. 提交下一 TaskState revision；
8. 将 task revision 和 progress digest 原子写回 RunState。

投影器不从自由文本猜测 artifact 路径或 action 状态。工具必须通过 ToolHostResult 的结构化 metadata 声明 artifact/evidence；旧工具没有 metadata 时仅更新 ledger，直到对应 todo 或 artifact port 提供权威数据。

todo 更新发生在工具内部时，projector 从 ThreadService 的最新 todo revision 读取，不依赖模型是否随后解释该更新。

## 9. Compaction Governor

### 9.1 压力分解

PromptBuilder 在 build context 时记录：

```text
immutable prefix tokens
tool catalog tokens
active skill tokens
memory tokens
compactable history tokens
current user/task projection tokens
provider total prompt tokens
```

provider 只返回 total 时，fixed overhead 取 `max(0, providerTotal - compactableHistoryEstimate)`。是否压缩主要由 compactable history 和预计节省决定，不能继续使用 `max(historyEstimate, providerPromptTokens)` 直接触发。

### 9.2 有效性条件

一次压缩只有同时满足以下条件才提交：

- predicted net saving 至少为 `max(1024 tokens, compactableHistory 的 10%)`；
- 距上次成功压缩至少新增 2048 compactable tokens 或 8 个 history items；
- source 不只包含一个已有 compaction item；
- source digest 与当前 active compaction lineage 一致；
- 生成后的 active history 只保留一个 compaction summary。

成功压缩后默认冷却 6 个模型决策。达到 hard context threshold 可以绕过冷却，但仍必须满足正净节省。

### 9.3 无效压缩处理

如果 fixed overhead 才是主要压力，或压缩预计无净节省：

1. 跳过 compaction 并记录 `compaction.skipped`；
2. 清理非活动工具 schema、低优先级 memory 和重复 skill reference；
3. 重新计算一次 prompt pressure；
4. 若仍超出模型窗口，尝试现有 capability-aware model route；
5. 无可用模型时返回新的结构化 `context_capacity_exceeded` outcome。

禁止对上一次 compaction summary 单独再次摘要。新历史增长达到条件后，允许将旧 summary 与新增 source 合并为一个新 summary，并保留 lineage/source digest。

## 10. Middleware 生产接线

`KernelV3TurnRunnerOptions` 必须接收显式 MiddlewareChain。runtime factory 构造默认治理链，并校验顺序：

```text
identity scope
-> commit integrity
-> budget accounting/enforcement
-> proposal materialization policy
-> task progress projection
-> loop governor
-> compaction governor
-> terminal response
-> observability
```

RuntimeKernel 的 middleware context 必须携带当前 node 的结构化 facts：proposal class、usage、tool observation、progress digest、compaction plan 和 stop class。facts 由 node result 产生并写入事件，不允许 middleware 直接扫描 thread 自由文本。

现有 process-local `ToolStormBreaker` 只保留给 classic 兼容路径。Kernel v3 不复用其可变 Map。

## 11. 事件、可观测性与用户终态

新增核心事件：

- `proposal.materialized`；
- `budget.consumed`；
- `tool.observed`；
- `task.progress.projected`；
- `governor.warning`；
- `governor.checkpoint.requested`；
- `governor.terminated`；
- `compaction.skipped`；
- `compaction.effective`；
- `runtime.progress.updated`。

所有事件携带完整 run identity 和 schema version。日志只记录 digest、计数和 capability class。

任何治理终止都遵循顺序：

```text
project latest TaskState
-> update runtime_progress item
-> commit structured RunOutcome
-> finish turn
```

用户看到的是“已停止重复读取；当前已完成 X，已生成 Y，下一步 Z”，而不是静默失败、无限工具列表或模型的上下文丢失反问。

## 12. 兼容与迁移

- 旧 RunStateV3 快照加载时为新增 middleware state 和 budget usage ids 补默认值。
- schema migration 不回填历史预算；旧零预算 snapshot 从恢复后的下一次 model/tool observation 开始准确累计。
- 旧 TaskState 保持 V1 schema，通过可选 progress metadata 或独立 governor state 演进，避免重写历史文件。
- SSE 继续兼容现有 assistant reasoning/text event；`runtime_progress` 为可选新 item/event，旧客户端可忽略。
- classic 模式继续使用现有 loop policy 和 ToolStormBreaker，不与 Kernel v3 共享 governor 状态。
- degraded outcome 在兼容 turn status 中仍可表示失败，但必须保留 userVisibleItemId 和结构化 reason，前端优先显示诊断 item。

## 13. 测试设计

实施必须遵循 RED -> GREEN，并覆盖以下层级。

### 13.1 Proposal 与 UI

- 带 reasoning/text/tool intents 的 proposal 在工具执行前提交两个 item；
- crash replay 不重复 assistant item；
- malformed/leaked/context-discontinuity 内容不提交；
- provider 无 reasoning 时创建并更新单个 runtime progress item；
- SSE reducer 和前端分别渲染“思考”与“进度”折叠块。

### 13.2 Budget 与隔离

- 模型决策、多个 tool call、usage 和 cost 精确累计；
- effect replay 不重复累计 toolCallsUsed；
- snapshot 恢复后预算连续；
- 相同 ids 但不同 owner/workspace 的 governor 和 budget 不共享。

### 13.3 Loop Governor

- 三次相同 canonical call 终止；
- 不同调用返回相同 result digest 时终止；
- 同一资源的等价只读操作触发 checkpoint；
- 新 artifact 或 todo 完成会重置强进展窗口；
- 新证据只重置弱进展窗口；
- checkpoint 只执行一次，之后无进展确定性终止；
- 合法的多文件研究任务不会因工具数量本身被提前停止。

### 13.4 TaskState

- todo pending -> in_progress -> completed 正确投影；
- artifact/evidence 通过结构化 metadata 进入 TaskState；
- ledger-only 调用不改变 progress digest；
- CAS 冲突重载后重算，不覆盖并发 todo 更新。

### 13.5 Compaction

- fixed overhead 超阈值但 history 很小时不压缩；
- 低于最小净节省时跳过；
- 冷却期内不重复压缩；
- summary-only source 不再次摘要；
- 新历史增长充足时正确合并 lineage；
- 仍超出容量时返回 `context_capacity_exceeded`，不形成重试 loop。

### 13.6 生产闭环

- 使用 MiniMax M3 事件 fixture 重放原始风暴，在第 3 次精确重复或 checkpoint 后终止，而不是运行到 171 次模型调用；
- DeepSeek 官方、Kimi、MiniMax、本地 vLLM 和 OpenRouter fixture 均产生一致治理语义；
- 开发桌面和 macOS 打包桌面可看到 reasoning/progress 与终止诊断；
- KWorks 和上游 QiongQi 分别通过 focused/full test、typecheck 和 build；
- 核心目录路径无关 diff 一致。

## 14. 发布门禁

只有同时满足以下条件才可宣布生产落地：

1. 代表性风暴重放在确定阈值内停止。
2. 合法复杂金融任务能够完成，不被简单工具数量误杀。
3. reasoning 不再在工具 proposal 分支丢失。
4. provider 无 reasoning 时有真实引擎进度，不生成伪思维。
5. RunState budget 和 governor state 在重启后连续。
6. TaskState 能反映 todo、证据和 artifact 的真实进度。
7. 连续 prompt pressure 不再产生 compaction-per-step。
8. 多用户、多 thread、多 run 隔离测试通过。
9. 两个仓库共享核心实现同步，均位于 `main`，不创建额外分支。
10. 前端开发态和打包桌面端真实验证通过。

## 15. 最终决策

本轮采用完整的 Kernel Governance Plane。reasoning 可见性不是一个孤立 UI 功能，工具风暴也不是某个模型或命令的特殊行为。两者共同依赖同一套持久化运行事实：合法 proposal、真实预算、结构化工具 observation、TaskState 进展和有效压缩。

因此实现必须按上述组件边界推进，禁止退化为：

- 在前端拼接工具过程作为“思考”；
- 给 MiniMax、Kimi 或 vLLM 增加专用循环补丁；
- 对 shell 命令写黑名单正则；
- 只接上现有 process-local middleware；
- 仅提高 step 上限或 compaction threshold。

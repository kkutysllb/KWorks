# QiongQi 任务连续性内核与桌面 Artifact 导航重构规格

## 1. 文档状态

- 日期：2026-07-15
- 状态：已确认，待实施计划
- 决策：完成真实 Kernel v3 状态机，不再以单节点 delegate 包装 classic loop
- 兼容边界：保留现有 HTTP、SSE、CLI、桌面协议和显式 classic 模式
- 适用仓库：
  - `/Users/libing/kk_Projects/KWorks/qiongqi`
  - `/Users/libing/kk_Projects/QiongQi`
  - KWorks 前端和桌面壳，仅保留在 `/Users/libing/kk_Projects/KWorks`

本文补充并修正 `2026-07-15-qiongqi-runtime-kernel-redesign.md` 的落地要求。上一轮规格方向不变，但其 Task 7 和 Task 8 的完成状态不能代表生产链路已经接通；本规格以端到端行为和运行时事实为验收依据。

## 2. 已验证根因

### 2.1 Kernel v3 不是生产控制流所有者

当前 `KernelTurnRunner` 只创建一个名为 `delegate` 的 terminal node，再调用完整的 `TurnOrchestrator.runTurn()`。Kernel 只拥有外层 lease、开始/结束 checkpoint 和最终 outcome，以下关键状态仍属于 classic loop：

- prompt 构建与压缩；
- model step 和 proposal 判断；
- tool dispatch；
- recovery retry；
- step cursor；
- task objective 与 pending actions。

因此，Kernel 快照不能说明模型是否已经响应、工具是否已提交、恢复提示是否已注入，也不能从内部节点恢复。

### 2.2 DurableTaskCapsule 未进入生产链路

`DurableTaskCapsule` 当前只有构造、渲染和孤立单元测试。生产代码没有：

- 从 thread、turn、goal、todos、tool results 构造 capsule；
- 将 capsule 传给 `ContextCompactor.compact()`；
- 单独持久化 capsule；
- 在恢复时按完整 identity 加载 capsule；
- 校验 capsule 与 compaction source digest 的一致性。

因此，所谓 durable capsule 只是未接线的类型，不是运行时事实。

### 2.3 恢复仍由模型文本触发

当前 evaluator 通过自然语言模式识别“上下文丢失、请重述任务”，并在第一次出现时重试。第二次相同输出会通过 evaluator 并正常结束。重试前也没有形成新的结构化 recovery state，只是重新构建近似相同的 prompt。

该机制存在三个不可接受的属性：

1. 控制流依赖模型输出措辞；
2. 不同语言或模型表达会绕过检测；
3. 重试耗尽后，错误反问可能成为用户可见终态。

### 2.4 压缩摘要被错误承担为任务事实

当前压缩器从最近的用户或助手自然语言推断 objective、current state 和 next actions。以下情况会产生歧义：

- 最新用户消息只有“继续”；
- 上一个 task 只存在于旧 compaction item 中；
- assistant 曾经跑偏并留下错误的“下一步”；
- model summary 与 heuristic summary 冲突；
- tool result 已完成，但 assistant 文本仍描述执行前状态。

摘要适合给模型阅读，不适合作为恢复数据库。

### 2.5 测试覆盖了组件，没有覆盖生产闭环

现有测试分别证明 capsule 可以构造、Kernel 可以运行 fake graph、delegate 只执行一次、首次恢复反问会重试、scope digest 可以隔离两个 identity。但没有测试证明：

```text
runtime factory -> Kernel graph -> compaction transaction -> process restart
-> task state restore -> model recovery -> original task continues
```

组件测试全绿与用户观察到的生产失败可以同时成立。

### 2.6 桌面返回任务按钮落入原生标题栏拖拽区域

Electron 使用 `titleBarStyle: "hiddenInset"`。金融 HTML 看板的 toolbar 位于窗口顶部，按钮虽然有 `pointer-events-auto`，但未声明 `-webkit-app-region: no-drag`。在普通浏览器和 happy-dom 中点击有效，在 macOS 打包窗口中会被标题栏原生命中测试截获。

之前删除的 Markdown 下载按钮与当前“返回任务”按钮处于同一区域，二者均无响应与这一根因一致。

## 3. 目标与非目标

### 3.1 必须实现

1. Kernel v3 真实解释多节点 execution graph，并成为默认生产控制流所有者。
2. 建立独立、版本化、可迁移的 `TaskState`，任务事实不依赖 model summary。
3. 上下文压缩成为原子事务，TaskState、摘要、来源 digest 和事件保持一致。
4. 恢复由结构化状态和 proposal class 决定，不通过正则控制 loop。
5. 旧 thread、turn 和 compaction 数据首次读取时可安全迁移。
6. owner、workspace、thread、turn、run 之间没有共享可变状态。
7. 已提交的工具副作用、assistant item 和 SSE event 不会在恢复时重复。
8. 显式 `classic` 继续运行，但 `kernel_v3` 不再隐藏委托 classic。
9. macOS 打包桌面端“返回任务”可以点击并恢复原金融任务页面。
10. 所有通用 QiongQi 核心代码和测试同步到本地上游仓库。

### 3.2 非目标

- 不引入 LangGraph、LangChain 或 Python runtime。
- 不重写前端 HTTP/SSE 协议。
- 不保证缺少工具调用能力的模型具备原生工具能力。
- 不让无法验证 owner/source 的旧数据自动跨 scope 合并。
- 不在本轮删除 classic 模式。
- 不以增加更多 provider 文本正则作为任务恢复方案。

## 4. 权威任务状态

新增 `TaskStateV1`，与 `RunStateV3` 分离存储，但通过完整 `RunIdentity` 引用：

```ts
type TaskStateV1 = {
  version: 1
  identity: RunIdentity
  revision: number
  source: {
    objectiveItemId: string
    sourceItemIds: string[]
    sourceDigest: string
  }
  objective: string
  constraints: string[]
  completedActions: TaskAction[]
  pendingActions: TaskAction[]
  activePlan?: TaskPlanRef
  activeSkillIds: string[]
  artifacts: ArtifactRef[]
  toolLedger: ToolLedgerEntry[]
  waitingFor?: WaitingState
  migration?: MigrationMetadata
  createdAt: string
  updatedAt: string
}
```

### 4.1 权威顺序

运行时按以下优先级获取任务事实：

1. 当前 run 的已验证 `TaskStateV1`；
2. 当前 turn 的原始用户请求与显式 goal/todos；
3. 同 thread、同 owner、同 workspace 的已验证前一 task state；
4. 可校验 source ids/digest 的 compaction metadata；
5. 旧 assistant summary 只能作为低置信度迁移输入，不能覆盖更高层事实。

模型输出永远不能直接修改 objective。模型 proposal 只能提出 action，由 Kernel commit node 验证并写入新的 task revision。

### 4.2 TaskState store

新增 `TaskStateStore` port，支持：

- `load(identity)`；
- `save(next, expectedRevision)`，使用 compare-and-swap；
- `listForThread(scope)`，仅供迁移；
- `appendMigrationRecord(record)`。

file adapter 使用完整 scope digest，不使用裸 threadId 或 runId。内存 adapter 使用 `encodeScopeKey()`。任何 identity 不匹配均返回结构化 scope violation，不能静默 fallback。

## 5. 真实 Kernel v3 graph

默认 graph：

```text
prepare-turn
  -> restore-task
  -> build-context
  -> invoke-model
  -> normalize-proposal
  -> evaluate
       -> commit-assistant -> complete
       -> prepare-tools -> commit-tools -> build-context
       -> recover-context -> build-context
       -> wait-user -> suspend
       -> fail -> terminal
```

每个 node 都有稳定 id、attempt、checkpoint policy 和 effect class。Kernel 在以下边界持久化：

- node 开始前；
- model request prepare 后；
- proposal normalize 后；
- compaction transaction commit 后；
- tool effect prepare/commit 后；
- task revision commit 后；
- suspend 或 terminal outcome 后。

`KernelTurnRunner` 不再接受整回合 `delegate`。classic 由 runtime factory 的独立分支构造。

## 6. Context Engine 与压缩事务

### 6.1 构建上下文

`build-context` node 依次加载：

1. immutable system prefix；
2. 当前 work mode 与技能约束；
3. 当前 TaskState 的只读投影；
4. scope 内 memory；
5. 最新有效 compaction summary；
6. 未压缩的 recent history；
7. 当前 turn 的用户请求或 Kernel 生成的恢复 continuation entry。

TaskState 投影明确标记为 runtime data，并携带 identity hash、revision 和 source digest。provider compatibility adapter 需要补 user message 时，内容从该投影生成，不再使用与具体任务无关的固定 continuation 字符串。

### 6.2 原子压缩

压缩流程：

1. 冻结待压缩 source item ids 和 source digest；
2. 从当前 TaskState 和已提交事件生成下一 task revision；
3. 生成 heuristic summary；
4. 可选调用 model summary，但只能改变摘要正文；
5. 校验 summary 不改变 objective、identity、revision 和 digest；
6. 在同一 compaction commit 中写 task revision、compaction item 和事件；
7. 最后推进 active compaction pointer。

任一步失败时不推进 pointer，旧历史和旧 TaskState 继续有效。

## 7. 恢复语义

### 7.1 Proposal 分类

`normalize-proposal` 输出结构化 class：

- `final_text`；
- `tool_intents`；
- `empty`；
- `length_limited`；
- `safety_or_refusal`；
- `protocol_error`；
- `context_discontinuity`。

`context_discontinuity` 可以参考 provider metadata 和语义 classifier，但只能作为 proposal class，不能直接通过文本正则终止或继续 loop。

### 7.2 Context recovery node

当 TaskState 显示任务仍可执行，而 proposal 为 `context_discontinuity` 时：

1. 拒绝提交该 assistant text；
2. 增加 `recovery.attempts`；
3. 记录 provider、task revision 和 proposal digest；
4. 注入结构化 recovery continuation entry；
5. 返回 `build-context`。

恢复 entry 包含 objective、已完成动作、唯一下一动作、相关 artifacts 和 tool ledger 摘要。它不包含“猜测任务”的指令。

恢复预算耗尽后返回：

```ts
{
  status: 'degraded',
  reason: 'context_recovery_exhausted',
  retryable: true
}
```

TaskState 保持可恢复，用户可重试或切换模型，但不需要重述任务。引擎生成的诊断 item 必须说明任务已保存，不得把模型的错误反问作为最终答复。

## 8. 旧数据迁移

旧 thread 首次运行 Kernel v3 时执行惰性迁移：

1. 验证 thread owner 和 workspace；
2. 读取当前 turn 原始 user item；
3. 读取显式 goal、todos、plan metadata；
4. 配对 tool call/result，构造 tool ledger；
5. 验证 compaction source ids/digest；
6. 从最新可信用户请求确定 objective；
7. 生成 `TaskStateV1 revision=1` 和 migration event。

迁移规则：

- “继续”等 continuation-only 消息不成为 objective；
- assistant 文本不能覆盖用户 objective；
- 旧 compaction 没有 source ids/digest 时，只能补充 current state，不能改变 objective；
- 找到多个冲突 owner/workspace 时拒绝迁移并记录 scope violation；
- 迁移是幂等的，同一 source digest 只生成一个 revision；
- 原始历史不删除，便于回滚和审计。

## 9. 隔离与并发

全面审计并替换以下不完整键：

- prompt pressure；
- auto model route；
- tool catalog snapshot；
- recovery counter；
- loop/tool storm window；
- run lease；
- task capsule cache；
- memory retrieval/write；
- child/sub-agent task map；
- artifact/task association。

统一使用 `ScopeKey` 或从 `RunIdentity` 派生的 digest。lease 也使用完整 scope digest，不能只使用 `runId` 文件名。

每次 store load、event append、tool commit、memory read 和 task revision commit 都重新校验 identity，避免调用方传错状态时串任务。

## 10. 桌面 Artifact 返回导航

### 10.1 实现约束

- 为 Electron 标题栏内的可交互控件提供统一 `desktop-no-drag` primitive。
- 金融 artifact toolbar 明确使用 `-webkit-app-region: no-drag`。
- iframe 保持在 toolbar 下层，不能覆盖 toolbar hit target。
- 返回动作继续调用 artifact context 的 `deselect()`，不做历史路由猜测。
- Escape 与按钮使用同一 `closePreview()` 回调。
- 保持焦点恢复和 inert sibling 清理。

### 10.2 测试层级

1. React 单元测试：按钮和 Escape 调用同一关闭动作。
2. CSS/DOM contract test：toolbar/button 具有 desktop no-drag contract。
3. Electron 打包态 E2E：打开 HTML artifact、点击右上角返回、断言 dialog 消失且原 finance task 可见。
4. macOS titlebar 回归：点击坐标不得触发 window drag，且连续打开/关闭两次仍有效。

## 11. 兼容与回退

- `orchestrationMode: classic` 继续构造 `TurnOrchestrator`。
- `orchestrationMode: kernel_v3` 只构造真实 Kernel graph。
- Kernel 启动前、尚未 prepare effect 时可按配置回退 classic。
- 任一 effect prepare 后禁止切换 engine；只能恢复、suspend 或失败。
- 当前 `/v1`、KWorks `/api`、SSE item/event 形状保持兼容，只增加可选 runtime metadata。
- 旧 RunStateV3 delegate 快照标记为 legacy shell，不作为真实 node resume cursor；迁移时从 thread/event 事实重新建立 graph cursor。

## 12. 测试与发布门禁

### 12.1 必须先失败的端到端测试

- runtime factory 默认 Kernel v3 不得构造 classic delegate；
- compaction 后连续两次 context discontinuity 不得提交模型反问；
- 进程在 proposal、tool prepare、tool commit、task commit 后崩溃均能恢复；
- 已提交写工具不重复执行；
- 旧 thread 迁移后 objective 与最后可信用户任务一致；
- 两个 owner 使用相同 workspace/thread/turn/run id 仍完全隔离；
- 同一用户两个并行 thread 的 recovery、budget 和 task state 不串线；
- DeepSeek、MiniMax M3、Kimi、本地 vLLM 和 OpenRouter fixture 产生结构化 outcome；
- macOS 打包态“返回任务”真实点击有效。

### 12.2 验证矩阵

- QiongQi focused Vitest；
- QiongQi full test、typecheck、build；
- KWorks frontend unit、typecheck、desktop static build；
- Electron main/preload build；
- macOS packaged smoke 与 artifact navigation E2E；
- KWorks / QiongQi core sync verifier；
- 两个仓库工作树与 `main` 分支检查。

## 13. 可观测性

新增或完善结构化事件：

- `task.created`；
- `task.migrated`；
- `task.revision.committed`；
- `compaction.prepared`；
- `compaction.committed`；
- `recovery.started`；
- `recovery.exhausted`；
- `scope.violation`；
- `legacy.kernel_shell.migrated`；

指标只记录 provider class、outcome reason、次数和耗时，不记录任务正文、工具参数、密钥或文件内容。

## 14. 验收标准

本轮只有在以下条件全部满足后才可宣布完成：

1. 默认 Kernel v3 生产路径中不存在整回合 classic delegate。
2. 真实压缩路径创建、持久化并恢复 TaskState。
3. 任务恢复无需解析 assistant 最终文本决定控制流。
4. 重复 context discontinuity 不会要求用户重述，也不会切换到错误任务。
5. 旧任务完成惰性迁移且不跨 owner/workspace。
6. crash replay 不重复已提交副作用。
7. provider fixture 与隔离测试全部通过。
8. 打包 macOS 桌面端返回按钮经真实点击验证通过。
9. KWorks 与上游 QiongQi 的共享核心文件同步校验通过。
10. 所有改动位于两个仓库的 `main`，没有遗留临时分支或工作树。

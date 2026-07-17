import { randomUUID } from 'node:crypto'
import {
  ModelProposalSchema,
  TaskStateV1Schema,
  type RunEventEnvelope,
  type RunIdentity,
  type RunOutcome,
  type RunStateV3
} from '@qiongqi/contracts'
import type { RunEventStore, RunLeaseStore, RunSnapshotStore } from '@qiongqi/ports'
import { MiddlewareChain } from './middleware-chain.js'
import {
  outgoingEdges,
  validateExecutionGraph,
  type ExecutionGraph,
  type RuntimeNode
} from './execution-graph.js'
import type { MiddlewareCommand, RuntimeHook } from './runtime-middleware.js'
import type { RuntimeNodeHandler, RuntimeNodeResult } from './runtime-kernel-context.js'

export type RuntimeKernelOptions = {
  graph: ExecutionGraph
  snapshots: RunSnapshotStore
  events: RunEventStore
  leases: RunLeaseStore
  holderId: string
  nowIso?: () => string
  leaseTtlMs?: number
  middleware?: MiddlewareChain
  nodes: Record<string, RuntimeNodeHandler>
}

type CompletedNodePayload = {
  nodeId: string
  stepIndex: number
  condition: string
  commands: MiddlewareCommand[]
  facts?: Record<string, unknown>
  value?: unknown
  outcome?: RunOutcome
}

export class RuntimeKernel {
  private readonly options: Omit<RuntimeKernelOptions, 'nowIso' | 'leaseTtlMs' | 'middleware'> &
    Required<Pick<RuntimeKernelOptions, 'nowIso' | 'leaseTtlMs' | 'middleware'>>

  constructor(options: RuntimeKernelOptions) {
    validateExecutionGraph(options.graph)
    this.options = {
      nowIso: () => new Date().toISOString(),
      leaseTtlMs: 30_000,
      middleware: new MiddlewareChain(),
      ...options
    }
  }

  async run(identity: RunIdentity): Promise<RunOutcome> {
    const { leases, snapshots, holderId } = this.options
    const lease = await leases.acquire(identity, holderId, this.options.leaseTtlMs)
    if (!lease.acquired) {
      return {
        status: 'failed',
        reason: 'runtime_error',
        retryable: true,
        details: { code: 'lease_unavailable' }
      }
    }

    try {
      let state = await snapshots.load(identity)
      if (!state) state = this.initialState(identity)
      this.assertStateIdentity(identity, state)
      if (isTerminal(state)) {
        const outcome = outcomeFromTerminalState(state)
        const migrated = this.migrateTerminalGraphMetadata(state)
        if (migrated !== state) await snapshots.save(migrated)
        return outcome
      }
      const graphCompatibility = this.graphCompatibility(state)
      if (graphCompatibility) return graphCompatibility

      state = await this.replayAfterCheckpoint(identity, state)
      if (isTerminal(state)) {
        state = this.migrateTerminalGraphMetadata(state)
        await snapshots.save(state)
        return outcomeFromTerminalState(state)
      }

      state = this.migrateGraphState(state)
      await snapshots.save(state)

      state = { ...state, status: 'running', updatedAt: this.options.nowIso() }
      await snapshots.save(state)

      const beforeRun = await this.options.middleware.run(
        'beforeRun',
        this.middlewareContext(identity, state, 'beforeRun')
      )
      const beforeRunOutcome = this.commandOutcome(beforeRun?.commands)
      if (beforeRunOutcome) {
        state = this.withOutcome(this.applyCommands(state, beforeRun?.commands), beforeRunOutcome)
        await snapshots.save(state)
        return beforeRunOutcome
      }

      while (true) {
        const node = this.nodeFor(state.cursor.nodeId)
        if (checkpointsBefore(node)) await snapshots.save(state)

        const started = await this.recordEvent(identity, state, node.id, 'node.started', {
          nodeId: node.id,
          stepIndex: state.cursor.stepIndex
        })
        state = {
          ...state,
          cursor: { ...state.cursor, checkpointSeq: started.seq },
          updatedAt: this.options.nowIso()
        }

        const before = await this.options.middleware.run(
          'beforeNode',
          this.middlewareContext(identity, state, 'beforeNode', node)
        )
        const beforeOutcome = this.commandOutcome(before?.commands)
        if (beforeOutcome) {
          state = this.withOutcome(this.applyCommands(state, before?.commands), beforeOutcome)
          await snapshots.save(state)
          return beforeOutcome
        }

        const handler = this.options.nodes[node.id]
        if (!handler) throw new Error(`missing runtime node handler: ${node.id}`)
        const result = await handler({ identity, state, node, hook: 'beforeNode' })
        const commands = [...(before?.commands ?? []), ...(result?.commands ?? [])]
        this.applyCommands(state, commands)
        const condition = result?.condition ?? 'next'
        const outcome = result?.outcome
          ?? this.commandOutcome(commands)
          ?? (node.terminal
            ? { status: 'completed', reason: 'normal_stop', retryable: false } as const
            : undefined)
        const facts = result?.facts === undefined
          ? undefined
          : canonicalizeFacts(result.facts)
        const payload: CompletedNodePayload = {
          nodeId: node.id,
          stepIndex: state.cursor.stepIndex,
          condition,
          commands,
          ...(facts ? { facts } : {}),
          ...(result && 'value' in result ? { value: result.value } : {}),
          ...(outcome ? { outcome } : {})
        }
        const completed = await this.recordEvent(
          identity,
          state,
          node.id,
          'node.completed',
          payload
        )
        const committedPayload = parseCompletedNodePayload(completed.payload)
        state = this.reduceCompletedNode(state, node, committedPayload, completed.seq)
        if (checkpointsAfter(node) || isTerminal(state)) await snapshots.save(state)

        const afterNode = await this.options.middleware.run(
          'afterNode',
          this.middlewareContext(identity, state, 'afterNode', node, committedPayload.facts)
        )
        if (isTerminal(state)) {
          // Terminal outcomes are monotonic. Middleware may record diagnostics,
          // but cannot reopen or replace an already committed terminal result.
          await this.options.middleware.run(
            'afterRun',
            this.middlewareContext(identity, state, 'afterRun')
          )
          return outcomeFromTerminalState(state)
        }

        state = this.applyCommands(state, afterNode?.commands)
        const afterOutcome = this.commandOutcome(afterNode?.commands)
        if (afterOutcome) {
          state = this.withOutcome(state, afterOutcome)
          await snapshots.save(state)
          return afterOutcome
        }
      }
    } catch (error) {
      const outcome: RunOutcome = {
        status: 'failed',
        reason: 'runtime_error',
        retryable: true,
        details: { message: error instanceof Error ? error.message : String(error) }
      }
      const state = await snapshots.load(identity)
      if (state && !isTerminal(state)) {
        await snapshots.save(this.withOutcome(state, outcome))
      }
      return state && isTerminal(state) ? outcomeFromTerminalState(state) : outcome
    } finally {
      await leases.release(identity, holderId)
    }
  }

  private initialState(identity: RunIdentity): RunStateV3 {
    const now = this.options.nowIso()
    return {
      version: 3,
      graphVersion: this.options.graph.version,
      runtimeMode: 'kernel_v3',
      ...identity,
      status: 'created',
      cursor: {
        stepIndex: 0,
        nodeId: this.options.graph.startNodeId,
        attempt: 0,
        checkpointSeq: 0
      },
      budgets: {
        stepsUsed: 0,
        toolCallsUsed: 0,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0
      },
      recovery: { attempts: 0, maxAttempts: 1 },
      middleware: {},
      nodeData: {},
      taskRevision: 0,
      pendingEffects: [],
      committedEffects: [],
      createdAt: now,
      updatedAt: now
    }
  }

  private graphCompatibility(state: RunStateV3): RunOutcome | undefined {
    const targetVersion = this.options.graph.version
    if (state.graphVersion === targetVersion) return undefined
    if (
      state.graphVersion === 'kernel-v3-production-v1'
      && targetVersion === 'kernel-v3-production-v2'
    ) {
      return undefined
    }
    if (
      targetVersion === 'kernel-v3-production-v3'
      && (state.graphVersion === 'kernel-v3-production-v1'
        || state.graphVersion === 'kernel-v3-production-v2')
    ) {
      return undefined
    }
    return {
      status: 'failed',
      reason: 'runtime_error',
      retryable: false,
      details: {
        code: 'unsupported_graph_version',
        storedGraphVersion: state.graphVersion,
        runtimeGraphVersion: targetVersion
      }
    }
  }

  private migrateGraphState(state: RunStateV3): RunStateV3 {
    if (state.graphVersion === this.options.graph.version) return state
    if (
      state.graphVersion === 'kernel-v3-production-v2'
      && this.options.graph.version === 'kernel-v3-production-v3'
    ) {
      if (!proposalNeedsAccounting(state.cursor.nodeId)) {
        return { ...state, graphVersion: this.options.graph.version }
      }
      requireMigratableProposal(state, 'production graph v2')
      return {
        ...state,
        graphVersion: this.options.graph.version,
        cursor: { ...state.cursor, nodeId: 'account-model' },
        nodeData: state.cursor.nodeId === 'evaluate'
          ? state.nodeData
          : {
              ...state.nodeData,
              'v2-accounting-migration': {
                resumeNodeId: state.cursor.nodeId,
                consumed: false
              }
            }
      }
    }
    if (
      state.graphVersion !== 'kernel-v3-production-v1'
      || (this.options.graph.version !== 'kernel-v3-production-v2'
        && this.options.graph.version !== 'kernel-v3-production-v3')
    ) {
      return state
    }
    const revalidatesProposal = state.cursor.nodeId === 'prepare-tools'
      || state.cursor.nodeId === 'commit-tools'
      || state.cursor.nodeId === 'commit-assistant'
    if (!revalidatesProposal) {
      if (
        this.options.graph.version === 'kernel-v3-production-v3'
        && proposalNeedsAccounting(state.cursor.nodeId)
      ) {
        requireMigratableProposal(state, 'production graph v1')
        return {
          ...state,
          graphVersion: this.options.graph.version,
          cursor: { ...state.cursor, nodeId: 'account-model' },
          nodeData: state.cursor.nodeId === 'evaluate'
            ? state.nodeData
            : {
                ...state.nodeData,
                'v1-accounting-migration': {
                  resumeNodeId: state.cursor.nodeId,
                  consumed: false
                }
              }
        }
      }
      return { ...state, graphVersion: this.options.graph.version }
    }
    const proposal = ModelProposalSchema.safeParse(state.nodeData['normalize-proposal'])
    const task = TaskStateV1Schema.safeParse(state.nodeData['restore-task'])
    const requiresToolProposal = state.cursor.nodeId !== 'commit-assistant'
    if (
      !proposal.success
      || !task.success
      || (requiresToolProposal && proposal.data.toolIntents.length === 0)
    ) {
      throw new Error(
        'production graph v1 tool snapshot is missing a normalized tool proposal or task state'
      )
    }
    const prepared = state.cursor.nodeId === 'commit-tools'
      ? preparedCallIds(state.nodeData['prepare-tools'])
      : []
    if (state.cursor.nodeId === 'commit-tools' && prepared.length === 0) {
      throw new Error('production graph v1 commit-tools snapshot is missing prepared calls')
    }
    return {
      ...state,
      graphVersion: this.options.graph.version,
      cursor: {
        ...state.cursor,
        nodeId: this.options.graph.version === 'kernel-v3-production-v3'
          ? 'account-model'
          : 'evaluate'
      },
      nodeData: prepared.length > 0
        ? {
            ...state.nodeData,
            'v1-proposal-migration': {
              sourceNodeId: state.cursor.nodeId,
              preparedCallIds: prepared,
              reconciled: false,
              abortFinishedAt: this.options.nowIso()
            }
          }
        : state.nodeData
    }
  }

  private migrateTerminalGraphMetadata(state: RunStateV3): RunStateV3 {
    if (
      state.graphVersion === 'kernel-v3-production-v1'
      && this.options.graph.version === 'kernel-v3-production-v2'
    ) {
      return { ...state, graphVersion: this.options.graph.version }
    }
    if (
      this.options.graph.version === 'kernel-v3-production-v3'
      && (state.graphVersion === 'kernel-v3-production-v1'
        || state.graphVersion === 'kernel-v3-production-v2')
    ) {
      return { ...state, graphVersion: this.options.graph.version }
    }
    return state
  }

  private async replayAfterCheckpoint(
    identity: RunIdentity,
    initial: RunStateV3
  ): Promise<RunStateV3> {
    let state = initial
    const events = await this.options.events.listAfter(identity, state.cursor.checkpointSeq)
    for (const event of events.sort((left, right) => left.seq - right.seq)) {
      this.assertEventIdentity(identity, event)
      if (event.eventType === 'node.started') {
        state = {
          ...state,
          cursor: { ...state.cursor, checkpointSeq: event.seq },
          updatedAt: event.timestamp
        }
        continue
      }
      if (event.eventType !== 'node.completed') continue
      const payload = parseCompletedNodePayload(event.payload)
      if (payload.nodeId !== state.cursor.nodeId) {
        throw new Error(
          `run event cursor mismatch: expected ${state.cursor.nodeId}, received ${payload.nodeId}`
        )
      }
      const node = this.nodeFor(payload.nodeId)
      state = this.reduceCompletedNode(state, node, payload, event.seq)
      const afterNode = await this.options.middleware.run(
        'afterNode',
        this.middlewareContext(identity, state, 'afterNode', node, payload.facts)
      )
      if (!isTerminal(state)) {
        state = this.applyCommands(state, afterNode?.commands)
        const afterOutcome = this.commandOutcome(afterNode?.commands)
        if (afterOutcome) state = this.withOutcome(state, afterOutcome)
      }
    }
    return state
  }

  private reduceCompletedNode(
    state: RunStateV3,
    node: RuntimeNode,
    payload: CompletedNodePayload,
    checkpointSeq: number
  ): RunStateV3 {
    let next = this.applyCommands(state, payload.commands)
    if ('value' in payload) {
      next = {
        ...next,
        nodeData: { ...next.nodeData, [node.id]: payload.value }
      }
    }
    if (payload.outcome) {
      return {
        ...this.withOutcome(next, payload.outcome),
        cursor: { ...next.cursor, checkpointSeq },
        updatedAt: this.options.nowIso()
      }
    }

    const jump = [...payload.commands].reverse().find((command) => command.type === 'jump')
    const edge = jump
      ? { to: jump.nodeId, loop: false }
      : outgoingEdges(this.options.graph, node.id, payload.condition)[0]
    if (!edge) throw new Error(`no graph edge for ${node.id} condition ${payload.condition}`)
    this.nodeFor(edge.to)
    return {
      ...next,
      status: 'running',
      cursor: {
        stepIndex: next.cursor.stepIndex + 1,
        nodeId: edge.to,
        attempt: edge.loop ? next.cursor.attempt + 1 : 0,
        checkpointSeq
      },
      updatedAt: this.options.nowIso()
    }
  }

  private middlewareContext(
    identity: RunIdentity,
    state: RunStateV3,
    hook: RuntimeHook,
    node?: RuntimeNode,
    facts?: Readonly<Record<string, unknown>>
  ) {
    return { identity, state, node, hook, facts, commands: [] as const }
  }

  private applyCommands(
    state: RunStateV3,
    commands: readonly MiddlewareCommand[] | undefined
  ): RunStateV3 {
    let next = state
    for (const command of commands ?? []) {
      if (command.type === 'set-middleware-state') {
        next = {
          ...next,
          middleware: { ...next.middleware, [command.id]: command.state }
        }
      }
      if (command.type === 'set-budget') {
        next = { ...next, budgets: { ...next.budgets, [command.key]: command.value } }
      }
      if (command.type === 'add-budget') {
        next = addBudget(next, command)
      }
      if (command.type === 'set-node-data') {
        next = { ...next, nodeData: { ...next.nodeData, [command.nodeId]: command.value } }
      }
      if (command.type === 'set-task-revision') {
        if (command.revision < next.taskRevision) {
          throw new Error(
            `task revision cannot move backwards: ${next.taskRevision} -> ${command.revision}`
          )
        }
        next = { ...next, taskRevision: command.revision }
      }
      if (command.type === 'set-recovery') {
        next = { ...next, recovery: command.recovery }
      }
      if (command.type === 'set-effects') {
        next = {
          ...next,
          pendingEffects: command.pendingEffects,
          committedEffects: command.committedEffects
        }
      }
    }
    return next
  }

  private commandOutcome(commands: readonly MiddlewareCommand[] | undefined): RunOutcome | undefined {
    const command = commands?.find(
      (candidate) => candidate.type === 'terminate' || candidate.type === 'suspend'
    )
    return command?.type === 'terminate' || command?.type === 'suspend'
      ? command.outcome
      : undefined
  }

  private withOutcome(state: RunStateV3, outcome: RunOutcome): RunStateV3 {
    if (isTerminal(state)) return state
    return {
      ...state,
      status: outcome.status,
      outcome,
      updatedAt: this.options.nowIso()
    }
  }

  private nodeFor(nodeId: string): RuntimeNode {
    const node = this.options.graph.nodes.find((candidate) => candidate.id === nodeId)
    if (!node) throw new Error(`unknown graph node: ${nodeId}`)
    return node
  }

  private assertStateIdentity(identity: RunIdentity, state: RunStateV3): void {
    for (const field of identityFields) {
      if (state[field] !== identity[field]) {
        throw new Error(`run state identity mismatch: ${field}`)
      }
    }
  }

  private assertEventIdentity(identity: RunIdentity, event: RunEventEnvelope): void {
    for (const field of identityFields) {
      if (event[field] !== identity[field]) {
        throw new Error(`run event identity mismatch: ${field}`)
      }
    }
  }

  private async recordEvent(
    identity: RunIdentity,
    state: RunStateV3,
    nodeId: string,
    eventType: string,
    payload: unknown
  ): Promise<RunEventEnvelope> {
    const existing = await this.options.events.listAfter(identity, 0)
    const seq = existing.reduce((max, event) => Math.max(max, event.seq), 0) + 1
    return this.options.events.append({
      eventId: randomUUID(),
      seq,
      ...identity,
      stepId: nodeId,
      nodeAttemptId: `${nodeId}:${state.cursor.attempt}`,
      eventType,
      payload,
      timestamp: this.options.nowIso()
    })
  }
}

const identityFields = [
  'ownerUserId',
  'workspaceKey',
  'threadId',
  'turnId',
  'runId'
] as const

function checkpointsBefore(node: RuntimeNode): boolean {
  return node.checkpoint === 'before' || node.checkpoint === 'both'
}

function checkpointsAfter(node: RuntimeNode): boolean {
  return node.checkpoint === 'after' || node.checkpoint === 'both'
}

function isTerminal(state: RunStateV3): boolean {
  return state.status === 'completed'
    || state.status === 'degraded'
    || state.status === 'failed'
    || state.status === 'aborted'
    || state.status === 'suspended'
}

function outcomeFromTerminalState(state: RunStateV3): RunOutcome {
  return state.outcome ?? {
    status: state.status as RunOutcome['status'],
    reason: 'runtime_error',
    retryable: false
  }
}

function preparedCallIds(value: unknown): string[] {
  if (!value || typeof value !== 'object') return []
  const calls = (value as { calls?: unknown }).calls
  if (!Array.isArray(calls)) return []
  return calls.flatMap((call) => {
    if (!call || typeof call !== 'object') return []
    const callId = (call as { callId?: unknown }).callId
    return typeof callId === 'string' && callId ? [callId] : []
  })
}

function proposalNeedsAccounting(nodeId: string): boolean {
  return [
    'evaluate',
    'commit-assistant',
    'materialize-proposal',
    'prepare-tools',
    'commit-tools',
    'recover-context',
    'wait-user',
    'fail'
  ].includes(nodeId)
}

function requireMigratableProposal(state: RunStateV3, source: string): void {
  const proposal = ModelProposalSchema.safeParse(state.nodeData['normalize-proposal'])
  const task = TaskStateV1Schema.safeParse(state.nodeData['restore-task'])
  if (!proposal.success || !task.success) {
    throw new Error(`${source} snapshot is missing a normalized proposal or task state`)
  }
}

function parseCompletedNodePayload(value: unknown): CompletedNodePayload {
  if (!value || typeof value !== 'object') throw new Error('invalid node.completed payload')
  const record = value as Record<string, unknown>
  if (typeof record.nodeId !== 'string' || !record.nodeId) {
    throw new Error('invalid node.completed nodeId')
  }
  if (!Number.isInteger(record.stepIndex) || (record.stepIndex as number) < 0) {
    throw new Error('invalid node.completed stepIndex')
  }
  if (typeof record.condition !== 'string' || !record.condition) {
    throw new Error('invalid node.completed condition')
  }
  if (!Array.isArray(record.commands)) throw new Error('invalid node.completed commands')
  if (record.facts !== undefined && (!record.facts || typeof record.facts !== 'object' || Array.isArray(record.facts))) {
    throw new Error('invalid node.completed facts')
  }
  return record as CompletedNodePayload
}

function canonicalizeFacts(facts: Record<string, unknown>): Record<string, unknown> {
  const serialized = JSON.stringify(facts)
  const canonical = serialized === undefined ? {} : JSON.parse(serialized) as unknown
  if (!canonical || typeof canonical !== 'object' || Array.isArray(canonical)) {
    throw new Error('runtime node facts must serialize to a JSON object')
  }
  return canonical as Record<string, unknown>
}

const budgetKeys = [
  'stepsUsed',
  'toolCallsUsed',
  'inputTokens',
  'outputTokens',
  'costUsd'
] as const

function addBudget(
  state: RunStateV3,
  command: Extract<MiddlewareCommand, { type: 'add-budget' }>
): RunStateV3 {
  validateBudgetDelta(command.delta)
  if (
    command.usageId !== undefined
    && (typeof command.usageId !== 'string' || command.usageId.length === 0)
  ) {
    throw new Error('invalid budget usage id')
  }
  const processedUsageIds = budgetUsageIds(state)
  if (command.usageId && processedUsageIds.includes(command.usageId)) return state

  const budgets = { ...state.budgets }
  for (const key of budgetKeys) {
    budgets[key] += command.delta[key] ?? 0
    if (!Number.isFinite(budgets[key])) throw new Error(`budget overflow: ${key}`)
  }
  if (!command.usageId) return { ...state, budgets }

  return {
    ...state,
    budgets,
    middleware: {
      ...state.middleware,
      'budget-accounting': {
        version: 1,
        data: { processedUsageIds: [...processedUsageIds, command.usageId] }
      }
    }
  }
}

function validateBudgetDelta(delta: unknown): asserts delta is Partial<RunStateV3['budgets']> {
  if (!delta || typeof delta !== 'object' || Array.isArray(delta)) {
    throw new Error('invalid budget delta: expected object')
  }
  for (const [key, value] of Object.entries(delta)) {
    if (!budgetKeys.includes(key as typeof budgetKeys[number])) {
      throw new Error(`invalid budget delta key: ${key}`)
    }
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new Error(`invalid budget delta: ${key}`)
    }
    if (key !== 'costUsd' && !Number.isInteger(value)) {
      throw new Error(`invalid budget delta: ${key}`)
    }
  }
}

function budgetUsageIds(state: RunStateV3): string[] {
  const accounting = state.middleware['budget-accounting']
  if (!accounting) return []
  if (accounting.version !== 1) {
    throw new Error(`unsupported budget-accounting middleware version: ${accounting.version}`)
  }
  const data = accounting.data
  if (!data || typeof data !== 'object' || !Array.isArray((data as { processedUsageIds?: unknown }).processedUsageIds)) {
    throw new Error('invalid budget-accounting middleware state')
  }
  const ids = (data as { processedUsageIds: unknown[] }).processedUsageIds
  if (!ids.every((id) => typeof id === 'string' && id.length > 0)) {
    throw new Error('invalid budget-accounting usage ids')
  }
  return ids as string[]
}

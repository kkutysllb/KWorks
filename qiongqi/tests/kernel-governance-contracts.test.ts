import { describe, expect, it } from 'vitest'
import {
  ModelProposalSchema,
  RunOutcomeSchema,
  RuntimeProgressTurnItem,
  ToolObservationSchema,
  TurnItem
} from '@qiongqi/contracts'
import { makeRuntimeProgressItem } from '@qiongqi/domain'

describe('kernel governance contracts', () => {
  it('parses runtime progress and defaults evidence and artifact counts', () => {
    const progress = RuntimeProgressTurnItem.parse({
      id: 'progress_1',
      turnId: 'turn_1',
      threadId: 'thread_1',
      role: 'system',
      status: 'completed',
      createdAt: '2026-07-16T00:00:00.000Z',
      kind: 'runtime_progress',
      phase: 'executing',
      summary: 'Running repository checks',
      modelSteps: 2,
      toolCalls: 3
    })

    expect(progress.evidenceCount).toBe(0)
    expect(progress.artifactCount).toBe(0)
    expect(TurnItem.parse(progress).kind).toBe('runtime_progress')
    expect(RuntimeProgressTurnItem.safeParse({ ...progress, summary: '' }).success).toBe(false)
    expect(RuntimeProgressTurnItem.safeParse({ ...progress, modelSteps: -1 }).success).toBe(false)
    expect(RuntimeProgressTurnItem.safeParse({ ...progress, unexpected: true }).success).toBe(false)
  })

  it('constructs a completed system runtime progress item', () => {
    const progress = makeRuntimeProgressItem({
      id: 'progress_2',
      turnId: 'turn_1',
      threadId: 'thread_1',
      phase: 'checkpoint',
      summary: 'Checkpoint persisted',
      modelSteps: 4,
      toolCalls: 2,
      evidenceCount: 5,
      artifactCount: 1,
      reason: 'Periodic checkpoint'
    })

    expect(progress).toMatchObject({
      id: 'progress_2',
      role: 'system',
      status: 'completed',
      kind: 'runtime_progress',
      phase: 'checkpoint',
      modelSteps: 4,
      toolCalls: 2,
      evidenceCount: 5,
      artifactCount: 1,
      reason: 'Periodic checkpoint'
    })
    expect(RuntimeProgressTurnItem.parse(progress)).toEqual(progress)
  })

  it('preserves model proposal usage counters', () => {
    const proposal = ModelProposalSchema.parse({
      proposalId: 'proposal_1',
      model: 'provider-neutral-model',
      stopClass: 'normal',
      integrity: {
        leakedProtocolText: false,
        malformedToolCall: false,
        completeToolCalls: true
      },
      text: 'Done',
      reasoning: '',
      toolIntents: [],
      usage: {
        promptTokens: 120,
        completionTokens: 30,
        totalTokens: 150,
        cacheHitRate: null,
        turns: 1
      }
    })

    expect(proposal.usage?.promptTokens).toBe(120)
    expect(proposal.usage?.completionTokens).toBe(30)
  })

  it('parses a structured tool observation with resource and artifact refs', () => {
    const observation = ToolObservationSchema.parse({
      callId: 'call_1',
      toolName: 'write_file',
      effect: 'idempotent-write',
      capabilityClass: 'workspace.files',
      resourceKeys: ['workspace:/repo/src/index.ts'],
      canonicalArgumentsDigest: 'sha256:arguments',
      resultDigest: 'sha256:result',
      resultItemId: 'item_result_1',
      artifactRefs: [{
        path: 'src/index.ts',
        kind: 'file',
        producedByCallId: 'call_1'
      }],
      failed: false,
      replayed: false
    })

    expect(observation.resourceKeys).toEqual(['workspace:/repo/src/index.ts'])
    expect(observation.artifactRefs[0]?.producedByCallId).toBe('call_1')
    expect(ToolObservationSchema.safeParse({
      ...observation,
      resourceKeys: ['']
    }).success).toBe(false)
  })

  it('accepts context capacity exhaustion as a structured run outcome', () => {
    const outcome = RunOutcomeSchema.parse({
      status: 'degraded',
      reason: 'context_capacity_exceeded',
      retryable: false
    })

    expect(outcome.reason).toBe('context_capacity_exceeded')
  })
})

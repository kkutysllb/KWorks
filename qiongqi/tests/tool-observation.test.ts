import { describe, expect, it } from 'vitest'
import { canonicalToolDigest, normalizeToolHostResult, observeTool } from '@qiongqi/loop'
import type { ToolCallLike, ToolHostContext, ToolHostResult } from '@qiongqi/ports'

const context = {
  threadId: 'thread-1',
  turnId: 'turn-1',
  workspace: '/workspace/project',
  approvalPolicy: 'trusted',
  abortSignal: new AbortController().signal,
  awaitApproval: async () => 'allow' as const
} as ToolHostContext

function call(overrides: Partial<ToolCallLike> = {}): ToolCallLike {
  return {
    callId: 'call-1',
    toolName: 'read',
    providerId: 'builtin',
    toolKind: 'tool_call',
    arguments: { path: 'src/main.ts', options: { limit: 20, offset: 1 } },
    ...overrides
  }
}

function result(overrides: Partial<ToolHostResult> = {}): ToolHostResult {
  return {
    approved: true,
    item: {
      id: 'item-1',
      turnId: 'turn-1',
      threadId: 'thread-1',
      role: 'tool',
      status: 'completed',
      createdAt: '2026-07-17T00:00:00.000Z',
      finishedAt: '2026-07-17T00:00:01.000Z',
      kind: 'tool_result',
      toolName: 'read',
      callId: 'call-1',
      toolKind: 'tool_call',
      output: { content: 'hello', path: '/workspace/project/src/main.ts' },
      isError: false
    },
    semantic: {
      capabilityClass: 'file.read',
      resourceKeys: ['src/../src/main.ts', './src/main.ts', 'src/other.ts']
    },
    ...overrides
  }
}

describe('tool observations', () => {
  it('canonicalizes object keys recursively when digesting a call', () => {
    const left = call({ arguments: { b: 2, a: { y: true, x: 'value' } } })
    const right = call({ arguments: { a: { x: 'value', y: true }, b: 2 } })
    expect(canonicalToolDigest(left)).toBe(canonicalToolDigest(right))
  })

  it('changes the canonical digest when arguments change', () => {
    expect(canonicalToolDigest(call({ arguments: { path: 'a.ts' } })))
      .not.toBe(canonicalToolDigest(call({ arguments: { path: 'b.ts' } })))
  })

  it('excludes callId from the canonical digest', () => {
    expect(canonicalToolDigest(call({ callId: 'call-a' })))
      .toBe(canonicalToolDigest(call({ callId: 'call-b' })))
  })

  it('preserves array order in the canonical digest', () => {
    expect(canonicalToolDigest(call({ arguments: { paths: ['a', 'b'] } })))
      .not.toBe(canonicalToolDigest(call({ arguments: { paths: ['b', 'a'] } })))
  })

  it('normalizes, deduplicates, and sorts semantic resource keys', () => {
    const observation = observeTool({
      call: call(),
      result: result(),
      context,
      policy: { effect: 'read', replay: 'safe' },
      replayed: false
    })
    expect(observation.resourceKeys).toEqual([
      'src/main.ts',
      'src/other.ts'
    ])
  })

  it('uses stable external digests for workspace escapes and absolute outside paths', () => {
    const observation = observeTool({
      call: call(),
      result: result({
        semantic: {
          capabilityClass: 'file.read',
          resourceKeys: ['../secret.txt', '/etc/passwd', 'src/main.ts'],
          artifactRefs: [
            { path: '../secret.txt', kind: 'file' },
            { path: 'dist/report.json', kind: 'file' }
          ]
        }
      }),
      context,
      policy: { effect: 'read', replay: 'safe' },
      replayed: false
    })
    expect(observation.resourceKeys).toContain('src/main.ts')
    expect(observation.resourceKeys.filter((key) => key.startsWith('external:sha256:'))).toHaveLength(2)
    expect(observation.resourceKeys.join(' ')).not.toContain('secret')
    expect(observation.resourceKeys.join(' ')).not.toContain('/etc')
    expect(observation.artifactRefs).toEqual([{ path: 'dist/report.json', kind: 'file' }])
  })

  it('normalizes Windows drive and UNC paths before URI detection', () => {
    const observation = observeTool({
      call: call(),
      result: result({
        semantic: {
          capabilityClass: 'file.read',
          resourceKeys: [
            'C:\\repo\\src\\main.ts',
            'C:/repo/src/other.ts',
            'C:relative\\secret.txt',
            '\\\\server\\share\\secret.txt'
          ]
        }
      }),
      context: { workspace: 'C:\\repo' },
      policy: { effect: 'read', replay: 'safe' },
      replayed: false
    })
    expect(observation.resourceKeys).toContain('src/main.ts')
    expect(observation.resourceKeys).toContain('src/other.ts')
    expect(observation.resourceKeys.filter((key) => key.startsWith('external:sha256:'))).toHaveLength(2)
    expect(observation.resourceKeys.join(' ')).not.toContain('server')
    expect(observation.resourceKeys.join(' ')).not.toContain('relative')
  })

  it('keeps result digests stable across volatile turn item fields', () => {
    const first = observeTool({
      call: call(),
      result: result(),
      context,
      policy: { effect: 'read', replay: 'safe' },
      replayed: false
    })
    const secondResult = result({
      item: {
        ...result().item,
        id: 'item-2',
        callId: 'call-2',
        turnId: 'turn-2',
        threadId: 'thread-2',
        createdAt: '2028-01-01T00:00:00.000Z',
        finishedAt: '2028-01-01T00:00:02.000Z'
      }
    })
    const second = observeTool({
      call: call({ callId: 'call-2' }),
      result: secondResult,
      context,
      policy: { effect: 'read', replay: 'safe' },
      replayed: true
    })
    expect(second.resultDigest).toBe(first.resultDigest)
  })

  it('drops semantic artifact references when the result failed', () => {
    const failedResult = result({
      item: { ...result().item, status: 'failed', isError: true },
      semantic: {
        capabilityClass: 'file.write',
        resourceKeys: ['dist/report.json'],
        artifactRefs: [{ path: 'dist/report.json', kind: 'file', producedByCallId: 'call-1' }]
      }
    })
    const observation = observeTool({
      call: call({ toolName: 'write', toolKind: 'file_change' }),
      result: failedResult,
      context,
      policy: { effect: 'idempotent-write', replay: 'verify-first' },
      replayed: false
    })
    expect(observation.artifactRefs).toEqual([])
    expect(observation.failed).toBe(true)
  })

  it('normalizes special result values into a deterministic JSON-safe representation', () => {
    const normalized = normalizeToolHostResult(result({
      item: {
        ...result().item,
        output: {
          date: new Date('2026-07-17T00:00:00.000Z'),
          missing: undefined,
          nan: Number.NaN,
          infinity: Number.POSITIVE_INFINITY,
          negativeZero: -0,
          bigint: 42n,
          sparse: [, undefined]
        }
      }
    }), call(), context)
    expect(normalized.item).toMatchObject({
      kind: 'tool_result',
      output: {
        date: { __qiongqiType: 'date', value: '2026-07-17T00:00:00.000Z' },
        missing: { __qiongqiType: 'undefined' },
        nan: { __qiongqiType: 'nonfinite', value: 'NaN' },
        infinity: { __qiongqiType: 'nonfinite', value: 'Infinity' },
        negativeZero: 0,
        bigint: { __qiongqiType: 'bigint', value: '42' },
        sparse: [{ __qiongqiType: 'undefined' }, { __qiongqiType: 'undefined' }]
      }
    })
  })

  it('converts cyclic tool output into a deterministic failed result', () => {
    const output: Record<string, unknown> = { ok: true }
    output.self = output
    const normalized = normalizeToolHostResult(result({
      item: { ...result().item, output }
    }), call(), context)
    expect(normalized.item).toMatchObject({
      kind: 'tool_result',
      status: 'failed',
      isError: true,
      output: {
        code: 'tool_result_normalization_failed',
        reason: 'circular_reference'
      }
    })
  })

  it('rejects non-JSON argument values consistently', () => {
    expect(() => canonicalToolDigest(call({ arguments: { value: undefined } }))).toThrow(/JSON/i)
    expect(() => canonicalToolDigest(call({ arguments: { value: Number.NaN } }))).toThrow(/JSON/i)
    expect(() => canonicalToolDigest(call({ arguments: { value: 1n } }))).toThrow(/JSON/i)
    expect(() => canonicalToolDigest(call({ arguments: { value: new Date() } }))).toThrow(/JSON/i)
    const sparse: unknown[] = []
    sparse.length = 1
    expect(() => canonicalToolDigest(call({ arguments: { value: sparse } }))).toThrow(/sparse/i)
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(() => canonicalToolDigest(call({ arguments: cyclic }))).toThrow(/acyclic/i)
  })
})

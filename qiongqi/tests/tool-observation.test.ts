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

  it('parses uppercase file URLs before applying external confinement', () => {
    const observation = observeTool({
      call: call(),
      result: result({
        semantic: {
          capabilityClass: 'file.read',
          resourceKeys: ['FILE:///etc/passwd']
        }
      }),
      context,
      policy: { effect: 'read', replay: 'safe' },
      replayed: false
    })
    expect(observation.resourceKeys).toHaveLength(1)
    expect(observation.resourceKeys[0]).toMatch(/^external:sha256:/)
    expect(observation.resourceKeys[0]?.slice('external:sha256:'.length)).toHaveLength(64)
    expect(observation.resourceKeys.join(' ')).not.toContain('/etc')
  })

  it('uses Windows workspace semantics for Windows drive file URLs', () => {
    const observation = observeTool({
      call: call(),
      result: result({
        semantic: {
          capabilityClass: 'file.read',
          resourceKeys: ['file:///C:/repo/src/a.ts']
        }
      }),
      context: { workspace: 'C:\\repo' },
      policy: { effect: 'read', replay: 'safe' },
      replayed: false
    })
    expect(observation.resourceKeys).toEqual(['src/a.ts'])
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

  it('preserves strict JSON output exactly while normalizing negative zero', () => {
    const normalized = normalizeToolHostResult(result({
      item: {
        ...result().item,
        output: {
          negativeZero: -0,
          sentinelShaped: { __qiongqiType: 'date', value: 'legitimate' },
          nested: [null, true, 'value', 42, { ok: false }]
        }
      }
    }), call(), context)
    expect(normalized.item.kind).toBe('tool_result')
    if (normalized.item.kind !== 'tool_result') throw new Error('expected tool result')
    expect(normalized.item.output).toEqual({
      negativeZero: 0,
      sentinelShaped: { __qiongqiType: 'date', value: 'legitimate' },
      nested: [null, true, 'value', 42, { ok: false }]
    })
    expect(Object.is((normalized.item.output as { negativeZero: number }).negativeZero, -0)).toBe(false)
  })

  it('converts non-strict JSON output into a deterministic failed result without semantic metadata', () => {
    const sparse: unknown[] = []
    sparse.length = 1
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    const accessor = Object.defineProperty({}, 'value', {
      enumerable: true,
      get() { throw new Error('unreadable') }
    })
    const custom = Object.create({ inherited: true }) as Record<string, unknown>
    custom.value = 'custom'
    const cases: Array<[unknown, string]> = [
      [undefined, 'undefined'],
      [Number.NaN, 'number:NaN'],
      [Number.POSITIVE_INFINITY, 'number:Infinity'],
      [Number.MAX_SAFE_INTEGER + 1, 'number:unsafe-integer'],
      [42n, 'bigint'],
      [new Date('2026-07-17T00:00:00.000Z'), 'Date'],
      [Buffer.from('bytes'), 'Buffer'],
      [new Uint8Array([1, 2]), 'Uint8Array'],
      [new Map([['key', 'value']]), 'Map'],
      [new Set(['value']), 'Set'],
      [/value/, 'RegExp'],
      [custom, 'custom-prototype'],
      [accessor, 'property-access-failed'],
      [sparse, 'sparse-array'],
      [cyclic, 'circular-reference']
    ]

    for (const [output, type] of cases) {
      const normalized = normalizeToolHostResult(result({
        item: { ...result().item, output }
      }), call(), context)
      expect(normalized.item).toMatchObject({
        kind: 'tool_result',
        status: 'failed',
        isError: true,
        output: {
          code: 'tool_result_not_strict_json',
          error: 'tool result was not strict JSON',
          type
        }
      })
      expect(normalized.semantic).toBeUndefined()
    }
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
        code: 'tool_result_not_strict_json',
        error: 'tool result was not strict JSON',
        type: 'circular-reference'
      }
    })
    expect(normalized.semantic).toBeUndefined()
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

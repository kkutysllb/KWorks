import { createHash } from 'node:crypto'
import { isAbsolute, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ToolObservationSchema,
  type ToolEffectPolicy,
  type ToolObservation
} from '@qiongqi/contracts'
import type { ToolCallLike, ToolHostContext, ToolHostResult } from '@qiongqi/ports'

export type ObserveToolInput = {
  call: ToolCallLike
  result: ToolHostResult
  context: Pick<ToolHostContext, 'workspace'>
  policy: ToolEffectPolicy
  replayed: boolean
}

export function canonicalToolDigest(call: ToolCallLike): string {
  return digest({
    toolName: call.toolName,
    providerId: call.providerId ?? null,
    toolKind: call.toolKind ?? null,
    arguments: canonicalJsonValue(call.arguments)
  })
}

export function observeTool(input: ObserveToolInput): ToolObservation {
  const item = input.result.item
  const failed = item.kind === 'tool_result'
    ? item.isError || item.status === 'failed' || item.status === 'aborted'
    : item.status === 'failed' || item.status === 'aborted'
  const resultContent = item.kind === 'tool_result'
    ? {
        kind: item.kind,
        toolName: item.toolName,
        toolKind: item.toolKind,
        output: canonicalSerializableValue(item.output),
        isError: item.isError,
        status: item.status
      }
    : {
        kind: item.kind,
        status: item.status
      }
  return ToolObservationSchema.parse({
    callId: input.call.callId,
    toolName: input.call.toolName,
    effect: input.policy.effect,
    capabilityClass: input.result.semantic?.capabilityClass
      ?? input.call.toolName,
    resourceKeys: normalizeResourceKeys(
      input.result.semantic?.resourceKeys ?? [],
      input.context.workspace
    ),
    canonicalArgumentsDigest: canonicalToolDigest(input.call),
    resultDigest: digest(resultContent),
    resultItemId: item.id,
    artifactRefs: input.result.semantic?.artifactRefs ?? [],
    failed,
    replayed: input.replayed
  })
}

export function normalizeResourceKeys(
  resourceKeys: readonly string[],
  workspace: string
): string[] {
  const normalized = resourceKeys
    .map((key) => normalizeResourceKey(key, workspace))
    .filter((key): key is string => key !== null)
  return [...new Set(normalized)].sort()
}

function normalizeResourceKey(resourceKey: string, workspace: string): string | null {
  const trimmed = resourceKey.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('file:')) {
    try {
      return normalize(fileURLToPath(trimmed))
    } catch {
      return trimmed
    }
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed)) return trimmed
  return normalize(isAbsolute(trimmed) ? trimmed : resolve(workspace, trimmed))
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function canonicalJsonValue(value: unknown, seen = new Set<object>()): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('tool arguments must contain JSON values')
    return value
  }
  if (typeof value !== 'object') throw new TypeError('tool arguments must contain JSON values')
  if (seen.has(value)) throw new TypeError('tool arguments must contain acyclic JSON values')
  seen.add(value)
  try {
    if (Array.isArray(value)) return value.map((entry) => canonicalJsonValue(entry, seen))
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('tool arguments must contain JSON objects')
    }
    const record = value as Record<string, unknown>
    return Object.fromEntries(
      Object.keys(record).sort().map((key) => [key, canonicalJsonValue(record[key], seen)])
    )
  } finally {
    seen.delete(value)
  }
}

function canonicalSerializableValue(value: unknown): unknown {
  let serialized: string | undefined
  try {
    serialized = JSON.stringify(value)
  } catch {
    throw new TypeError('tool result must be JSON serializable')
  }
  if (serialized === undefined) return null
  return canonicalJsonValue(JSON.parse(serialized) as unknown)
}

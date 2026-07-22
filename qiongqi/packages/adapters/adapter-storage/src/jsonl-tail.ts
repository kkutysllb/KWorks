import { open } from 'node:fs/promises'

const DEFAULT_TAIL_CHUNK_BYTES = 64 * 1024
const DEFAULT_TAIL_SCAN_MAX_BYTES = 32 * 1024 * 1024

type JsonParser<T> = (value: unknown) => T

export async function readLastJsonlRecord<T>(
  path: string,
  parse: JsonParser<T>,
  options: { maxBytes?: number } = {}
): Promise<T | null> {
  const lines = await readTailLines(path, 32, options.maxBytes ?? DEFAULT_TAIL_SCAN_MAX_BYTES)
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const parsed = parseJsonLine(lines[index]!, parse)
    if (parsed.ok) return parsed.value
  }
  return null
}

export async function readRecentJsonlRecords<T>(
  path: string,
  limit: number,
  parse: JsonParser<T>,
  options: { maxBytes?: number } = {}
): Promise<T[]> {
  const boundedLimit = Math.max(0, Math.floor(limit))
  if (boundedLimit <= 0) return []
  const linesToRead = Math.max(boundedLimit * 4, boundedLimit + 16)
  const lines = await readTailLines(path, linesToRead, options.maxBytes ?? DEFAULT_TAIL_SCAN_MAX_BYTES)
  const out: T[] = []
  for (let index = lines.length - 1; index >= 0 && out.length < boundedLimit; index -= 1) {
    const parsed = parseJsonLine(lines[index]!, parse)
    if (parsed.ok) out.push(parsed.value)
  }
  return out.reverse()
}

async function readTailLines(path: string, minLines: number, maxBytes: number): Promise<string[]> {
  let handle: Awaited<ReturnType<typeof open>> | undefined
  try {
    handle = await open(path, 'r')
    const info = await handle.stat()
    if (!info.isFile() || info.size <= 0) return []

    let position = info.size
    let totalBytes = 0
    const chunks: Buffer[] = []
    while (position > 0 && totalBytes < maxBytes) {
      const readSize = Math.min(DEFAULT_TAIL_CHUNK_BYTES, position, maxBytes - totalBytes)
      if (readSize <= 0) break
      position -= readSize
      const buffer = Buffer.allocUnsafe(readSize)
      const { bytesRead } = await handle.read(buffer, 0, readSize, position)
      if (bytesRead <= 0) break
      chunks.unshift(buffer.subarray(0, bytesRead))
      totalBytes += bytesRead

      const lines = completeLines(Buffer.concat(chunks).toString('utf8'), position === 0)
      if (lines.length >= minLines || position === 0) {
        return lines.slice(-minLines)
      }
    }

    return completeLines(Buffer.concat(chunks).toString('utf8'), position === 0).slice(-minLines)
  } catch {
    return []
  } finally {
    await handle?.close().catch(() => undefined)
  }
}

function completeLines(content: string, reachedStart: boolean): string[] {
  const lines = content.split('\n').filter((line) => line.trim().length > 0)
  if (reachedStart || content.startsWith('\n') || lines.length === 0) return lines
  return lines.slice(1)
}

function parseJsonLine<T>(line: string, parse: JsonParser<T>): { ok: true; value: T } | { ok: false } {
  try {
    return { ok: true, value: parse(JSON.parse(line)) }
  } catch {
    return { ok: false }
  }
}

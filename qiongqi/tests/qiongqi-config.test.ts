import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir, homedir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { expandHomePath, QiongqiConfigSchema } from '@qiongqi/contracts'
import { FileQiongqiConfigStore } from '@qiongqi/http'

describe('expandHomePath', () => {
  it('expands Windows-style home-relative paths', () => {
    expect(expandHomePath('~\\kun\\config.json')).toBe(join(homedir(), 'kun', 'config.json'))
  })

  it('leaves non-home tilde prefixes untouched', () => {
    expect(expandHomePath('~other/config.json')).toBe('~other/config.json')
  })

  it('persists normalized built-in attachments when reading legacy disabled config', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'qiongqi-config-'))
    try {
      const configPath = join(dir, 'qiongqi-config.json')
      await writeFile(configPath, JSON.stringify({
        capabilities: {
          attachments: {
            enabled: false,
            allowedMimeTypes: ['image/png']
          }
        }
      }), 'utf8')

      const store = new FileQiongqiConfigStore({
        path: configPath,
        initial: QiongqiConfigSchema.parse({})
      })

      const loaded = await store.read()
      expect(loaded.capabilities.attachments.enabled).toBe(true)
      expect(loaded.capabilities.attachments.allowedMimeTypes).toContain('application/zip')
      expect(loaded.capabilities.attachments.allowedMimeTypes).toContain('application/pdf')

      const persisted = JSON.parse(await readFile(configPath, 'utf8')) as {
        capabilities?: { attachments?: { enabled?: boolean; allowedMimeTypes?: string[] } }
      }
      expect(persisted.capabilities?.attachments?.enabled).toBe(true)
      expect(persisted.capabilities?.attachments?.allowedMimeTypes).toContain('application/zip')
      expect(persisted.capabilities?.attachments?.allowedMimeTypes).toContain('application/pdf')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

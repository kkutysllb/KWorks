import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SqliteKWorksUserDataStore } from '@qiongqi/http'

describe('SqliteKWorksUserDataStore', () => {
  let dir = ''
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'kworks-user-data-'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('persists auth, model profiles, secrets, and active model by user id', async () => {
    const store = new SqliteKWorksUserDataStore({ workspaceRoot: dir })
    await store.ready()
    await store.saveAuth({
      users: [{
        id: 'user-a',
        email: 'a@example.com',
        passwordHash: 'hash-a',
        role: 'admin',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }, {
        id: 'user-b',
        email: 'b@example.com',
        passwordHash: 'hash-b',
        role: 'user',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }],
      sessions: [{
        id: 'session-a',
        tokenHash: 'token-hash-a',
        userId: 'user-a',
        createdAt: '2026-01-01T00:00:00.000Z',
        expiresAt: '2026-01-08T00:00:00.000Z'
      }]
    })
    await store.saveModelProfile('user-a', 'shared', {
      providerModel: 'provider-a',
      baseUrl: 'https://a.example/v1',
      apiKey: 'key-a',
      endpointFormat: 'chat_completions'
    }, { apiKey: 'key-a' })
    await store.saveModelProfile('user-b', 'shared', {
      providerModel: 'provider-b',
      baseUrl: 'https://b.example/v1',
      apiKey: 'key-b',
      endpointFormat: 'chat_completions'
    }, { apiKey: 'key-b' })
    await store.activateModelProfile('user-a', 'shared')

    const auth = await store.loadAuth()
    expect(auth.users).toContainEqual(expect.objectContaining({ id: 'user-a', email: 'a@example.com' }))
    expect(auth.users).toContainEqual(expect.objectContaining({ id: 'user-b', email: 'b@example.com' }))
    expect(auth.sessions).toContainEqual(expect.objectContaining({ id: 'session-a', userId: 'user-a' }))
    await expect(store.listModelProfiles('user-a')).resolves.toMatchObject({
      activeModel: 'shared',
      profiles: {
        shared: {
          providerModel: 'provider-a',
          apiKey: 'key-a'
        }
      }
    })
    await expect(store.listModelProfiles('user-b')).resolves.toMatchObject({
      profiles: {
        shared: {
          providerModel: 'provider-b',
          apiKey: 'key-b'
        }
      }
    })
    expect(await store.resolveModelSecret('user-a', 'shared')).toEqual({ apiKey: 'key-a' })
    store.close()

    const rawDb = await readFile(join(dir, 'system', 'data', 'kworks.sqlite'))
    expect(rawDb.includes(Buffer.from('key-a'))).toBe(true)
    expect(rawDb.includes(Buffer.from('"apiKey"'))).toBe(false)
  })

  it('creates the per-user workspace skeleton when auth users are saved', async () => {
    const store = new SqliteKWorksUserDataStore({ workspaceRoot: dir })
    await store.ready()
    await store.saveAuth({
      users: [{
        id: 'user:with/slash',
        email: 'workspace@example.com',
        passwordHash: 'hash',
        role: 'user',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }],
      sessions: []
    })

    const userRoot = join(dir, 'users', 'user_with_slash')
    for (const name of [
      'data',
      'thread',
      'threads',
      'workspace',
      'memory',
      'secrets',
      'usage',
      'skills',
      'mcp',
      'tools',
      'automations',
      'artifacts',
      'attachments',
      'logs'
    ]) {
      await expect(access(join(userRoot, name))).resolves.toBeUndefined()
    }
    store.close()
  })

  it('persists user settings by user id in SQLite', async () => {
    const store = new SqliteKWorksUserDataStore({ workspaceRoot: dir })
    await store.ready()
    await store.saveAuth({
      users: [{
        id: 'user-a',
        email: 'settings-a@example.com',
        passwordHash: 'hash-a',
        role: 'user',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }, {
        id: 'user-b',
        email: 'settings-b@example.com',
        passwordHash: 'hash-b',
        role: 'user',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }],
      sessions: []
    })
    await store.setUserSetting('user-a', 'automations.crons', {
      nightly: { enabled: true, cron: '0 9 * * *', prompt: 'Report' }
    })

    await expect(store.getUserSetting('user-a', 'automations.crons')).resolves.toEqual({
      nightly: { enabled: true, cron: '0 9 * * *', prompt: 'Report' }
    })
    await expect(store.getUserSetting('user-b', 'automations.crons')).resolves.toBeUndefined()
    store.close()

    const rawDb = await readFile(join(dir, 'system', 'data', 'kworks.sqlite'))
    expect(rawDb.includes(Buffer.from('automations.crons'))).toBe(true)
  })

  it('persists usage events by user id outside thread storage', async () => {
    const store = new SqliteKWorksUserDataStore({ workspaceRoot: dir })
    await store.ready()
    await store.saveAuth({
      users: [{
        id: 'user-a',
        email: 'usage-a@example.com',
        passwordHash: 'hash-a',
        role: 'user',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }, {
        id: 'user-b',
        email: 'usage-b@example.com',
        passwordHash: 'hash-b',
        role: 'user',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }],
      sessions: []
    })
    await store.appendUsageEvent({
      userId: 'user-a',
      threadId: 'thread-a',
      seq: 1,
      turnId: 'turn-a',
      model: 'deepseek-chat',
      timestamp: '2026-06-02T09:00:00.000Z',
      usage: {
        promptTokens: 120,
        completionTokens: 30,
        totalTokens: 150,
        cachedTokens: 80,
        cacheHitTokens: 80,
        cacheMissTokens: 40,
        cacheHitRate: 80 / 120,
        turns: 2,
        tokenEconomySavingsTokens: 45
      }
    })
    await store.appendUsageEvent({
      userId: 'user-b',
      threadId: 'thread-b',
      seq: 1,
      model: 'deepseek-chat',
      timestamp: '2026-06-02T10:00:00.000Z',
      usage: {
        promptTokens: 1,
        completionTokens: 1,
        totalTokens: 2,
        cachedTokens: 0,
        cacheHitTokens: 0,
        cacheMissTokens: 1,
        cacheHitRate: 0,
        turns: 1
      }
    })
    await store.saveAuth({
      users: [{
        id: 'user-a',
        email: 'usage-a@example.com',
        passwordHash: 'hash-a',
        role: 'user',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }, {
        id: 'user-b',
        email: 'usage-b@example.com',
        passwordHash: 'hash-b',
        role: 'user',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }],
      sessions: [{
        id: 'usage-session-a',
        tokenHash: 'usage-token-a',
        userId: 'user-a',
        createdAt: '2026-06-02T11:00:00.000Z',
        expiresAt: '2026-06-09T11:00:00.000Z'
      }]
    })
    store.close()

    const reopened = new SqliteKWorksUserDataStore({ workspaceRoot: dir })
    await reopened.ready()
    await expect(reopened.listUsageEvents('user-a')).resolves.toEqual([
      expect.objectContaining({
        userId: 'user-a',
        threadId: 'thread-a',
        seq: 1,
        usage: expect.objectContaining({
          totalTokens: 150,
          cacheHitTokens: 80,
          tokenEconomySavingsTokens: 45
        })
      })
    ])
    await expect(reopened.listUsageEvents('user-b')).resolves.toHaveLength(1)
    reopened.close()
  })
})

import { access, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createAgent, dispatchRequest } from '@qiongqi/http'
import { buildHarness, readJson } from './http-server-test-harness.js'

async function jsonRequest(path: string, init: RequestInit = {}) {
  const h = buildHarness()
  const response = await dispatchRequest(h.router, new Request(`http://localhost${path}`, init))
  return { h, response, body: await readJson(response) }
}

async function buildPersistentHarness() {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'kworks-auth-sqlite-'))
  const dataDir = join(workspaceRoot, 'users', 'runtime')
  const runtime = await createAgent({
    host: '127.0.0.1',
    port: 0,
    dataDir,
    runtimeToken: 'tok-1',
    apiKey: '',
    baseUrl: 'https://api.example.test/v1',
    endpointFormat: 'chat_completions',
    model: 'deepseek-chat',
    approvalPolicy: 'on-request',
    sandboxMode: 'workspace-write',
    tokenEconomyMode: false,
    insecure: false,
    storage: { backend: 'file' },
    capabilities: {
      mcp: { enabled: false, servers: {} },
      web: { enabled: false, fetchEnabled: false, searchEnabled: false },
      skills: { enabled: false, roots: [] },
      subagents: { enabled: false, maxParallel: 0, maxChildRuns: 0 },
      attachments: { enabled: false },
      memory: { enabled: false }
    }
  })
  return {
    workspaceRoot,
    dataDir,
    runtime,
    router: (await import('@qiongqi/http')).buildRouter(runtime),
    close: async () => {
      await runtime.shutdown?.()
      await rm(workspaceRoot, { recursive: true, force: true })
    }
  }
}

describe('KWorks auth compatibility', () => {
  it('starts uninitialized and initializes the first admin account', async () => {
    const h = buildHarness()

    const setupBefore = await dispatchRequest(h.router, new Request('http://localhost/api/v1/auth/setup-status'))
    expect(setupBefore.status).toBe(200)
    await expect(readJson(setupBefore)).resolves.toMatchObject({
      initialized: false,
      has_admin: false,
      needs_setup: true,
      local_auth_enabled: true
    })

    const initialize = await dispatchRequest(
      h.router,
      new Request('http://localhost/api/v1/auth/initialize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@example.com',
          password: 'correct horse battery staple'
        })
      })
    )

    expect(initialize.status).toBe(200)
    const body = await readJson(initialize) as {
      access_token?: string
      user?: { id?: string; email?: string; system_role?: string; is_admin?: boolean }
    }
    expect(body.access_token).toEqual(expect.any(String))
    expect(body.access_token).not.toBe('desktop-local-token')
    expect(body.user).toMatchObject({
      email: 'admin@example.com',
      system_role: 'admin',
      is_admin: true
    })

    const setupAfter = await dispatchRequest(h.router, new Request('http://localhost/api/v1/auth/setup-status'))
    await expect(readJson(setupAfter)).resolves.toMatchObject({
      initialized: true,
      has_admin: true,
      needs_setup: false
    })
  })

  it('requires a valid session for /auth/me and invalidates sessions on logout', async () => {
    const h = buildHarness()
    const initialize = await dispatchRequest(
      h.router,
      new Request('http://localhost/api/v1/auth/initialize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'admin@example.com', password: 'long-password' })
      })
    )
    const initializeBody = await readJson(initialize) as { access_token: string }

    const anonymousMe = await dispatchRequest(h.router, new Request('http://localhost/api/v1/auth/me'))
    expect(anonymousMe.status).toBe(401)

    const authenticatedMe = await dispatchRequest(
      h.router,
      new Request('http://localhost/api/v1/auth/me', {
        headers: { authorization: `Bearer ${initializeBody.access_token}` }
      })
    )
    expect(authenticatedMe.status).toBe(200)
    await expect(readJson(authenticatedMe)).resolves.toMatchObject({
      email: 'admin@example.com',
      system_role: 'admin'
    })

    const logout = await dispatchRequest(
      h.router,
      new Request('http://localhost/api/v1/auth/logout', {
        method: 'POST',
        headers: { authorization: `Bearer ${initializeBody.access_token}` }
      })
    )
    expect(logout.status).toBe(200)

    const afterLogout = await dispatchRequest(
      h.router,
      new Request('http://localhost/api/v1/auth/me', {
        headers: { authorization: `Bearer ${initializeBody.access_token}` }
      })
    )
    expect(afterLogout.status).toBe(401)
  })

  it('rejects invalid login credentials and returns a fresh session for valid credentials', async () => {
    const h = buildHarness()
    await dispatchRequest(
      h.router,
      new Request('http://localhost/api/v1/auth/initialize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'admin@example.com', password: 'long-password' })
      })
    )

    const invalid = await dispatchRequest(
      h.router,
      new Request('http://localhost/api/v1/auth/login/local', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'admin@example.com', password: 'wrong-password' })
      })
    )
    expect(invalid.status).toBe(401)

    const valid = await dispatchRequest(
      h.router,
      new Request('http://localhost/api/v1/auth/login/local', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'admin@example.com', password: 'long-password' })
      })
    )
    expect(valid.status).toBe(200)
    const body = await readJson(valid) as { access_token?: string; user?: { email?: string } }
    expect(body.access_token).toEqual(expect.any(String))
    expect(body.user?.email).toBe('admin@example.com')
  })

  it('accepts legacy OAuth2 form login bodies', async () => {
    const h = buildHarness()
    await dispatchRequest(
      h.router,
      new Request('http://localhost/api/v1/auth/initialize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'admin@example.com', password: 'long-password' })
      })
    )

    const valid = await dispatchRequest(
      h.router,
      new Request('http://localhost/api/v1/auth/login/local', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          username: 'admin@example.com',
          password: 'long-password'
        }).toString()
      })
    )

    expect(valid.status).toBe(200)
    const body = await readJson(valid) as { access_token?: string; user?: { email?: string } }
    expect(body.access_token).toEqual(expect.any(String))
    expect(body.user?.email).toBe('admin@example.com')
  })

  it('uses the production SQLite user data store for auth persistence', async () => {
    const h = await buildPersistentHarness()
    try {
      const initialize = await dispatchRequest(
        h.router,
        new Request('http://localhost/api/v1/auth/initialize', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: 'sqlite@example.com', password: 'long-password' })
        })
      )

      expect(initialize.status).toBe(200)
      await expect(access(join(h.workspaceRoot, 'system', 'data', 'kworks.sqlite'))).resolves.toBeUndefined()
      await expect(access(join(h.dataDir, 'auth', 'auth.json'))).rejects.toMatchObject({ code: 'ENOENT' })
      const auth = await h.runtime.kworksUserDataStore?.loadAuth()
      expect(auth?.users).toContainEqual(expect.objectContaining({ email: 'sqlite@example.com' }))
    } finally {
      await h.close()
    }
  })

  it('requires authentication for KWorks compatibility thread search', async () => {
    const { response } = await jsonRequest('/api/threads/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({})
    })

    expect(response.status).toBe(401)
  })

  it('stores model profiles and secrets per authenticated user', async () => {
    const h = buildHarness()
    const adminResponse = await dispatchRequest(
      h.router,
      new Request('http://localhost/api/v1/auth/initialize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'admin@example.com', password: 'long-password' })
      })
    )
    const admin = await readJson(adminResponse) as { access_token: string }
    const userResponse = await dispatchRequest(
      h.router,
      new Request('http://localhost/api/v1/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', password: 'long-password' })
      })
    )
    const user = await readJson(userResponse) as { access_token: string }

    const createAdminModel = await dispatchRequest(
      h.router,
      new Request('http://localhost/api/models', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${admin.access_token}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          name: 'private-admin-model',
          model: 'deepseek-chat',
          base_url: 'https://admin.example/v1',
          api_key: 'admin-secret'
        })
      })
    )
    expect(createAdminModel.status).toBe(201)
    const createUserModel = await dispatchRequest(
      h.router,
      new Request('http://localhost/api/models', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${user.access_token}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          name: 'private-user-model',
          model: 'glm-5.2',
          base_url: 'https://user.example/v1',
          api_key: 'user-secret'
        })
      })
    )
    expect(createUserModel.status).toBe(201)

    const adminModels = await dispatchRequest(
      h.router,
      new Request('http://localhost/api/models', {
        headers: { authorization: `Bearer ${admin.access_token}` }
      })
    )
    const adminBody = await readJson(adminModels) as { models: Array<{ name: string; api_key?: string }> }
    expect(adminBody.models.map((model) => model.name)).toContain('private-admin-model')
    expect(adminBody.models.map((model) => model.name)).not.toContain('private-user-model')
    expect(adminBody.models.find((model) => model.name === 'private-admin-model')?.api_key).toBe('********')

    const userModels = await dispatchRequest(
      h.router,
      new Request('http://localhost/api/models', {
        headers: { authorization: `Bearer ${user.access_token}` }
      })
    )
    const userBody = await readJson(userModels) as { models: Array<{ name: string }> }
    expect(userBody.models.map((model) => model.name)).toContain('private-user-model')
    expect(userBody.models.map((model) => model.name)).not.toContain('private-admin-model')
  })
})

import { describe, expect, it } from 'vitest'
import { dispatchRequest } from '@qiongqi/http'
import { buildHarness, readJson } from './http-server-test-harness.js'
import { FileMemoryStore } from '@qiongqi/memory'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function createUser(h: ReturnType<typeof buildHarness>, email: string, first = false) {
  const path = first ? '/api/v1/auth/initialize' : '/api/v1/auth/register'
  const response = await dispatchRequest(
    h.router,
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'long-password' })
    })
  )
  return await readJson(response) as { access_token: string; user: { id: string } }
}

describe('memory owner isolation', () => {
  it('filters memory records by authenticated user', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'qiongqi-memory-owner-'))
    try {
      const h = buildHarness()
      h.runtime.memoryStore = new FileMemoryStore({
        rootDir: dir,
        config: { enabled: true, injectLimit: 5, updateOnTurnEnd: false },
        idGenerator: () => `mem_${Date.now()}`
      })
      const userA = await createUser(h, 'a@example.com', true)
      const userB = await createUser(h, 'b@example.com')

      const createA = await dispatchRequest(
        h.router,
        new Request('http://localhost/v1/memory', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${userA.access_token}`,
            'content-type': 'application/json'
          },
          body: JSON.stringify({ content: 'A private memory', scope: 'user' })
        })
      )
      expect(createA.status).toBe(201)
      const created = await readJson(createA) as { memory: { id: string; ownerUserId?: string } }
      expect(created.memory.ownerUserId).toBe(userA.user.id)

      const listB = await dispatchRequest(
        h.router,
        new Request('http://localhost/v1/memory', {
          headers: { authorization: `Bearer ${userB.access_token}` }
        })
      )
      expect(listB.status).toBe(200)
      await expect(readJson(listB)).resolves.toMatchObject({ memories: [] })

      const patchB = await dispatchRequest(
        h.router,
        new Request(`http://localhost/v1/memory/${created.memory.id}`, {
          method: 'PATCH',
          headers: {
            authorization: `Bearer ${userB.access_token}`,
            'content-type': 'application/json'
          },
          body: JSON.stringify({ content: 'stolen' })
        })
      )
      expect(patchB.status).toBe(404)

      const deleteB = await dispatchRequest(
        h.router,
        new Request(`http://localhost/v1/memory/${created.memory.id}`, {
          method: 'DELETE',
          headers: { authorization: `Bearer ${userB.access_token}` }
        })
      )
      expect(deleteB.status).toBe(404)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

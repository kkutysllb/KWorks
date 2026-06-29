import { describe, expect, it } from 'vitest'
import { dispatchRequest } from '@qiongqi/http'
import { buildHarness, readJson, usageSnapshot } from './http-server-test-harness.js'

async function createUser(h: ReturnType<typeof buildHarness>, email: string, first = false) {
  const response = await dispatchRequest(
    h.router,
    new Request(`http://localhost${first ? '/api/v1/auth/initialize' : '/api/v1/auth/register'}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'long-password' })
    })
  )
  return await readJson(response) as { access_token: string }
}

async function createThread(h: ReturnType<typeof buildHarness>, token: string, id: string) {
  const response = await dispatchRequest(
    h.router,
    new Request('http://localhost/v1/threads', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ id, workspace: '/tmp', model: 'deepseek-chat' })
    })
  )
  expect(response.status).toBe(201)
}

describe('usage owner isolation', () => {
  it('returns only the authenticated user thread usage', async () => {
    const h = buildHarness()
    const userA = await createUser(h, 'a@example.com', true)
    const userB = await createUser(h, 'b@example.com')
    await createThread(h, userA.access_token, 'thread_a')
    await createThread(h, userB.access_token, 'thread_b')
    h.runtime.usageService.seedThread('thread_a', usageSnapshot({ promptTokens: 100, completionTokens: 10, totalTokens: 110 }))
    h.runtime.usageService.seedThread('thread_b', usageSnapshot({ promptTokens: 7, completionTokens: 3, totalTokens: 10 }))

    const usageA = await dispatchRequest(
      h.router,
      new Request('http://localhost/v1/usage', {
        headers: { authorization: `Bearer ${userA.access_token}` }
      })
    )
    expect(usageA.status).toBe(200)
    const bodyA = await readJson(usageA) as {
      total: { totalTokens: number }
      perThread: Array<{ threadId: string }>
    }
    expect(bodyA.total.totalTokens).toBe(110)
    expect(bodyA.perThread.map((item) => item.threadId)).toEqual(['thread_a'])

    const usageB = await dispatchRequest(
      h.router,
      new Request('http://localhost/v1/usage', {
        headers: { authorization: `Bearer ${userB.access_token}` }
      })
    )
    const bodyB = await readJson(usageB) as {
      total: { totalTokens: number }
      perThread: Array<{ threadId: string }>
    }
    expect(bodyB.total.totalTokens).toBe(10)
    expect(bodyB.perThread.map((item) => item.threadId)).toEqual(['thread_b'])
  })
})

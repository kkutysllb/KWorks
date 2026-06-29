import { describe, expect, it } from 'vitest'
import { dispatchRequest } from '@qiongqi/http'
import { buildHarness, readJson } from './http-server-test-harness.js'

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

describe('observability owner isolation', () => {
  it('blocks cross-user KWorks state and run stream access', async () => {
    const h = buildHarness()
    const userA = await createUser(h, 'a@example.com', true)
    const userB = await createUser(h, 'b@example.com')

    const createA = await dispatchRequest(
      h.router,
      new Request('http://localhost/api/threads', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${userA.access_token}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ thread_id: 'private_thread', title: 'Private' })
      })
    )
    expect(createA.status).toBe(200)

    const stateB = await dispatchRequest(
      h.router,
      new Request('http://localhost/api/threads/private_thread/state', {
        headers: { authorization: `Bearer ${userB.access_token}` }
      })
    )
    expect(stateB.status).toBe(404)

    const streamB = await dispatchRequest(
      h.router,
      new Request('http://localhost/api/threads/private_thread/runs/stream', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${userB.access_token}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          input: { messages: [{ role: 'user', content: 'steal this' }] },
          context: { model_name: 'deepseek-chat', workspace: '/tmp' }
        })
      })
    )
    expect(streamB.status).toBe(404)
  })

  it('blocks cross-user v1 turn and event access', async () => {
    const h = buildHarness()
    const userA = await createUser(h, 'a@example.com', true)
    const userB = await createUser(h, 'b@example.com')
    const createA = await dispatchRequest(
      h.router,
      new Request('http://localhost/v1/threads', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${userA.access_token}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ id: 'v1_private_thread', workspace: '/tmp', model: 'deepseek-chat' })
      })
    )
    expect(createA.status).toBe(201)

    const startB = await dispatchRequest(
      h.router,
      new Request('http://localhost/v1/threads/v1_private_thread/turns', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${userB.access_token}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ prompt: 'hello', model: 'deepseek-chat' })
      })
    )
    expect(startB.status).toBe(404)

    const eventsB = await dispatchRequest(
      h.router,
      new Request('http://localhost/v1/threads/v1_private_thread/events', {
        headers: { authorization: `Bearer ${userB.access_token}` }
      })
    )
    expect(eventsB.status).toBe(404)
  })
})

import { describe, expect, it } from 'vitest'
import { dispatchRequest } from '@qiongqi/http'
import { buildHarness, readJson } from './http-server-test-harness.js'

async function initialize(h: ReturnType<typeof buildHarness>, email: string) {
  const response = await dispatchRequest(
    h.router,
    new Request('http://localhost/api/v1/auth/initialize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'long-password' })
    })
  )
  const body = await readJson(response) as { access_token: string; user: { id: string } }
  return body
}

async function register(h: ReturnType<typeof buildHarness>, email: string) {
  const response = await dispatchRequest(
    h.router,
    new Request('http://localhost/api/v1/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'long-password' })
    })
  )
  const body = await readJson(response) as { access_token: string; user: { id: string } }
  return body
}

describe('thread owner isolation', () => {
  it('assigns created v1 threads to the authenticated user and filters lists', async () => {
    const h = buildHarness()
    const userA = await initialize(h, 'a@example.com')
    const threadA = await dispatchRequest(
      h.router,
      new Request('http://localhost/v1/threads', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${userA.access_token}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ id: 'thread_a', workspace: '/tmp/a', model: 'deepseek-chat' })
      })
    )
    expect(threadA.status).toBe(201)

    const userB = await register(h, 'b@example.com')

    const listB = await dispatchRequest(
      h.router,
      new Request('http://localhost/v1/threads', {
        headers: { authorization: `Bearer ${userB.access_token}` }
      })
    )
    expect(listB.status).toBe(200)
    const listBody = await readJson(listB) as { threads: Array<{ id: string; ownerUserId?: string }> }
    expect(listBody.threads.map((thread) => thread.id)).not.toContain('thread_a')

    const getB = await dispatchRequest(
      h.router,
      new Request('http://localhost/v1/threads/thread_a', {
        headers: { authorization: `Bearer ${userB.access_token}` }
      })
    )
    expect(getB.status).toBe(404)
  })

  it('assigns KWorks compatibility threads to the authenticated user and filters search', async () => {
    const h = buildHarness()
    const userA = await initialize(h, 'a@example.com')
    const createA = await dispatchRequest(
      h.router,
      new Request('http://localhost/api/threads', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${userA.access_token}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ thread_id: 'kworks_thread_a', title: 'A private thread' })
      })
    )
    expect(createA.status).toBe(200)

    const secondUser = await register(h, 'b@example.com')

    const searchB = await dispatchRequest(
      h.router,
      new Request('http://localhost/api/threads/search', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${secondUser.access_token}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({})
      })
    )
    expect(searchB.status).toBe(200)
    const body = await readJson(searchB) as Array<{ thread_id?: string }>
    expect(body.map((thread) => thread.thread_id)).not.toContain('kworks_thread_a')

    const getB = await dispatchRequest(
      h.router,
      new Request('http://localhost/api/threads/kworks_thread_a', {
        headers: { authorization: `Bearer ${secondUser.access_token}` }
      })
    )
    expect(getB.status).toBe(404)
  })
})

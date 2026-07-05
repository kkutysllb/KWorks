import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildHarness, readJson } from './http-server-test-harness.js'
import { buildRouter, dispatchRequest } from '@qiongqi/http'

describe('HTTP artifacts routes', () => {
  let dir = ''

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'qiongqi-http-artifacts-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('lists and reads thread output artifacts by virtual path', async () => {
    const h = buildHarness()
    const baseInfo = h.runtime.info
    h.runtime.info = () => ({
      ...baseInfo(),
      dataDir: dir
    })
    h.router = buildRouter(h.runtime)
    const outputDir = join(dir, 'threads', 'thr_1', 'outputs')
    await mkdir(outputDir, { recursive: true })
    await writeFile(join(outputDir, 'log.txt'), 'hello artifact', 'utf8')

    const list = await dispatchRequest(
      h.router,
      new Request('http://localhost/v1/threads/thr_1/artifacts', {
        headers: { authorization: 'Bearer tok-1' }
      })
    )
    expect(list.status).toBe(200)
    expect(await readJson(list)).toMatchObject({
      artifacts: [
        {
          name: 'log.txt',
          virtualPath: '/mnt/qiongqi/outputs/log.txt'
        }
      ]
    })

    const read = await dispatchRequest(
      h.router,
      new Request('http://localhost/v1/threads/thr_1/artifacts/content?path=/mnt/qiongqi/outputs/log.txt', {
        headers: { authorization: 'Bearer tok-1' }
      })
    )
    expect(read.status).toBe(200)
    expect(await read.text()).toBe('hello artifact')
  })

  it('rejects artifact path traversal', async () => {
    const h = buildHarness()
    const baseInfo = h.runtime.info
    h.runtime.info = () => ({
      ...baseInfo(),
      dataDir: dir
    })
    h.router = buildRouter(h.runtime)

    const response = await dispatchRequest(
      h.router,
      new Request('http://localhost/v1/threads/thr_1/artifacts/content?path=/mnt/qiongqi/outputs/%2e%2e/secret.txt', {
        headers: { authorization: 'Bearer tok-1' }
      })
    )

    expect(response.status).toBe(403)
  })

  it('reads legacy KWorks path-style artifact URLs', async () => {
    const h = buildHarness()
    const baseInfo = h.runtime.info
    h.runtime.info = () => ({
      ...baseInfo(),
      dataDir: dir
    })
    h.router = buildRouter(h.runtime)
    const outputDir = join(dir, 'threads', 'thr_legacy', 'outputs', 'stock-scout.skill')
    await mkdir(outputDir, { recursive: true })
    await writeFile(join(outputDir, 'SKILL.md'), '# Stock Scout', 'utf8')

    const response = await dispatchRequest(
      h.router,
      new Request('http://localhost/api/threads/thr_legacy/artifacts/outputs/stock-scout.skill/SKILL.md', {
        headers: { authorization: 'Bearer tok-1' }
      })
    )

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('# Stock Scout')
  })

  it('reads and downloads files under the thread workspace by absolute path', async () => {
    const h = buildHarness()
    const workspaceDir = join(dir, 'workspace-project')
    const reportPath = join(workspaceDir, 'reports', 'summary.md')
    await mkdir(join(workspaceDir, 'reports'), { recursive: true })
    await writeFile(reportPath, '# Workspace Report', 'utf8')
    await h.threadService.create(
      { workspace: workspaceDir, model: 'deepseek-chat', mode: 'agent' },
      { id: 'thr_workspace' }
    )

    const readUrl = new URL('http://localhost/v1/threads/thr_workspace/artifacts/content')
    readUrl.searchParams.set('path', reportPath)
    const read = await dispatchRequest(
      h.router,
      new Request(readUrl, {
        headers: { authorization: 'Bearer tok-1' }
      })
    )

    expect(read.status).toBe(200)
    expect(read.headers.get('content-disposition')).toBe('inline; filename="summary.md"')
    expect(await read.text()).toBe('# Workspace Report')

    const downloadUrl = new URL('http://localhost/v1/threads/thr_workspace/artifacts/content')
    downloadUrl.searchParams.set('path', reportPath)
    downloadUrl.searchParams.set('download', 'true')
    const download = await dispatchRequest(
      h.router,
      new Request(downloadUrl, {
        headers: { authorization: 'Bearer tok-1' }
      })
    )

    expect(download.status).toBe(200)
    expect(download.headers.get('content-disposition')).toBe('attachment; filename="summary.md"')
    expect(await download.text()).toBe('# Workspace Report')
  })

  it('rejects absolute artifact paths outside the thread workspace', async () => {
    const h = buildHarness()
    const workspaceDir = join(dir, 'workspace-project')
    const outsidePath = join(dir, 'outside.md')
    await mkdir(workspaceDir, { recursive: true })
    await writeFile(outsidePath, 'secret', 'utf8')
    await h.threadService.create(
      { workspace: workspaceDir, model: 'deepseek-chat', mode: 'agent' },
      { id: 'thr_workspace_escape' }
    )

    const url = new URL('http://localhost/v1/threads/thr_workspace_escape/artifacts/content')
    url.searchParams.set('path', outsidePath)
    const response = await dispatchRequest(
      h.router,
      new Request(url, {
        headers: { authorization: 'Bearer tok-1' }
      })
    )

    expect(response.status).toBe(403)
  })
})

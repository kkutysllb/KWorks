import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, test } from 'vitest'

import {
  kworksGetCodingRoiSummary,
  kworksGetCodingSession,
  kworksGetLatestCodingReview,
  kworksListCodingSessionEvents,
  kworksRunCodingReview
} from '@qiongqi/http/routes/kworks-compat.js'

const execFileAsync = promisify(execFile)
const tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('KWorks coding session compatibility bridge', () => {
  test('hydrates coding session data from persisted qiongqi turn metadata', async () => {
    const runtime = runtimeWithThread({
      id: 'thread_coding',
      workspace: '/tmp/project',
      updatedAt: '2026-07-01T08:00:00.000Z',
      workModeId: 'coding',
      turns: [
        {
          id: 'turn_1',
          threadId: 'thread_coding',
          status: 'completed',
          prompt: 'review this change',
          createdAt: '2026-07-01T07:59:00.000Z',
          finishedAt: '2026-07-01T08:00:00.000Z',
          workModeId: 'coding',
          activeSkillIds: ['code-review', 'systematic-debugging'],
          skillInjectionBytes: 2048,
          toolCatalogToolCount: 12,
          items: [
            {
              id: 'tool_1',
              kind: 'tool_call',
              turnId: 'turn_1',
              threadId: 'thread_coding',
              role: 'assistant',
              status: 'completed',
              createdAt: '2026-07-01T07:59:30.000Z',
              finishedAt: '2026-07-01T07:59:31.000Z',
              toolName: 'read_file',
              callId: 'call_1',
              toolKind: 'tool_call',
              arguments: { path: 'src/app.ts' },
              summary: 'Read src/app.ts'
            }
          ]
        }
      ]
    })

    const sessionResponse = await kworksGetCodingSession(runtime, 'thread_coding')
    const sessionJson = JSON.parse(sessionResponse.body)

    expect(sessionJson.session.project_root).toBe('/tmp/project')
    expect(sessionJson.session.skills).toEqual([
      { id: 'code-review', name: 'code-review' },
      { id: 'systematic-debugging', name: 'systematic-debugging' }
    ])
    expect(sessionJson.session.active_coding_skills).toEqual(sessionJson.session.skills)
    expect(sessionJson.session.tool_policy).toEqual([
      { id: 'read_file', name: 'read_file', kind: 'tool_call' }
    ])
    expect(sessionJson.session.roi.provider_usage.total_tokens).toBeGreaterThan(0)

    const eventsResponse = await kworksListCodingSessionEvents(
      runtime,
      'thread_coding',
      new Request('http://localhost/api/coding/sessions/thread_coding/events')
    )
    const eventsJson = JSON.parse(eventsResponse.body)

    expect(eventsJson.events).toEqual([
      expect.objectContaining({
        event_type: 'tool_call',
        tool_name: 'read_file',
        task_id: 'turn_1'
      })
    ])

    const roiResponse = await kworksGetCodingRoiSummary(runtime, 'thread_coding')
    const roiJson = JSON.parse(roiResponse.body)

    expect(roiJson.summary.report_count).toBe(1)
    expect(roiJson.summary.provider_usage.skill_injection_bytes).toBe(2048)
    expect(roiJson.summary.tool_output.tool_catalog_tool_count).toBe(12)
    expect(roiJson.summary.derived.actual_tokens).toBeGreaterThan(0)
  })

  test('coding session events respect limit and cap large inspector payloads', async () => {
    const turns = Array.from({ length: 8 }, (_, index) => ({
      id: `turn_${index + 1}`,
      threadId: 'thread_coding_limit',
      status: 'completed',
      prompt: 'inspect',
      createdAt: `2026-07-01T07:59:0${index}.000Z`,
      finishedAt: `2026-07-01T08:00:0${index}.000Z`,
      items: [
        {
          id: `tool_result_${index + 1}`,
          kind: 'tool_result',
          turnId: `turn_${index + 1}`,
          threadId: 'thread_coding_limit',
          role: 'tool',
          status: 'completed',
          createdAt: `2026-07-01T07:59:0${index}.000Z`,
          finishedAt: `2026-07-01T08:00:0${index}.000Z`,
          toolName: 'bash',
          callId: `call_${index + 1}`,
          output: { stdout: 'x'.repeat(20_000), exit_code: 0 }
        }
      ]
    }))
    const runtime = runtimeWithThread({
      id: 'thread_coding_limit',
      workspace: '/tmp/project',
      updatedAt: '2026-07-01T08:00:00.000Z',
      turns
    })

    const response = await kworksListCodingSessionEvents(
      runtime,
      'thread_coding_limit',
      new Request('http://localhost/api/coding/sessions/thread_coding_limit/events?limit=3')
    )
    const json = JSON.parse(response.body)

    expect(json.events).toHaveLength(3)
    expect(json.events.map((event: { event_id: string }) => event.event_id))
      .toEqual(['tool_result_6', 'tool_result_7', 'tool_result_8'])
    expect(JSON.stringify(json.events[0].payload).length).toBeLessThan(17_000)
    expect(JSON.stringify(json.events[0].payload)).toContain('truncated')
  })

  test('compat coding review does not silently pass non-empty project diffs', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'kworks-review-'))
    tempRoots.push(projectRoot)
    await execFileAsync('git', ['init'], { cwd: projectRoot })
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: projectRoot })
    await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: projectRoot })
    await writeFile(join(projectRoot, 'app.ts'), 'export const value = 1\n')
    await execFileAsync('git', ['add', 'app.ts'], { cwd: projectRoot })
    await execFileAsync('git', ['commit', '-m', 'initial'], { cwd: projectRoot })
    await writeFile(join(projectRoot, 'app.ts'), 'export const value = 2\n')
    const runtime = runtimeWithThread({
      id: 'thread_review',
      workspace: projectRoot,
      updatedAt: '2026-07-01T08:00:00.000Z',
      turns: []
    }, {
      projects: [{ id: 'proj_1', name: 'Review Project', path: projectRoot }]
    })

    const response = await kworksRunCodingReview(
      runtime,
      { id: 'user_1', userId: 'user_1' } as never,
      new Request('http://localhost/api/coding/reviews', {
        method: 'POST',
        body: JSON.stringify({
          project_id: 'proj_1',
          project_root: projectRoot,
          thread_id: 'thread_review'
        })
      })
    )
    const review = JSON.parse(response.body)

    expect(review.decision).toBe('needs_review')
    expect(review.findings).toEqual([
      expect.objectContaining({
        severity: 'major',
        category: 'review_coverage',
        message: expect.stringContaining('需要真实代码审查'),
        evidence: expect.arrayContaining([
          'changed_files=1',
          'additions=1',
          'deletions=1'
        ]),
        fix: expect.objectContaining({
          applicable: false,
          applied: false
        })
      })
    ])
  })

  test('latest compat coding review can be hydrated from native qiongqi review items', async () => {
    const runtime = runtimeWithThread({
      id: 'thread_native_review',
      workspace: '/tmp/project',
      updatedAt: '2026-07-01T08:00:00.000Z',
      workModeId: 'coding',
      turns: [
        {
          id: 'turn_review',
          threadId: 'thread_native_review',
          status: 'completed',
          prompt: '/review',
          createdAt: '2026-07-01T07:59:00.000Z',
          finishedAt: '2026-07-01T08:00:00.000Z',
          workModeId: 'coding',
          items: [
            {
              id: 'item_native_review',
              kind: 'review',
              threadId: 'thread_native_review',
              turnId: 'turn_review',
              status: 'completed',
              target: { kind: 'uncommittedChanges' },
              title: 'Review current changes',
              reviewText: 'Found one blocking issue.',
              createdAt: '2026-07-01T07:59:01.000Z',
              finishedAt: '2026-07-01T08:00:00.000Z',
              output: {
                findings: [
                  {
                    title: '[P1] Guard missing env check',
                    body: 'The patch reads an env var without checking whether it exists.',
                    confidenceScore: 0.9,
                    priority: 1,
                    codeLocation: {
                      absoluteFilePath: '/tmp/src/app.ts',
                      lineRange: { start: 12, end: 14 }
                    }
                  }
                ],
                overallCorrectness: 'patch is incorrect',
                overallExplanation: 'The change can fail at runtime.',
                overallConfidenceScore: 0.85
              }
            }
          ]
        }
      ]
    })

    const response = await kworksGetLatestCodingReview(runtime, 'thread_native_review')
    const json = JSON.parse(response.body)

    expect(json.review).toMatchObject({
      thread_id: 'thread_native_review',
      scope: 'project_diff',
      decision: 'request_changes',
      summary: {
        critical: 0,
        major: 1,
        minor: 0,
        nitpick: 0
      },
      findings: [
        {
          severity: 'major',
          file: '/tmp/src/app.ts',
          line: 12,
          message: '[P1] Guard missing env check',
          suggestion: 'The patch reads an env var without checking whether it exists.'
        }
      ]
    })
  })
})

function runtimeWithThread(
  thread: Record<string, unknown>,
  options: { projects?: Array<Record<string, unknown>> } = {}
) {
  return {
    threadService: {
      get: async (threadId: string) => (threadId === thread.id ? thread : null)
    },
    kworksUserDataStore: {
      getUserSetting: async () => options.projects ?? [],
      setUserSetting: async () => undefined
    },
    info: () => ({ dataDir: '/tmp/qiongqi-data' }),
    nowIso: () => '2026-07-01T08:00:00.000Z'
  } as never
}

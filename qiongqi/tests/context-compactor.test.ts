import { describe, expect, it } from 'vitest'
import { ContextCompactor } from '@qiongqi/loop'
import { makeAssistantTextItem, makeToolResultItem, makeUserItem } from '@qiongqi/domain'

describe('ContextCompactor task resumption summaries', () => {
  it('writes an executable task-resumption section into compaction summaries', () => {
    const compactor = new ContextCompactor({ softThreshold: 1, hardThreshold: 2 })
    const result = compactor.compact({
      threadId: 'thr_1',
      turnId: 'turn_1',
      history: [
        makeUserItem({
          id: 'user_1',
          turnId: 'turn_1',
          threadId: 'thr_1',
          text: '继续修复 MiniMax-M3 上下文压缩后不知道该干什么的问题'
        }),
        makeAssistantTextItem({
          id: 'assistant_1',
          turnId: 'turn_1',
          threadId: 'thr_1',
          text: '我会先检查压缩和恢复链路。',
          status: 'completed'
        }),
        makeToolResultItem({
          id: 'tool_1',
          turnId: 'turn_1',
          threadId: 'thr_1',
          callId: 'call_1',
          toolName: 'rg',
          output: 'found Continue. in model-compat-client.ts'
        }),
        makeAssistantTextItem({
          id: 'assistant_2',
          turnId: 'turn_1',
          threadId: 'thr_1',
          text: '下一步要把 Continue. 改成明确恢复指令，并同步到上游 QiongQi。',
          status: 'completed'
        })
      ],
      prefix: {
        systemPrompt: '',
        tools: [],
        pinnedConstraints: ['所有 qiongqi 核心修复都要同步到 /Users/libing/kk_Projects/QiongQi'],
        fewShots: [],
        fingerprint: 'test',
        revision: 0
      },
      keepRecent: 1,
      reason: 'test compaction',
      mode: 'force'
    })

    const summary = result.summaryItem.kind === 'compaction' ? result.summaryItem.summary : ''
    expect(summary).toContain('Task resumption state:')
    expect(summary).toContain('Active objective:')
    expect(summary).toContain('Current state:')
    expect(summary).toContain('Next actions:')
    expect(summary).toContain('Do not ask the user what to do')
    expect(summary).toContain('/Users/libing/kk_Projects/QiongQi')
  })
})

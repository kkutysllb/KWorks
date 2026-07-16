import { describe, expect, it } from 'vitest'
import type { ModelProposal } from '@qiongqi/contracts'
import { materializableProposalContent } from '@qiongqi/loop'

describe('proposal materializer', () => {
  it('trims visible reasoning and text and omits empty content', () => {
    expect(materializableProposalContent(proposal({
      reasoning: '  inspect the source  ',
      text: '  I will read the file.  '
    }))).toEqual({
      reasoning: 'inspect the source',
      text: 'I will read the file.'
    })

    expect(materializableProposalContent(proposal({
      reasoning: '   ',
      text: '\n\t'
    }))).toEqual({})
  })

  it.each([
    { leakedProtocolText: true, malformedToolCall: false },
    { leakedProtocolText: false, malformedToolCall: true }
  ])('quarantines content with invalid integrity: %o', (integrity) => {
    expect(materializableProposalContent(proposal({
      integrity: { ...integrity, completeToolCalls: true },
      reasoning: 'must stay hidden',
      text: 'must stay hidden'
    }))).toEqual({})
  })
})

function proposal(overrides: Partial<ModelProposal> = {}): ModelProposal {
  return {
    proposalId: 'proposal-1',
    model: 'test-model',
    stopClass: 'normal',
    integrity: {
      leakedProtocolText: false,
      malformedToolCall: false,
      completeToolCalls: true
    },
    text: '',
    reasoning: '',
    toolIntents: [],
    ...overrides
  }
}

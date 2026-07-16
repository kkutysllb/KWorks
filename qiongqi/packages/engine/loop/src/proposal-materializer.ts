import type { ModelProposal } from '@qiongqi/contracts'

export type MaterializableProposalContent = {
  reasoning?: string
  text?: string
}

export function materializableProposalContent(
  proposal: ModelProposal
): MaterializableProposalContent {
  if (proposal.integrity.leakedProtocolText || proposal.integrity.malformedToolCall) {
    return {}
  }

  const reasoning = proposal.reasoning.trim()
  const text = proposal.text.trim()
  return {
    ...(reasoning ? { reasoning } : {}),
    ...(text ? { text } : {})
  }
}

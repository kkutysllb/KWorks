import type { ToolHostResult } from '../src/tool-host.js'

declare const item: ToolHostResult['item']

const withoutSemantic: ToolHostResult = {
  item,
  approved: true
}

const withSemantic: ToolHostResult = {
  item,
  approved: true,
  semantic: {
    capabilityClass: 'workspace.files',
    resourceKeys: ['workspace:/repo/src/index.ts'],
    artifactRefs: [{ path: 'src/index.ts', kind: 'file' }]
  }
}

const incompleteSemantic: ToolHostResult = {
  item,
  approved: true,
  // @ts-expect-error semantic metadata must include resource keys when present.
  semantic: {
    capabilityClass: 'workspace.files'
  }
}

const incompleteCapabilityClass: ToolHostResult = {
  item,
  approved: true,
  // @ts-expect-error semantic metadata must include a capability class when present.
  semantic: {
    resourceKeys: ['workspace:/repo/src/index.ts']
  }
}

void withoutSemantic
void withSemantic
void incompleteSemantic
void incompleteCapabilityClass

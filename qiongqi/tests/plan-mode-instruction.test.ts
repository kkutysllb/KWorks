import { describe, expect, it } from 'vitest'
import { PLAN_MODE_INSTRUCTION } from '@qiongqi/loop'

describe('PLAN_MODE_INSTRUCTION', () => {
  it('keeps GUI mode switching out of model-visible user replies', () => {
    expect(PLAN_MODE_INSTRUCTION).toContain('Do not ask the user to switch modes')
    expect(PLAN_MODE_INSTRUCTION).toContain('do not explain GUI mode controls')
  })
})

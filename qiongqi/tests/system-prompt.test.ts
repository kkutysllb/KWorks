import { describe, expect, it } from 'vitest'
import { QIONGQI_SYSTEM_PROMPT } from '../packages/foundation/contracts/src/qiongqi-system-prompt.js'

describe('Qiongqi response language contract', () => {
  it('requires Chinese for user-visible prose in Chinese contexts', () => {
    expect(QIONGQI_SYSTEM_PROMPT).toContain('中间过程的用户可见正文和最终回答必须使用中文')
    expect(QIONGQI_SYSTEM_PROMPT).toContain('工具名、命令、路径、代码和原始接口返回保持原样')
  })
})

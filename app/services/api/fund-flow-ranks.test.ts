import { describe, expect, it } from 'vitest'
import { createFundFlowRankEntries } from './fund-flow-ranks'

describe('fund flow ranks', () => {
  it('uses Eastmoney response order as the market rank', () => {
    expect(createFundFlowRankEntries([
      { f12: '002281', f14: '光迅科技', f62: 2_199_403_872, f184: 16.55 },
      { f12: '603986', f14: '兆易创新', f62: 1_999_803_392, f184: 6.55 },
      { f12: '920438', f14: '戈碧迦', f62: 18_000_000, f184: 7.2 }
    ])).toEqual([
      { code: '002281', name: '光迅科技', rank: 1, mainNetInflow: 2_199_403_872, mainNetInflowPercent: 16.55 },
      { code: '603986', name: '兆易创新', rank: 2, mainNetInflow: 1_999_803_392, mainNetInflowPercent: 6.55 },
      { code: '920438', name: '戈碧迦', rank: 3, mainNetInflow: 18_000_000, mainNetInflowPercent: 7.2 }
    ])
  })

  it('skips invalid and duplicate codes without creating rank gaps', () => {
    expect(createFundFlowRankEntries([
      { f12: '603986', f14: '兆易创新', f62: 100 },
      { f12: 'invalid', f14: '无效', f62: 90 },
      { f12: '603986', f14: '重复', f62: 80 },
      { f12: '920438', f14: '戈碧迦', f62: 70 }
    ]).map(({ code, rank }) => ({ code, rank }))).toEqual([
      { code: '603986', rank: 1 },
      { code: '920438', rank: 2 }
    ])
  })
})

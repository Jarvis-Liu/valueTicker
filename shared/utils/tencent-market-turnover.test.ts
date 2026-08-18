import { describe, expect, it } from 'vitest'
import { parseTencentMarketTurnoverBody } from './tencent-market-turnover'

describe('parseTencentMarketTurnoverBody', () => {
  it('parses all exchange amounts and provider timestamps', () => {
    const body = [
      'v_sh000001="1~上证指数~000001~0~~20260818113000~0~3858.25/504879454/1031312143065~";',
      'v_sz399001="51~深证成指~399001~0~~20260818113006~0~14148.73/571360929/1045308334719~";',
      'v_bj899050="62~北证50~899050~0~~20260818113014~0~1055.92/6120950/12222975515~";'
    ].join(' ')

    expect(parseTencentMarketTurnoverBody(body)).toEqual({
      exchanges: {
        sse: 1031312143065,
        szse: 1045308334719,
        bse: 12222975515
      },
      sourceUpdatedAt: '2026-08-18T03:30:14.000Z',
      sourceUpdatedAtByExchange: {
        sse: '2026-08-18T03:30:00.000Z',
        szse: '2026-08-18T03:30:06.000Z',
        bse: '2026-08-18T03:30:14.000Z'
      }
    })
  })

  it('rejects an incomplete three-market response', () => {
    expect(() => parseTencentMarketTurnoverBody('v_sh000001="1~上证指数~0/0/100~20260818113000~";'))
      .toThrow('腾讯成交额接口返回不完整')
  })
})

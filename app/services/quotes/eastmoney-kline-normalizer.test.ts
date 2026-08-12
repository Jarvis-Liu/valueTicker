import { describe, expect, it } from 'vitest'
import { normalizeEastmoneyDailyKline, normalizeEastmoneyDailyKlines } from './eastmoney-kline-normalizer'

describe('eastmoney kline normalizer', () => {
  it('maps f51-f61 into the stock-sdk HistoryKline contract', () => {
    const row = normalizeEastmoneyDailyKline('2026-08-11,10.10,10.50,10.80,9.90,12345,678900,8.57,4.79,0.48,2.31', '301217')
    expect(row).toMatchObject({
      date: '2026-08-11',
      code: '301217',
      open: 10.1,
      close: 10.5,
      high: 10.8,
      low: 9.9,
      volume: 12345,
      amount: 678900,
      amplitude: 8.57,
      changePercent: 4.79,
      change: 0.48,
      turnoverRate: 2.31,
      tz: 'Asia/Shanghai'
    })
    expect(row?.timestamp).toBeTypeOf('number')
  })

  it('filters malformed rows and uses the response security code', () => {
    const rows = normalizeEastmoneyDailyKlines({
      rc: 0,
      data: {
        code: '603259',
        klines: [
          'invalid',
          '2026-08-11,10,10.5,10.8,9.9,1,2,3,4,5,6'
        ]
      }
    }, '000000')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.code).toBe('603259')
  })
})

import { describe, expect, it } from 'vitest'
import { INTRADAY_TICK_COUNT, INTRADAY_TIMELINE, normalizeIntradayTrendPoints } from './intraday-trend-normalizer'
import type { IntradayTrendPoint } from '~/services/quotes/types'

function point(time: string, price: number): IntradayTrendPoint {
  return { time, price, averagePrice: price, volume: 100, amount: 1000 }
}

describe('intraday trend normalizer', () => {
  it('builds a fixed 241-tick trading timeline', () => {
    expect(INTRADAY_TIMELINE).toHaveLength(INTRADAY_TICK_COUNT)
    expect(INTRADAY_TIMELINE[0]).toBe('09:30')
    expect(INTRADAY_TIMELINE[120]).toBe('11:30')
    expect(INTRADAY_TIMELINE[121]).toBe('13:01')
    expect(INTRADAY_TIMELINE.at(-1)).toBe('15:00')
  })

  it('filters pre-open and lunch-break points and keeps future ticks empty', () => {
    const result = normalizeIntradayTrendPoints([
      point('2026-07-23 09:25', 9.9),
      point('2026-07-23 09:30', 10),
      point('2026-07-23 11:31', 10.2),
      point('2026-07-23 13:00', 10.3),
      point('2026-07-23 15:00', 10.8)
    ])

    expect(result).toHaveLength(241)
    expect(result[0]).toMatchObject({ time: '09:30', price: 10 })
    expect(result.find(item => item.time === '09:25')).toBeUndefined()
    expect(result.find(item => item.time === '11:31')).toBeUndefined()
    expect(result[121]).toMatchObject({ time: '13:01', price: 10.3 })
    expect(result.at(-1)).toMatchObject({ time: '15:00', price: 10.8 })
    expect(result[1]).toMatchObject({ time: '09:31', price: null })
  })
})
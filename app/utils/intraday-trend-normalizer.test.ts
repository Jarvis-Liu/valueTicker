import { describe, expect, it } from 'vitest'
import { INTRADAY_TICK_COUNT, INTRADAY_TIMELINE, createTimelineFromBeticks, normalizeIntradayTrendPoints } from './intraday-trend-normalizer'
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


  it('supports Eastmoney overseas index timelines from beticks', () => {
    const timeline = createTimelineFromBeticks('28800|28800|52200|28800|52200')
    expect(timeline).toHaveLength(391)
    expect(timeline?.[0]).toBe('08:00')
    expect(timeline?.at(-1)).toBe('14:30')

    const result = normalizeIntradayTrendPoints([
      point('2026-07-23 08:00', 6963.35),
      point('2026-07-23 09:25', 6980.12),
      point('2026-07-23 14:30', 7012.34)
    ], { timeline: timeline ?? [], foldAfternoonOpen: false })

    expect(result[0]).toMatchObject({ time: '08:00', price: 6963.35 })
    expect(result[85]).toMatchObject({ time: '09:25', price: 6980.12 })
    expect(result.at(-1)).toMatchObject({ time: '14:30', price: 7012.34 })
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
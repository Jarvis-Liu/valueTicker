import { describe, expect, it } from 'vitest'
import { getHistoricalMarketTrendHint, getMarketLocalDate, isHistoricalMarketTrend } from './market-trend-freshness'

describe('market trend freshness', () => {
  it('marks an earlier KOSPI trade date as historical', () => {
    const now = new Date('2026-10-09T06:00:00.000Z')
    expect(getMarketLocalDate('KOSPI:KS11', now)).toBe('2026-10-09')
    expect(isHistoricalMarketTrend('KOSPI:KS11', '2026-10-08', now)).toBe(true)
  })

  it('keeps a same-day trend current', () => {
    const now = new Date('2026-10-09T06:00:00.000Z')
    expect(isHistoricalMarketTrend('SSE:000001', '2026-10-09', now)).toBe(false)
    expect(isHistoricalMarketTrend('KOSPI:KS11', '2026-10-09', now)).toBe(false)
  })

  it('uses the market timezone around midnight', () => {
    const now = new Date('2026-10-09T15:30:00.000Z')
    expect(getMarketLocalDate('SSE:000001', now)).toBe('2026-10-09')
    expect(getMarketLocalDate('KOSPI:KS11', now)).toBe('2026-10-10')
  })

  it('does not flag missing or malformed provider dates', () => {
    expect(isHistoricalMarketTrend('KOSPI:KS11', null)).toBe(false)
    expect(isHistoricalMarketTrend('KOSPI:KS11', '20261008')).toBe(false)
  })

  it('includes the source trade date in the tooltip', () => {
    expect(getHistoricalMarketTrendHint('2026-10-08')).toContain('2026-10-08')
  })
})

import { describe, expect, it } from 'vitest'
import { getMarketSessionState, getNextAutomaticRefreshAt, isContinuousAuction } from './market-calendar'

const atShanghai = (value: string) => new Date(value)

describe('market calendar fallback', () => {
  it('identifies continuous auction in Asia/Shanghai', () => {
    expect(getMarketSessionState(atShanghai('2026-07-21T01:30:00.000Z')).session).toBe('CONTINUOUS')
    expect(getMarketSessionState(atShanghai('2026-07-21T05:00:00.000Z')).session).toBe('CONTINUOUS')
  })

  it('does not treat the lunch break or weekend as continuous auction', () => {
    expect(isContinuousAuction(atShanghai('2026-07-21T04:00:00.000Z'))).toBe(false)
    expect(getMarketSessionState(atShanghai('2026-07-25T01:30:00.000Z')).label).toBe('非交易日')
  })

  it('waits for the next permitted automatic refresh outside continuous auction', () => {
    expect(getNextAutomaticRefreshAt(atShanghai('2026-07-21T04:00:00.000Z')).toISOString()).toBe('2026-07-21T05:00:00.000Z')
    expect(getNextAutomaticRefreshAt(atShanghai('2026-07-21T07:30:00.000Z')).toISOString()).toBe('2026-07-22T01:25:00.000Z')
    expect(getNextAutomaticRefreshAt(atShanghai('2026-07-25T01:30:00.000Z')).toISOString()).toBe('2026-07-27T01:25:00.000Z')
  })
})
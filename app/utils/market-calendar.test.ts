import { describe, expect, it } from 'vitest'
import { getMarketSessionState } from './market-calendar'

describe('market calendar fallback', () => {
  it('identifies continuous auction in Asia/Shanghai', () => {
    expect(getMarketSessionState(new Date('2026-07-21T01:30:00.000Z')).session).toBe('CONTINUOUS')
    expect(getMarketSessionState(new Date('2026-07-21T05:00:00.000Z')).session).toBe('CONTINUOUS')
  })

  it('does not treat the lunch break or weekend as continuous auction', () => {
    expect(getMarketSessionState(new Date('2026-07-21T04:00:00.000Z')).session).toBe('MIDDAY_BREAK')
    expect(getMarketSessionState(new Date('2026-07-25T01:30:00.000Z')).label).toBe('非交易日')
  })
})
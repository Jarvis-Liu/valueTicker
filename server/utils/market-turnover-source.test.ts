import { describe, expect, it } from 'vitest'
import { validateMarketTurnoverSourceTimes } from './market-turnover-source'

describe('validateMarketTurnoverSourceTimes', () => {
  it('accepts three same-day midday timestamps', () => {
    expect(() => validateMarketTurnoverSourceTimes('2026-08-18', 'MIDDAY', {
      sse: '2026-08-18T03:30:00.000Z',
      szse: '2026-08-18T03:30:06.000Z',
      bse: '2026-08-18T03:30:14.000Z'
    })).not.toThrow()
  })

  it('rejects stale timestamps left by a non-trading day', () => {
    expect(() => validateMarketTurnoverSourceTimes('2026-08-18', 'MIDDAY', {
      sse: '2026-08-17T07:00:00.000Z',
      szse: '2026-08-17T07:00:00.000Z',
      bse: '2026-08-17T07:00:00.000Z'
    })).toThrow('行情尚未更新到当前午盘')
  })

  it('rejects close capture before the provider reaches 15:00', () => {
    expect(() => validateMarketTurnoverSourceTimes('2026-08-18', 'CLOSE', {
      sse: '2026-08-18T06:59:59.000Z',
      szse: '2026-08-18T07:00:00.000Z',
      bse: '2026-08-18T07:00:00.000Z'
    })).toThrow('行情尚未更新到当前收盘')
  })
})

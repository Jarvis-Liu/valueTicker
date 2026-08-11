import { describe, expect, it } from 'vitest'
import { shouldRefreshTrendAfterActivation, TREND_RESUME_STALE_MS } from './trend-refresh-policy'

describe('trend refresh policy', () => {
  it('ignores duplicate active events', () => {
    expect(shouldRefreshTrendAfterActivation(true, true, 0, 20_000)).toBe(false)
  })

  it('ignores inactive events and fresh snapshots', () => {
    expect(shouldRefreshTrendAfterActivation(true, false, 0, 20_000)).toBe(false)
    expect(shouldRefreshTrendAfterActivation(false, true, 15_000, 20_000)).toBe(false)
  })

  it('refreshes a stale snapshot after a real activation transition', () => {
    expect(shouldRefreshTrendAfterActivation(false, true, 20_000 - TREND_RESUME_STALE_MS, 20_000)).toBe(true)
  })
})

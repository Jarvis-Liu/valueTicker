import { describe, expect, it } from 'vitest'
import type { SignalType } from 'stock-sdk'
import type { ChipTechnicalSignal } from '~/types/chip-distribution'
import {
  CHIP_SIGNAL_DEFINITIONS,
  filterChipSignals,
  formatChipSignalDetail,
  groupChipSignals
} from './chip-signals'

function signal(type: SignalType, date = '2026-08-06', close = 10): ChipTechnicalSignal {
  return { type, date, timestamp: Date.parse(date), close }
}

describe('chip signal helpers', () => {
  it('defines all 14 stock-sdk signal types', () => {
    expect(Object.keys(CHIP_SIGNAL_DEFINITIONS)).toHaveLength(14)
    expect(CHIP_SIGNAL_DEFINITIONS.ma_golden_cross).toMatchObject({ category: 'CROSS', direction: 'BULLISH' })
    expect(CHIP_SIGNAL_DEFINITIONS.rsi_overbought).toMatchObject({ category: 'OSCILLATOR', direction: 'BEARISH' })
    expect(CHIP_SIGNAL_DEFINITIONS.sar_reversal_up).toMatchObject({ category: 'TREND', direction: 'BULLISH' })
  })

  it('filters signal categories without mutating the source list', () => {
    const signals = [
      signal('ma_golden_cross'),
      signal('rsi_oversold'),
      signal('boll_break_upper')
    ]

    expect(filterChipSignals(signals, 'CROSS').map(item => item.type)).toEqual(['ma_golden_cross'])
    expect(filterChipSignals(signals, 'OSCILLATOR').map(item => item.type)).toEqual(['rsi_oversold'])
    expect(filterChipSignals(signals, 'TREND').map(item => item.type)).toEqual(['boll_break_upper'])
    expect(filterChipSignals(signals, 'HIDDEN')).toEqual([])
    expect(filterChipSignals(signals, 'ALL')).toEqual(signals)
  })

  it('groups same-day signals by direction and drops signals without a price anchor', () => {
    const markers = groupChipSignals([
      signal('ma_golden_cross'),
      signal('macd_golden_cross'),
      signal('ma_death_cross'),
      signal('rsi_oversold', '2026-08-07', Number.NaN)
    ])

    expect(markers).toHaveLength(2)
    expect(markers.find(marker => marker.direction === 'BULLISH')?.signals).toHaveLength(2)
    expect(markers.find(marker => marker.direction === 'BEARISH')?.signals).toHaveLength(1)
  })

  it('formats numeric signal details to two decimals', () => {
    expect(formatChipSignalDetail({ fast: 5, slow: 20, value: 12.3456 })).toBe('快线 5.00 · 慢线 20.00 · 数值 12.35')
  })
})

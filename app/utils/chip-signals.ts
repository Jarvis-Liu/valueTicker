import type { SignalType } from 'stock-sdk'
import type { ChipTechnicalSignal } from '~/types/chip-distribution'

export type ChipSignalCategory = 'CROSS' | 'OSCILLATOR' | 'TREND'
export type ChipSignalFilter = 'ALL' | ChipSignalCategory | 'HIDDEN'
export type ChipSignalDirection = 'BULLISH' | 'BEARISH'

export interface ChipSignalDefinition {
  label: string
  description: string
  category: ChipSignalCategory
  direction: ChipSignalDirection
}

export interface ChipSignalMarker {
  date: string
  close: number
  direction: ChipSignalDirection
  signals: ChipTechnicalSignal[]
}

export const CHIP_SIGNAL_DEFINITIONS: Record<SignalType, ChipSignalDefinition> = {
  ma_golden_cross: { label: 'MA 金叉', description: '短期均线上穿长期均线，表示近期价格动能可能转强。', category: 'CROSS', direction: 'BULLISH' },
  ma_death_cross: { label: 'MA 死叉', description: '短期均线下穿长期均线，表示近期价格动能可能转弱。', category: 'CROSS', direction: 'BEARISH' },
  macd_golden_cross: { label: 'MACD 金叉', description: 'DIF 线上穿 DEA 线，表示中短期动能可能增强。', category: 'CROSS', direction: 'BULLISH' },
  macd_death_cross: { label: 'MACD 死叉', description: 'DIF 线下穿 DEA 线，表示中短期动能可能减弱。', category: 'CROSS', direction: 'BEARISH' },
  kdj_golden_cross: { label: 'KDJ 金叉', description: 'K 线上穿 D 线，表示短期动能可能由弱转强。', category: 'CROSS', direction: 'BULLISH' },
  kdj_death_cross: { label: 'KDJ 死叉', description: 'K 线下穿 D 线，表示短期动能可能由强转弱。', category: 'CROSS', direction: 'BEARISH' },
  kdj_overbought: { label: 'KDJ 超买', description: 'KDJ 进入较高区间，行情偏强，但短线波动或回落风险可能增加。', category: 'OSCILLATOR', direction: 'BEARISH' },
  kdj_oversold: { label: 'KDJ 超卖', description: 'KDJ 进入较低区间，行情偏弱，但可能出现短线修复。', category: 'OSCILLATOR', direction: 'BULLISH' },
  rsi_overbought: { label: 'RSI 超买', description: 'RSI 进入较高区间，买方动能较强，不代表价格一定立即回落。', category: 'OSCILLATOR', direction: 'BEARISH' },
  rsi_oversold: { label: 'RSI 超卖', description: 'RSI 进入较低区间，卖方动能较强，不代表价格一定立即反弹。', category: 'OSCILLATOR', direction: 'BULLISH' },
  boll_break_upper: { label: 'BOLL 上轨突破', description: '收盘价突破布林带上轨，表示上行动能和波动可能增强。', category: 'TREND', direction: 'BULLISH' },
  boll_break_lower: { label: 'BOLL 下轨突破', description: '收盘价跌破布林带下轨，表示下行动能和波动可能增强。', category: 'TREND', direction: 'BEARISH' },
  sar_reversal_up: { label: 'SAR 向上反转', description: 'SAR 判断趋势方向由下行切换为上行。', category: 'TREND', direction: 'BULLISH' },
  sar_reversal_down: { label: 'SAR 向下反转', description: 'SAR 判断趋势方向由上行切换为下行。', category: 'TREND', direction: 'BEARISH' }
}

export function filterChipSignals(signals: ChipTechnicalSignal[], filter: ChipSignalFilter) {
  if (filter === 'HIDDEN') return []
  if (filter === 'ALL') return signals
  return signals.filter(signal => CHIP_SIGNAL_DEFINITIONS[signal.type].category === filter)
}

export function groupChipSignals(signals: ChipTechnicalSignal[]): ChipSignalMarker[] {
  const groups = new Map<string, ChipSignalMarker>()
  for (const signal of signals) {
    if (!Number.isFinite(signal.close)) continue
    const direction = CHIP_SIGNAL_DEFINITIONS[signal.type].direction
    const key = `${signal.date}:${direction}`
    const existing = groups.get(key)
    if (existing) {
      existing.signals.push(signal)
    } else {
      groups.set(key, { date: signal.date, close: signal.close!, direction, signals: [signal] })
    }
  }
  return [...groups.values()]
}

export function formatChipSignalDetail(detail?: Record<string, number>) {
  if (!detail) return ''
  return Object.entries(detail)
    .filter(([, value]) => Number.isFinite(value))
    .map(([key, value]) => `${SIGNAL_DETAIL_LABELS[key] ?? key} ${value.toFixed(2)}`)
    .join(' · ')
}

const SIGNAL_DETAIL_LABELS: Record<string, string> = {
  fast: '快线',
  slow: '慢线',
  dif: 'DIF',
  dea: 'DEA',
  k: 'K',
  d: 'D',
  j: 'J',
  rsi: 'RSI',
  upper: '上轨',
  lower: '下轨',
  sar: 'SAR',
  value: '数值'
}

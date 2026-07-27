import type { MarketTurnoverPhase } from '~~/shared/types/market-turnover'

const SHANGHAI_TIME_ZONE = 'Asia/Shanghai'
const MIDDAY_START = 11 * 3600 + 30 * 60
const MIDDAY_SEAL = 12 * 3600
const MIDDAY_END = 13 * 3600
const CLOSE_START = 15 * 3600
const CLOSE_SEAL = 15 * 3600 + 30 * 60

export interface MarketTurnoverWindow {
  tradeDate: string
  phase: MarketTurnoverPhase
  shouldSeal: boolean
}

/**
 * 只依据服务端 Asia/Shanghai 时间决定可写窗口，前端不传时段和时钟。
 * 午盘窗口为 11:30–13:00，收盘窗口为 15:00 后；交易日历未接入时按工作日兜底。
 */
export function getMarketTurnoverWindow(now = new Date()): MarketTurnoverWindow | null {
  const parts = getShanghaiParts(now)
  if (parts.weekday === 0 || parts.weekday === 6) return null
  if (parts.seconds >= MIDDAY_START && parts.seconds < MIDDAY_END) {
    return { tradeDate: parts.tradeDate, phase: 'MIDDAY', shouldSeal: parts.seconds >= MIDDAY_SEAL }
  }
  if (parts.seconds >= CLOSE_START) {
    return { tradeDate: parts.tradeDate, phase: 'CLOSE', shouldSeal: parts.seconds >= CLOSE_SEAL }
  }
  return null
}

function getShanghaiParts(now: Date) {
  const values = new Intl.DateTimeFormat('en-CA', {
    timeZone: SHANGHAI_TIME_ZONE,
    weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) => values.find(value => value.type === type)?.value ?? '0'
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return {
    weekday: weekdays[part('weekday')] ?? 0,
    seconds: Number(part('hour')) * 3600 + Number(part('minute')) * 60 + Number(part('second')),
    tradeDate: `${part('year')}-${part('month')}-${part('day')}`
  }
}

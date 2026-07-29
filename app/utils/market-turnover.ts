import type { ExchangeTurnoverAmounts, MarketTurnoverPhase, MarketTurnoverSnapshot } from '~~/shared/types/market-turnover'

const SHANGHAI_TIME_ZONE = 'Asia/Shanghai'

export interface MarketTurnoverDisplay {
  total: number
  phase: MarketTurnoverPhase | null
  reference: MarketTurnoverSnapshot | null
}

/** 仅用于前端展示与是否发起“申请更新”请求；服务端仍是最终窗口判定者。 */
export function getClientMarketTurnoverPhase(now = new Date()): MarketTurnoverPhase | null {
  const { weekday, seconds } = getShanghaiParts(now)
  if (weekday === 0 || weekday === 6) return null
  if (seconds >= 11 * 3600 + 30 * 60 && seconds < 13 * 3600) return 'MIDDAY'
  if (seconds >= 15 * 3600) return 'CLOSE'
  return null
}

/** 返回尚未进入可对比时段时的页面提示文案。 */
export function getMarketTurnoverComparisonHint(now = new Date()) {
  const { weekday, seconds } = getShanghaiParts(now)
  if (weekday === 0 || weekday === 6) return '下一交易日 11:30 后可对比午盘'
  if (seconds >= 13 * 3600 && seconds < 15 * 3600) return '15:00 后可对比全天交易'
  return '11:30 后可对比午盘'
}
export function getShanghaiTradeDate(now = new Date()) {
  return getShanghaiParts(now).tradeDate
}

/** 年度交易日历尚未接入时，按工作日回退，供读取上一交易日基准使用。 */
export function getPreviousWeekdayTradeDate(now = new Date()) {
  const [year, month, day] = getShanghaiTradeDate(now).split('-').map(Number)
  const date = new Date(Date.UTC(year!, month! - 1, day!))
  do date.setUTCDate(date.getUTCDate() - 1)
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export function sumMarketTurnover(exchanges: ExchangeTurnoverAmounts) {
  return exchanges.sse + exchanges.szse + exchanges.bse
}

function getShanghaiParts(now: Date) {
  const values = new Intl.DateTimeFormat('en-CA', { timeZone: SHANGHAI_TIME_ZONE, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) => values.find(value => value.type === type)?.value ?? '0'
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return { weekday: weekdays[part('weekday')] ?? 0, seconds: Number(part('hour')) * 3600 + Number(part('minute')) * 60 + Number(part('second')), tradeDate: `${part('year')}-${part('month')}-${part('day')}` }
}

export type MarketSession = 'PRE_OPEN' | 'CALL_AUCTION' | 'CONTINUOUS' | 'MIDDAY_BREAK' | 'CLOSED'

export interface MarketSessionState {
  session: MarketSession
  isTradingDay: boolean
  isCalendarCalibrated: boolean
  label: string
}

const SHANGHAI_TIME_ZONE = 'Asia/Shanghai'

/** V2 暂未接入年度交易日历文件时，以工作日作为调度兜底。 */
export function getMarketSessionState(now = new Date()): MarketSessionState {
  const { weekday, hour, minute, second } = getShanghaiParts(now)
  const isTradingDay = weekday >= 1 && weekday <= 5
  if (!isTradingDay) return createState('CLOSED', false)

  const time = hour * 3600 + minute * 60 + second
  if (time >= 33900 && time < 34200) return createState('CALL_AUCTION', true)
  if ((time >= 34200 && time < 41400) || (time >= 46800 && time < 54000)) return createState('CONTINUOUS', true)
  if (time >= 41400 && time < 46800) return createState('MIDDAY_BREAK', true)
  if (time < 33900) return createState('PRE_OPEN', true)
  return createState('CLOSED', true)
}

function createState(session: MarketSession, isTradingDay: boolean): MarketSessionState {
  const labels: Record<MarketSession, string> = {
    PRE_OPEN: '开盘前', CALL_AUCTION: '集合竞价时段', CONTINUOUS: '连续竞价时段', MIDDAY_BREAK: '午间休市', CLOSED: isTradingDay ? '已收盘' : '非交易日'
  }
  return { session, isTradingDay, isCalendarCalibrated: false, label: labels[session] }
}

function getShanghaiParts(now: Date) {
  const values = new Intl.DateTimeFormat('en-US', { timeZone: SHANGHAI_TIME_ZONE, weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) => values.find(value => value.type === type)?.value ?? '0'
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return { weekday: weekdays[part('weekday')] ?? 0, hour: Number(part('hour')), minute: Number(part('minute')), second: Number(part('second')) }
}
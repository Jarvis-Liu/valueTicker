export type MarketSession = 'PRE_OPEN' | 'CALL_AUCTION' | 'CONTINUOUS' | 'MIDDAY_BREAK' | 'CLOSED'

export interface MarketSessionState {
  session: MarketSession
  isTradingDay: boolean
  isCalendarCalibrated: boolean
  label: string
}

const SHANGHAI_TIME_ZONE = 'Asia/Shanghai'
const OPEN_AUCTION = 9 * 3600 + 25 * 60
const CONTINUOUS_MORNING_START = 9 * 3600 + 30 * 60
const MORNING_CLOSE = 11 * 3600 + 30 * 60
const AFTERNOON_START = 13 * 3600
const MARKET_CLOSE = 15 * 3600

/** V2 暂未接入年度交易日历文件时，以工作日作为调度兜底。 */
export function getMarketSessionState(now = new Date()): MarketSessionState {
  const { weekday, secondsOfDay } = getShanghaiParts(now)
  const isTradingDay = weekday >= 1 && weekday <= 5
  if (!isTradingDay) return createState('CLOSED', false)
  if (secondsOfDay >= OPEN_AUCTION && secondsOfDay < CONTINUOUS_MORNING_START) return createState('CALL_AUCTION', true)
  if ((secondsOfDay >= CONTINUOUS_MORNING_START && secondsOfDay < MORNING_CLOSE) || (secondsOfDay >= AFTERNOON_START && secondsOfDay < MARKET_CLOSE)) return createState('CONTINUOUS', true)
  if (secondsOfDay >= MORNING_CLOSE && secondsOfDay < AFTERNOON_START) return createState('MIDDAY_BREAK', true)
  if (secondsOfDay < OPEN_AUCTION) return createState('PRE_OPEN', true)
  return createState('CLOSED', true)
}

/** 只在连续竞价时段进行自动轮询。集合竞价和收盘边界快照由调度器单独触发。 */
export function isContinuousAuction(now = new Date()) {
  return getMarketSessionState(now).session === 'CONTINUOUS'
}

/**
 * 计算下一次允许的自动行情请求：09:25、连续竞价 5 秒边界、11:30、13:00、15:00。
 * 返回的是等待时点；闭市期间不会产生任何行情请求。
 */
export function getNextAutomaticRefreshAt(now = new Date(), intervalMs = 5000) {
  const { weekday, secondsOfDay } = getShanghaiParts(now)
  const intervalSeconds = Math.max(5, Math.floor(intervalMs / 1000))
  const todayIsWeekday = weekday >= 1 && weekday <= 5

  if (todayIsWeekday) {
    if (secondsOfDay < OPEN_AUCTION) return atOffset(now, OPEN_AUCTION - secondsOfDay)
    if (secondsOfDay < CONTINUOUS_MORNING_START) return atOffset(now, CONTINUOUS_MORNING_START - secondsOfDay)
    if (secondsOfDay < MORNING_CLOSE) return atOffset(now, nextBoundary(secondsOfDay, intervalSeconds) - secondsOfDay)
    if (secondsOfDay < AFTERNOON_START) return atOffset(now, AFTERNOON_START - secondsOfDay)
    if (secondsOfDay < MARKET_CLOSE) return atOffset(now, nextBoundary(secondsOfDay, intervalSeconds) - secondsOfDay)
  }

  return atOffset(now, secondsUntilNextWeekdayOpen(weekday, secondsOfDay))
}

function nextBoundary(secondsOfDay: number, intervalSeconds: number) {
  return Math.floor(secondsOfDay / intervalSeconds) * intervalSeconds + intervalSeconds
}

function secondsUntilNextWeekdayOpen(weekday: number, secondsOfDay: number) {
  let days = 1
  let nextWeekday = (weekday + days) % 7
  while (nextWeekday === 0 || nextWeekday === 6) {
    days += 1
    nextWeekday = (weekday + days) % 7
  }
  return days * 86400 - secondsOfDay + OPEN_AUCTION
}

function atOffset(now: Date, seconds: number) {
  return new Date(now.getTime() + Math.max(0, seconds) * 1000)
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
  const hour = Number(part('hour'))
  const minute = Number(part('minute'))
  const second = Number(part('second'))
  return { weekday: weekdays[part('weekday')] ?? 0, secondsOfDay: hour * 3600 + minute * 60 + second }
}
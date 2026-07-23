import type { IntradayTrendPoint } from '~/services/quotes/types'

export const INTRADAY_TICK_COUNT = 241
export const INTRADAY_TIMELINE = createAShareIntradayTimeline()

export interface IntradayTrendNormalizeOptions {
  timeline?: string[]
  foldAfternoonOpen?: boolean
}

export function normalizeIntradayTrendPoints(points: IntradayTrendPoint[], options: IntradayTrendNormalizeOptions = {}): IntradayTrendPoint[] {
  const timeline = options.timeline?.length ? options.timeline : INTRADAY_TIMELINE
  const timelineSet = new Set(timeline)
  const foldAfternoonOpen = options.foldAfternoonOpen ?? timeline === INTRADAY_TIMELINE
  const pointsByMinute = new Map<string, IntradayTrendPoint>()

  for (const point of points) {
    const minute = normalizeTrendMinute(point.time, foldAfternoonOpen)
    if (!minute || !timelineSet.has(minute)) continue
    pointsByMinute.set(minute, {
      time: minute,
      price: finiteOrNull(point.price),
      averagePrice: finiteOrNull(point.averagePrice),
      volume: finiteOrNull(point.volume),
      amount: finiteOrNull(point.amount)
    })
  }

  return timeline.map((time) => pointsByMinute.get(time) ?? createEmptyTrendPoint(time))
}

export function createContinuousIntradayTimeline(start: string, end: string): string[] {
  return createMinuteRange(start, end)
}

export function createTimelineFromBeticks(value: string | undefined): string[] | null {
  const seconds = (value ?? '')
    .split('|')
    .map(part => Number(part))
    .filter(Number.isFinite)

  if (seconds.length < 2) return null
  const start = Math.min(...seconds)
  const end = Math.max(...seconds)
  if (start < 0 || end <= start) return null

  return createContinuousIntradayTimeline(formatMinuteOfDay(Math.floor(start / 60)), formatMinuteOfDay(Math.floor(end / 60)))
}

function createAShareIntradayTimeline(): string[] {
  const morning = createMinuteRange('09:30', '11:30')
  // A-share minute charts use 241 ticks. Keeping 15:00 means the afternoon axis starts at 13:01;
  // provider data reported at 13:00 is folded onto that first afternoon tick below.
  const afternoon = createMinuteRange('13:01', '15:00')
  return [...morning, ...afternoon]
}

function createMinuteRange(start: string, end: string): string[] {
  const result: string[] = []
  let cursor = toMinuteOfDay(start)
  const endMinute = toMinuteOfDay(end)

  while (cursor <= endMinute) {
    result.push(formatMinuteOfDay(cursor))
    cursor += 1
  }

  return result
}

function normalizeTrendMinute(value: string, foldAfternoonOpen: boolean) {
  const matched = value.match(/(?:^|\s)(\d{2}):(\d{2})(?::\d{2})?$/) ?? value.match(/(\d{2})(\d{2})$/)
  if (!matched) return null

  const hour = Number(matched[1])
  const minute = Number(matched[2])
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour > 23 || minute > 59) return null

  const normalized = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  if (foldAfternoonOpen && normalized === '13:00') return '13:01'
  return normalized
}

function createEmptyTrendPoint(time: string): IntradayTrendPoint {
  return { time, price: null, averagePrice: null, volume: null, amount: null }
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function toMinuteOfDay(value: string) {
  const [hour = '0', minute = '0'] = value.split(':')
  return Number(hour) * 60 + Number(minute)
}

function formatMinuteOfDay(value: number) {
  const hour = Math.floor(value / 60)
  const minute = value % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}
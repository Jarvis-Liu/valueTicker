import type { SecurityItem } from '~~/shared/types/stock'
import { createTimelineFromBeticks, normalizeIntradayTrendPoints } from '../../utils/intraday-trend-normalizer'
import type { IntradayTrendPoint, SecurityIntradayTrend } from './types'

const ENDPOINT = 'https://push2.eastmoney.com/api/qt/stock/trends2/get'
const TIMEOUT_MS = 5000

/** 请求东财单只证券的当日分钟趋势。 */
export async function fetchEastmoneyIntradayTrend(security: SecurityItem): Promise<SecurityIntradayTrend> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const url = new URL(ENDPOINT)
    url.searchParams.set('secid', toEastmoneySecId(security))
    url.searchParams.set('fields1', 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13')
    url.searchParams.set('fields2', 'f51,f52,f53,f54,f55,f56,f57,f58')

    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`东财分时接口返回 HTTP ${response.status}`)

    const payload = await response.json() as EastmoneyTrendResponse
    if (payload.rc !== 0 || !payload.data) throw new Error(`东财分时接口返回错误码 ${payload.rc}`)

    const rawPoints = (payload.data.trends ?? []).map(parseTrendPoint).filter((point): point is IntradayTrendPoint => point !== null)
    const customTimeline = shouldUseProviderTimeline(security) ? createTimelineFromBeticks(payload.data.beticks) : null
    const points = normalizeIntradayTrendPoints(rawPoints, customTimeline ? { timeline: customTimeline, foldAfternoonOpen: false } : undefined)

    return {
      securityId: security.securityId,
      previousClose: number(payload.data.preClose),
      openingPrice: firstFinitePrice(points),
      points,
      updatedAt: formatLocalDateTime(new Date()),
      provider: 'EASTMONEY',
      status: 'READY'
    }
  } finally {
    clearTimeout(timeout)
  }
}

function toEastmoneySecId(security: SecurityItem) {
  return security.providerSymbols.eastmoney ?? `${security.exchange === 'SSE' ? '1' : '0'}.${security.code}`
}

function shouldUseProviderTimeline(security: SecurityItem) {
  return security.providerSymbols.eastmoney?.startsWith('100.') === true
}

function parseTrendPoint(value: string): IntradayTrendPoint | null {
  const fields = value.split(',')
  const time = fields[0]?.trim()
  const price = number(fields[1])
  if (!time || !Number.isFinite(price)) return null

  return {
    time,
    price,
    averagePrice: number(fields[7]),
    volume: number(fields[5]),
    amount: number(fields[6])
  }
}

function firstFinitePrice(points: IntradayTrendPoint[]) {
  return points.find(point => Number.isFinite(point.price))?.price ?? Number.NaN
}

function number(value: number | string | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function formatLocalDateTime(value: Date) {
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
}

interface EastmoneyTrendResponse {
  rc: number
  data?: {
    preClose?: number | string
    beticks?: string
    trends?: string[]
  }
}
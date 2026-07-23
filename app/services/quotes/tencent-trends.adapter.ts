import type { SecurityItem } from '~~/shared/types/stock'
import { normalizeIntradayTrendPoints } from '../../utils/intraday-trend-normalizer'
import type { IntradayTrendPoint, SecurityIntradayTrend } from './types'

const ENDPOINT = 'https://web.ifzq.gtimg.cn/appstock/app/minute/query'
const TIMEOUT_MS = 5000

/** 请求腾讯单只证券的当日分钟趋势。 */
export async function fetchTencentIntradayTrend(security: SecurityItem): Promise<SecurityIntradayTrend> {
  const symbol = security.providerSymbols.tencent
  if (!symbol) throw new Error(`${security.code} 不支持腾讯分时数据`)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const url = new URL(ENDPOINT)
    url.searchParams.set('code', symbol)

    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`腾讯分时接口返回 HTTP ${response.status}`)

    const payload = await response.json() as TencentTrendResponse
    const trendData = payload.data?.[symbol]
    if (payload.code !== 0 || !trendData) throw new Error('腾讯分时接口未返回有效数据')

    const date = trendData.data?.date ?? trendData.date ?? ''
    const snapshot = trendData.qt?.[symbol] ?? []
    const points = normalizeIntradayTrendPoints((trendData.data?.data ?? []).map(value => parseTrendPoint(value, date)).filter((point): point is IntradayTrendPoint => point !== null))

    return {
      securityId: security.securityId,
      previousClose: number(snapshot[4]),
      openingPrice: firstFinitePrice(points),
      points,
      updatedAt: formatTencentDateTime(snapshot[29]),
      provider: 'TENCENT',
      status: 'READY'
    }
  } finally {
    clearTimeout(timeout)
  }
}

function parseTrendPoint(value: string, date: string): IntradayTrendPoint | null {
  const fields = value.trim().split(/\s+/)
  const time = fields[0]
  const price = number(fields[1])
  const volume = number(fields[2])
  const amount = number(fields[3])
  if (!time || !Number.isFinite(price)) return null

  return {
    time: formatPointTime(date, time),
    price,
    // 腾讯分钟数据只提供累计成交量、成交额；不将其推导为东财口径的成交均价。
    averagePrice: Number.NaN,
    volume,
    amount
  }
}

function firstFinitePrice(points: IntradayTrendPoint[]) {
  return points.find(point => Number.isFinite(point.price))?.price ?? Number.NaN
}

function formatPointTime(date: string, time: string) {
  const matched = date.match(/^(\d{4})(\d{2})(\d{2})$/)
  const hour = time.slice(0, 2)
  const minute = time.slice(2, 4)
  return matched && /^\d{4}$/.test(time) ? `${matched[1]}-${matched[2]}-${matched[3]} ${hour}:${minute}` : time
}

function formatTencentDateTime(value: string | undefined) {
  const matched = value?.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/)
  if (matched) return `${matched[1]}-${matched[2]}-${matched[3]} ${matched[4]}:${matched[5]}:${matched[6]}`
  return formatLocalDateTime(new Date())
}

function number(value: number | string | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function formatLocalDateTime(value: Date) {
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
}

interface TencentTrendResponse {
  code: number
  data?: Record<string, {
    date?: string
    data?: { date?: string, data?: string[] }
    qt?: Record<string, string[]>
  }>
}
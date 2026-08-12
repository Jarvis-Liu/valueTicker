import type { SecurityItem } from '~~/shared/types/stock'
import type { TencentIntradayResponse } from '~~/shared/types/tencent-intraday'
import { normalizeIntradayTrendPoints } from '../../utils/intraday-trend-normalizer'
import { fetchTencentIntradayFromProxy, TencentIntradayProxyError } from '../api/tencent-intraday'
import type { IntradayTrendPoint, SecurityIntradayTrend } from './types'

const DIRECT_ENDPOINT = 'https://web.ifzq.gtimg.cn/appstock/app/minute/query'
const TIMEOUT_MS = 5000
const PROXY_FAILURE_THRESHOLD = 3
const PROXY_CIRCUIT_DURATION_MS = 30_000
let consecutiveProxyFailures = 0
let proxyCircuitOpenUntil = 0

/** 请求腾讯单只证券的当日分钟趋势。 */
export async function fetchTencentIntradayTrend(security: SecurityItem): Promise<SecurityIntradayTrend> {
  const symbol = security.providerSymbols.tencent
  if (!symbol) throw new Error(`${security.code} 不支持腾讯分时数据`)

  const payload = await fetchTencentIntradayPayload(symbol)
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
}

/** 正式 API 优先；仅代理网络或 5xx 故障时直连腾讯，并通过短期熔断避免每只证券重复等待。 */
async function fetchTencentIntradayPayload(symbol: string): Promise<TencentIntradayResponse> {
  if (Date.now() < proxyCircuitOpenUntil) return fetchTencentIntradayDirect(symbol)

  try {
    const payload = await fetchTencentIntradayFromProxy(symbol)
    consecutiveProxyFailures = 0
    proxyCircuitOpenUntil = 0
    return payload
  } catch (error) {
    if (!(error instanceof TencentIntradayProxyError) || !error.fallbackEligible) throw error

    consecutiveProxyFailures += 1
    if (consecutiveProxyFailures >= PROXY_FAILURE_THRESHOLD) {
      proxyCircuitOpenUntil = Date.now() + PROXY_CIRCUIT_DURATION_MS
      consecutiveProxyFailures = 0
    }
    return fetchTencentIntradayDirect(symbol)
  }
}

async function fetchTencentIntradayDirect(symbol: string): Promise<TencentIntradayResponse> {
  const url = new URL(DIRECT_ENDPOINT)
  url.searchParams.set('code', symbol)
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!response.ok) throw new Error(`腾讯分时直连接口返回 HTTP ${response.status}`)
  return await response.json() as TencentIntradayResponse
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

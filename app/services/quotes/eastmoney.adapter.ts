import type { SecurityItem } from '~~/shared/types/stock'
import type { NormalizedQuote } from './types'

const ENDPOINT = 'https://push2.eastmoney.com/api/qt/ulist.np/get'
const BATCH_SIZE = 80
const TIMEOUT_MS = 3000
const FIELDS = 'f2,f3,f4,f5,f6,f8,f12,f13,f14,f15,f16,f17,f18,f20,f114'

export async function fetchEastmoneyQuotes(securities: SecurityItem[]): Promise<NormalizedQuote[]> {
  const batches: SecurityItem[][] = []
  for (let index = 0; index < securities.length; index += BATCH_SIZE) batches.push(securities.slice(index, index + BATCH_SIZE))

  const results = await Promise.all(batches.map(fetchBatch))
  return results.flat()
}

async function fetchBatch(securities: SecurityItem[]): Promise<NormalizedQuote[]> {
  if (!securities.length) return []

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const url = new URL(ENDPOINT)
    url.searchParams.set('fltt', '2')
    url.searchParams.set('fields', FIELDS)
    url.searchParams.set('secids', securities.map(toEastmoneySecId).join(','))

    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`东财行情接口返回 HTTP ${response.status}`)

    const payload = await response.json() as EastmoneyQuoteResponse
    if (payload.rc !== 0) throw new Error(`东财行情接口返回错误码 ${payload.rc}`)

    return (payload.data?.diff ?? [])
      .map(convertEastmoneyQuote)
      .filter((quote): quote is NormalizedQuote => quote !== null)
  } finally {
    clearTimeout(timeout)
  }
}

function toEastmoneySecId(security: SecurityItem) {
  const market = security.exchange === 'SSE' ? '1' : '0'
  return `${market}.${security.code}`
}

function convertEastmoneyQuote(item: EastmoneyQuoteItem): NormalizedQuote | null {
  const code = String(item.f12 ?? '')
  if (!/^\d{6}$/.test(code)) return null

  const exchange = item.f13 === 1 ? 'SSE' : code.startsWith('9') ? 'BSE' : 'SZSE'
  const price = number(item.f2)
  const previousClose = number(item.f18)
  const change = number(item.f4)
  const changePercent = number(item.f3)

  if (!Number.isFinite(price)) return null

  return {
    securityId: `${exchange}:${code}`,
    price,
    change: Number.isFinite(change) ? change : Number.isFinite(previousClose) ? price - previousClose : Number.NaN,
    changePercent,
    volume: number(item.f5),
    amount: number(item.f6),
    turnoverRate: number(item.f8),
    open: number(item.f17),
    high: number(item.f15),
    low: number(item.f16),
    previousClose,
    totalMarketValue: number(item.f20),
    peTtm: number(item.f114),
    providerCode: code,
    providerMarket: item.f13 ?? Number.NaN,
    providerName: item.f14 ?? '',
    updatedAt: formatLocalDateTime(new Date()),
    status: 'TRADING',
    provider: 'EASTMONEY'
  }
}

function number(value: number | string | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function formatLocalDateTime(value: Date) {
  const year = value.getFullYear()
  const month = pad(value.getMonth() + 1)
  const day = pad(value.getDate())
  const hour = pad(value.getHours())
  const minute = pad(value.getMinutes())
  const second = pad(value.getSeconds())
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

interface EastmoneyQuoteResponse {
  rc: number
  data?: {
    diff?: EastmoneyQuoteItem[]
  }
}

interface EastmoneyQuoteItem {
  f2?: number | string
  f3?: number | string
  f4?: number | string
  f5?: number | string
  f6?: number | string
  f8?: number | string
  f12?: number | string
  f13?: number
  f14?: string
  f15?: number | string
  f16?: number | string
  f17?: number | string
  f18?: number | string
  f20?: number | string
  f114?: number | string
}

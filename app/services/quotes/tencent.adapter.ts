import type { SecurityItem } from '~~/shared/types/stock'
import type { NormalizedQuote } from './types'

const ENDPOINT = 'https://qt.gtimg.cn/q='
const BATCH_SIZE = 50
const TIMEOUT_MS = 3000

export async function fetchTencentQuotes(securities: SecurityItem[]): Promise<NormalizedQuote[]> {
  const supported = securities.filter(item => item.providerSymbols.tencent)
  const batches: SecurityItem[][] = []
  for (let index = 0; index < supported.length; index += BATCH_SIZE) batches.push(supported.slice(index, index + BATCH_SIZE))

  const results = await Promise.all(batches.map(fetchBatch))
  return results.flat()
}

async function fetchBatch(securities: SecurityItem[]): Promise<NormalizedQuote[]> {
  if (!securities.length) return []
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const symbols = securities.map(item => item.providerSymbols.tencent).join(',')
    const response = await fetch(`${ENDPOINT}${symbols}`, { signal: controller.signal })
    if (!response.ok) throw new Error(`腾讯行情接口返回 HTTP ${response.status}`)
    const body = new TextDecoder('gbk').decode(await response.arrayBuffer())
    return body.split(/\r?\n/).map(parseTencentLine).filter((quote): quote is NormalizedQuote => quote !== null)
  } finally {
    clearTimeout(timeout)
  }
}

function parseTencentLine(line: string): NormalizedQuote | null {
  const match = line.match(/^v_([^=]+)="([\s\S]*?)";?$/)
  if (!match) return null
  const fields = (match[2] ?? '').split('~')
  const code = fields[2]
  const symbol = (match[1] ?? '').replace(/^s_/, '')
  if (!code || !/^\d{6}$/.test(code)) return null
  const exchange = symbol.slice(0, 2).toUpperCase()
  const securityId = `${exchange === 'SH' ? 'SSE' : exchange === 'SZ' ? 'SZSE' : 'BSE'}:${code}`
  const price = number(fields[3])
  const previousClose = number(fields[4])
  const change = number(fields[31])
  const changePercent = number(fields[32])
  if (!Number.isFinite(price)) return null

  return {
    securityId,
    price,
    change,
    changePercent,
    open: number(fields[5]),
    high: number(fields[33]),
    low: number(fields[34]),
    previousClose,
    updatedAt: formatTencentDateTime(fields[30]),
    status: 'TRADING',
    provider: 'TENCENT'
  }
}

function number(value: string | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

/** 将腾讯 YYYYMMDDHHmmss 行情时间转换为统一的本地展示格式。 */
function formatTencentDateTime(value: string | undefined) {
  const matched = value?.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/)
  if (matched) return `${matched[1]}-${matched[2]}-${matched[3]} ${matched[4]}:${matched[5]}:${matched[6]}`

  const now = new Date()
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

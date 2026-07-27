import type { ExchangeTurnoverAmounts } from '~~/shared/types/market-turnover'

const ENDPOINT = 'https://qt.gtimg.cn/q=sh000001,sz399001,bj899050'
const TIMEOUT_MS = 3000

export interface TencentMarketTurnover {
  exchanges: ExchangeTurnoverAmounts
  /** 三条行情中最晚的供应商时间，ISO 格式；解析不到时为 null。 */
  sourceUpdatedAt: string | null
}

/**
 * 浏览器直连腾讯三大交易所指数行情，并从 `现价/成交量/成交额` 复合字段提取成交额。
 * 该函数只获取和解析公开行情，不会经由本站 Nitro 代理。
 */
export async function fetchTencentMarketTurnover(): Promise<TencentMarketTurnover> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(ENDPOINT, { signal: controller.signal })
    if (!response.ok) throw new Error(`腾讯成交额接口返回 HTTP ${response.status}`)
    const body = new TextDecoder('gbk').decode(await response.arrayBuffer())
    // 腾讯会因网络/CDN 返回形态不同而以换行或连续赋值拼接多标的记录，不能仅按换行切分。
    const records = Array.from(body.matchAll(/v_([^=]+)="([^"]*)";?/g))
      .map(([, symbol, payload]) => parseTencentTurnoverRecord(symbol, payload))
      .filter((record): record is { symbol: string, amount: number, updatedAt: string | null } => record !== null)
    const bySymbol = new Map(records.map(record => [record.symbol, record]))
    const sse = bySymbol.get('sh000001')
    const szse = bySymbol.get('sz399001')
    const bse = bySymbol.get('bj899050')
    if (!sse || !szse || !bse) throw new Error('腾讯成交额接口返回不完整')
    const sourceTimes = [sse.updatedAt, szse.updatedAt, bse.updatedAt].filter((value): value is string => value !== null).sort()
    const result = { exchanges: { sse: sse.amount, szse: szse.amount, bse: bse.amount }, sourceUpdatedAt: sourceTimes.at(-1) ?? null }
    // 临时诊断日志：确认腾讯原始响应经解析后的三市成交额结构。
    console.info('[ValueTicker] Tencent market turnover parsed', result)
    return result
  } finally {
    window.clearTimeout(timeout)
  }
}

function parseTencentTurnoverRecord(symbol: string, payload: string) {
  const fields = payload.split('~')
  // 腾讯返回的复合字段形如“最新价/成交量/成交额”，示例：3858.25/504879454/1031312143065。
  const amountField = fields.find(value => /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/.test(value))
  const amount = Number(amountField?.split('/').at(-1))
  if (!Number.isFinite(amount) || amount < 0) return null
  const time = fields.find(value => /^\d{14}$/.test(value))
  return { symbol, amount, updatedAt: time ? tencentTimeToIso(time) : null }
}
function tencentTimeToIso(value: string) {
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(4, 6)) - 1
  const day = Number(value.slice(6, 8))
  const hour = Number(value.slice(8, 10))
  const minute = Number(value.slice(10, 12))
  const second = Number(value.slice(12, 14))
  // 腾讯时间是北京时间；转换为 ISO 便于服务端和页面统一存储与展示。
  return new Date(Date.UTC(year, month, day, hour - 8, minute, second)).toISOString()
}

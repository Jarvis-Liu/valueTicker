import type { TencentMarketTurnover } from '~~/shared/types/market-turnover'
import { parseTencentMarketTurnoverBody } from '~~/shared/utils/tencent-market-turnover'

const ENDPOINT = 'https://qt.gtimg.cn/q=sh000001,sz399001,bj899050'
const TIMEOUT_MS = 3000

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
    const result = parseTencentMarketTurnoverBody(body)
    // 临时诊断日志：确认腾讯原始响应经解析后的三市成交额结构。
    console.info('[ValueTicker] Tencent market turnover parsed', result)
    return result
  } finally {
    window.clearTimeout(timeout)
  }
}

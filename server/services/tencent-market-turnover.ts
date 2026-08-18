import type { TencentMarketTurnover } from '~~/shared/types/market-turnover'
import { parseTencentMarketTurnoverBody } from '~~/shared/utils/tencent-market-turnover'
import { ApiResponseError } from '~~/server/utils/api-response'

const ENDPOINT = 'https://qt.gtimg.cn/q=sh000001,sz399001,bj899050'
const TIMEOUT_MS = 7000

/**
 * 服务端定时采集腾讯三市成交额。该请求不参与实时行情轮询，
 * 只供午盘和收盘的低频公共快照任务调用。
 */
export async function fetchServerTencentMarketTurnover(): Promise<TencentMarketTurnover> {
  try {
    const response = await fetch(ENDPOINT, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'accept': 'text/plain,*/*',
        'referer': 'https://gu.qq.com/',
        'user-agent': 'Mozilla/5.0 (compatible; ValueTicker/1.0; market-turnover-snapshot)'
      }
    })
    if (!response.ok) {
      throw new ApiResponseError(502, 'UPSTREAM_UNAVAILABLE', `腾讯成交额接口返回 HTTP ${response.status}`)
    }
    const body = new TextDecoder('gbk').decode(await response.arrayBuffer())
    return parseTencentMarketTurnoverBody(body)
  } catch (error) {
    if (error instanceof ApiResponseError) throw error
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new ApiResponseError(504, 'UPSTREAM_TIMEOUT', '腾讯成交额接口请求超时')
    }
    throw new ApiResponseError(502, 'UPSTREAM_UNAVAILABLE', '腾讯成交额接口暂时不可用')
  }
}

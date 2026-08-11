import { apiFailure, apiSuccess, ApiResponseError } from '~~/server/utils/api-response'
import { requireUserId } from '~~/server/utils/require-user'

const MINUTE_KLINE_TEST_URL = 'https://valueticker-eastmoney-proxy.823867852.workers.dev/appstock/app/minute/query?code=sz000762'

/**
 * 临时分时 K 线连通性测试接口 A。
 *
 * 该接口固定转发 sz000762，只用于验证 Vercel 服务端访问指定 Worker 的可行性；
 * 不得接入行情轮询、提醒判断或作为正式 Provider 代理使用。
 */
export default defineEventHandler(async (event) => {
  try {
    await requireUserId(event)
    const response = await fetch(MINUTE_KLINE_TEST_URL, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Referer': 'https://finance.qq.com/'
      },
      signal: AbortSignal.timeout(10_000) // 建议缩短超时时间，Vercel 免费版函数执行超时限制通常为 10 秒
    })
    if (!response.ok) throw new Error(`上游接口返回 HTTP ${response.status}`)
    const result: unknown = await response.json()

    return apiSuccess(result)
  } catch (error) {
    if (error instanceof ApiResponseError) return apiFailure(event, error)
    console.error('[minute-kline-test:A] upstream request failed', error)
    console.error('[minute-kline-test:A] upstream request failed', error instanceof Error ? error.message : String(error))
    return apiFailure(event, new ApiResponseError(502, 'SECURITY_SEARCH_FAILED', '分时 K 线测试数据源暂不可用'))
  }
})

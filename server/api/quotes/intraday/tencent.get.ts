import type { TencentIntradayResponse } from '~~/shared/types/tencent-intraday'
import { fetchCloudflareMarketJson } from '~~/server/services/cloudflare-market-proxy'
import { apiFailure, apiSuccess, ApiResponseError } from '~~/server/utils/api-response'

/**
 * 腾讯分时行情正式 API：Nuxt 服务端通过 Cloudflare Worker 请求腾讯分钟走势。
 * 本接口只转发并校验原始行情；241 分钟补齐和昨收锚定仍由统一前端适配器完成。
 */
export default defineEventHandler(async (event) => {
  try {
    const symbol = String(getQuery(event).code ?? '').trim().toLowerCase()
    if (!/^(?:sh|sz)\d{6}$/.test(symbol)) {
      return apiFailure(event, new ApiResponseError(422, 'INVALID_PAYLOAD', '腾讯分时证券代码格式无效'))
    }

    const payload = await fetchCloudflareMarketJson<TencentIntradayResponse>(event, '/qq/minute', { code: symbol })
    if (payload.code !== 0 || !payload.data?.[symbol]) {
      throw new ApiResponseError(502, 'UPSTREAM_UNAVAILABLE', '腾讯分时接口未返回有效数据')
    }

    return apiSuccess(payload)
  } catch (error) {
    const responseError = error instanceof ApiResponseError
      ? error
      : new ApiResponseError(502, 'UPSTREAM_UNAVAILABLE', '腾讯分时行情暂时不可用')
    console.error('[tencent-intraday] proxy request failed', responseError.message)
    return apiFailure(event, responseError)
  }
})

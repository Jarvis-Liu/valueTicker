import { fetchEastmoneyFundFlow } from '~~/server/services/eastmoney-fund-flow'
import { fetchTencentFundFlow } from '~~/server/services/tencent-fund-flow'
import { apiFailure, apiSuccess, ApiResponseError } from '~~/server/utils/api-response'

export default defineEventHandler(async (event) => {
  try {
    const stockCode = String(getQuery(event).code ?? '').trim().toLowerCase()
    const provider = String(getQuery(event).provider ?? 'TENCENT').trim().toUpperCase()
    if (!/^(?:sh|sz|bj)\d{6}$/.test(stockCode)) {
      return apiFailure(event, new ApiResponseError(422, 'INVALID_PAYLOAD', '仅支持沪深北股票资金流向'))
    }
    if (provider !== 'TENCENT' && provider !== 'EASTMONEY') {
      return apiFailure(event, new ApiResponseError(422, 'INVALID_PAYLOAD', '不支持的资金数据源'))
    }
    if (stockCode.startsWith('bj') && provider !== 'EASTMONEY') {
      return apiFailure(event, new ApiResponseError(422, 'INVALID_PAYLOAD', '北交所资金流向仅支持东方财富'))
    }

    return apiSuccess(provider === 'EASTMONEY'
      ? await fetchEastmoneyFundFlow(stockCode)
      : await fetchTencentFundFlow(stockCode))
  } catch (error) {
    console.error('[fund-flow] provider request failed', error instanceof Error ? error.message : String(error))
    return apiFailure(event, new ApiResponseError(502, 'SECURITY_SEARCH_FAILED', '资金流向数据源暂不可用'))
  }
})

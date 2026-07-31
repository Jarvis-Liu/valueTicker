import { marketTurnoverTradeDateSchema } from '~~/shared/schemas/market-turnover'
import { getMarketTurnoverDaySnapshots } from '~~/server/services/market-turnover-storage'
import { apiFailure, apiSuccess, ApiResponseError } from '~~/server/utils/api-response'
import { requireUserId } from '~~/server/utils/require-user'

/**
 * 查询指定交易日的午盘/收盘成交额快照。
 * 用途：浏览器取得上一交易日的确定性基准，用于显示今日成交额的涨跌对比。
 */
export default defineEventHandler(async (event) => {
  try {
    // 保持与其余配置接口一致：仅已登录页面可读取或申请写入公共市场快照。
    await requireUserId(event)
    const query = getQuery(event)
    const tradeDate = marketTurnoverTradeDateSchema.parse(query.tradeDate)
    return apiSuccess(await getMarketTurnoverDaySnapshots(tradeDate))
  } catch (error) {
    if (error instanceof ApiResponseError) return apiFailure(event, error)
    if (error && typeof error === 'object' && 'issues' in error) return apiFailure(event, new ApiResponseError(422, 'INVALID_PAYLOAD', '交易日参数不合法', error))
    return apiFailure(event, new ApiResponseError(500, 'STORAGE_WRITE_FAILED', '读取成交额快照失败'))
  }
})

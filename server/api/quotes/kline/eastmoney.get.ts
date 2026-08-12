import { getSharedEastmoneyKline } from '~~/server/services/eastmoney-kline-cache'
import { apiFailure, apiSuccess, ApiResponseError } from '~~/server/utils/api-response'

/**
 * 提供不区分用户的东财 A 股前复权日 K，共享 Redis 缓存并支持旧值降级。
 * @param event 当前 H3 请求；只接受 secid、klt=101 和 fqt=1。
 * @returns 项目统一 ApiResponse 包装的历史 K 线缓存结果。
 */
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const secid = readQueryValue(query.secid)
    const klt = readQueryValue(query.klt) || '101'
    const fqt = readQueryValue(query.fqt) || '1'
    if (!/^[01]\.\d{6}$/.test(secid) || klt !== '101' || fqt !== '1') {
      throw new ApiResponseError(422, 'INVALID_PAYLOAD', '仅支持合法 A 股 secid 的前复权日 K')
    }
    return apiSuccess(await getSharedEastmoneyKline(event, secid))
  } catch (error) {
    const responseError = error instanceof ApiResponseError
      ? error
      : new ApiResponseError(502, 'UPSTREAM_UNAVAILABLE', '东财历史 K 线暂时不可用')
    console.error('[eastmoney-kline] request failed', responseError.message)
    return apiFailure(event, responseError)
  }
})

/**
 * 将 H3 查询参数安全归一为单个去空格字符串。
 * @param value 未知查询参数值。
 * @returns 首个字符串值；无有效字符串时返回空串。
 */
function readQueryValue(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' ? raw.trim() : ''
}

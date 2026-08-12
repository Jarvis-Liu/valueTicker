import type { RecoverEastmoneyKlinePayload } from '~~/shared/types/eastmoney-kline'
import { storeRecoveredEastmoneyKline } from '~~/server/services/eastmoney-kline-cache'
import { apiFailure, apiSuccess, ApiResponseError } from '~~/server/utils/api-response'
import { requireUserId } from '~~/server/utils/require-user'

/**
 * 接收已登录浏览器从固定东财地址恢复的数据，严格校验后更新全局共享 Redis 缓存。
 * @param event 当前 H3 请求，身份仅用于限制写入口，不进入共享缓存键。
 * @returns 项目统一 ApiResponse 包装的缓存写入结果。
 */
export default defineEventHandler(async (event) => {
  try {
    await requireUserId(event)
    const body = await readBody<RecoverEastmoneyKlinePayload>(event)
    const secid = typeof body?.secid === 'string' ? body.secid.trim() : ''
    if (!/^[01]\.\d{6}$/.test(secid) || !body?.payload || typeof body.payload !== 'object') {
      throw new ApiResponseError(422, 'INVALID_PAYLOAD', '浏览器恢复的历史 K 线请求无效')
    }
    return apiSuccess(await storeRecoveredEastmoneyKline(secid, body.payload))
  } catch (error) {
    const responseError = error instanceof ApiResponseError
      ? error
      : new ApiResponseError(502, 'STORAGE_WRITE_FAILED', '历史 K 线恢复数据保存失败')
    console.error('[eastmoney-kline-recover] request failed', responseError.message)
    return apiFailure(event, responseError)
  }
})

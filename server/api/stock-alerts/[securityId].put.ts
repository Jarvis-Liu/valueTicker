import { updateStockAlertsPayloadSchema } from '~~/shared/schemas/stock-config'
import { updateStockAlerts } from '~~/server/services/user-stock-storage'
import { apiFailure, apiSuccess, ApiResponseError, parseIfMatch } from '~~/server/utils/api-response'
import { requireUserId } from '~~/server/utils/require-user'

export default defineEventHandler(async (event) => {
  try {
    const userId = requireUserId()
    const securityId = decodeURIComponent(String(event.context.params?.securityId ?? ''))
    const payload = updateStockAlertsPayloadSchema.parse(await readBody(event))
    const result = await updateStockAlerts(userId, securityId, payload, parseIfMatch(event))

    return apiSuccess(result, result.config.configVersion)
  } catch (error) {
    if (error instanceof ApiResponseError) return apiFailure(event, error)
    if (error && typeof error === 'object' && 'issues' in error) return apiFailure(event, new ApiResponseError(422, 'INVALID_PAYLOAD', '提醒配置参数不合法', error))

    return apiFailure(event, new ApiResponseError(500, 'STORAGE_WRITE_FAILED', '保存提醒配置失败'))
  }
})

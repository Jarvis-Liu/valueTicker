import { deleteStockGroupMember } from '~~/server/services/user-stock-storage'
import { apiFailure, apiSuccess, ApiResponseError, parseIfMatch } from '~~/server/utils/api-response'
import { requireUserId } from '~~/server/utils/require-user'

export default defineEventHandler(async (event) => {
  try {
    const userId = requireUserId()
    const groupId = String(event.context.params?.groupId ?? '')
    const securityId = decodeURIComponent(String(event.context.params?.securityId ?? ''))
    const result = await deleteStockGroupMember(userId, groupId, securityId, parseIfMatch(event))
    return apiSuccess(result, result.config.configVersion)
  } catch (error) {
    if (error instanceof ApiResponseError) return apiFailure(event, error)
    return apiFailure(event, new ApiResponseError(500, 'STORAGE_WRITE_FAILED', '移除证券失败'))
  }
})

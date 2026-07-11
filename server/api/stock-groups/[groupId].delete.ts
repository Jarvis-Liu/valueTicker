import { deleteStockGroup } from '~~/server/services/user-stock-storage'
import { apiFailure, apiSuccess, ApiResponseError, parseIfMatch } from '~~/server/utils/api-response'
import { requireUserId } from '~~/server/utils/require-user'

export default defineEventHandler(async (event) => {
  try {
    const groupId = getRouterParam(event, 'groupId')

    if (!groupId) {
      throw new ApiResponseError(422, 'INVALID_PAYLOAD', '缺少分组 ID')
    }

    const userId = requireUserId()
    const expectedVersion = parseIfMatch(event)
    const result = await deleteStockGroup(userId, groupId, expectedVersion)

    return apiSuccess(result, result.config.configVersion)
  } catch (error) {
    if (error instanceof ApiResponseError) {
      return apiFailure(event, error)
    }

    return apiFailure(event, new ApiResponseError(500, 'STORAGE_WRITE_FAILED', '删除分组失败'))
  }
})

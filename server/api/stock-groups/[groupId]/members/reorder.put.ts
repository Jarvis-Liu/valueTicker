import { reorderStockGroupMembersPayloadSchema } from '~~/shared/schemas/stock-config'
import { reorderStockGroupMembers } from '~~/server/services/user-stock-storage'
import { apiFailure, apiSuccess, ApiResponseError, parseIfMatch } from '~~/server/utils/api-response'
import { requireUserId } from '~~/server/utils/require-user'

export default defineEventHandler(async (event) => {
  try {
    const groupId = getRouterParam(event, 'groupId')
    if (!groupId) throw new ApiResponseError(422, 'INVALID_PAYLOAD', '缺少分组 ID')

    const userId = await requireUserId(event)
    const expectedVersion = parseIfMatch(event)
    const payload = reorderStockGroupMembersPayloadSchema.parse(await readBody(event))
    const result = await reorderStockGroupMembers(userId, groupId, payload, expectedVersion)
    return apiSuccess(result, result.config.configVersion)
  } catch (error) {
    if (error instanceof ApiResponseError) return apiFailure(event, error)
    if (error && typeof error === 'object' && 'issues' in error) {
      return apiFailure(event, new ApiResponseError(422, 'INVALID_PAYLOAD', '请求参数不合法', error))
    }
    return apiFailure(event, new ApiResponseError(500, 'STORAGE_WRITE_FAILED', '调整证券顺序失败'))
  }
})

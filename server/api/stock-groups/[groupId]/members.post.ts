import { addStockMemberPayloadSchema } from '~~/shared/schemas/stock-config'
import { addStockGroupMember } from '~~/server/services/user-stock-storage'
import { apiFailure, apiSuccess, ApiResponseError, parseIfMatch } from '~~/server/utils/api-response'
import { requireUserId } from '~~/server/utils/require-user'

export default defineEventHandler(async (event) => {
  try {
    const userId = requireUserId()
    const groupId = String(event.context.params?.groupId ?? '')
    const result = await addStockGroupMember(userId, groupId, addStockMemberPayloadSchema.parse(await readBody(event)), parseIfMatch(event))
    return apiSuccess(result, result.config.configVersion)
  } catch (error) {
    if (error instanceof ApiResponseError) return apiFailure(event, error)
    if (error && typeof error === 'object' && 'issues' in error) {
      return apiFailure(event, new ApiResponseError(422, 'INVALID_PAYLOAD', '证券参数不合法', error))
    }
    return apiFailure(event, new ApiResponseError(500, 'STORAGE_WRITE_FAILED', '添加证券失败'))
  }
})

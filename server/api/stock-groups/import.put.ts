import { stockGroupsExportFileSchema } from '~~/shared/schemas/stock-config'
import { replaceStockGroups } from '~~/server/services/user-stock-storage'
import { apiFailure, apiSuccess, ApiResponseError, parseIfMatch } from '~~/server/utils/api-response'
import { requireUserId } from '~~/server/utils/require-user'

export default defineEventHandler(async (event) => {
  try {
    const userId = requireUserId()
    const expectedVersion = parseIfMatch(event)
    const payload = stockGroupsExportFileSchema.parse(await readBody(event))
    const result = await replaceStockGroups(userId, payload, expectedVersion)
    return apiSuccess(result, result.config.configVersion)
  } catch (error) {
    if (error instanceof ApiResponseError) return apiFailure(event, error)
    if (error && typeof error === 'object' && 'issues' in error) {
      return apiFailure(event, new ApiResponseError(422, 'INVALID_PAYLOAD', '导入文件格式不合法', error))
    }
    return apiFailure(event, new ApiResponseError(500, 'STORAGE_WRITE_FAILED', '导入分组失败'))
  }
})

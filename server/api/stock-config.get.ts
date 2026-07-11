import { apiFailure, apiSuccess, ApiResponseError } from '~~/server/utils/api-response'
import { requireUserId } from '~~/server/utils/require-user'
import { getUserStockConfig } from '~~/server/services/user-stock-storage'

export default defineEventHandler(async (event) => {
  try {
    const userId = requireUserId()
    const config = await getUserStockConfig(userId)

    return apiSuccess(config, config.configVersion)
  } catch (error) {
    if (error instanceof ApiResponseError) {
      return apiFailure(event, error)
    }

    return apiFailure(event, new ApiResponseError(500, 'STORAGE_WRITE_FAILED', '读取用户配置失败'))
  }
})

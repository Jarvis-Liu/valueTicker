import { getQuery } from 'h3'
import { searchSecurities } from '~~/server/services/security-search'
import { apiFailure, apiSuccess, ApiResponseError } from '~~/server/utils/api-response'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const keyword = String(query.q ?? '').trim()
    if (!keyword) {
      throw new ApiResponseError(422, 'INVALID_PAYLOAD', '请输入证券名称或代码')
    }

    return apiSuccess({ items: await searchSecurities(keyword) })
  } catch (error) {
    if (error instanceof ApiResponseError) return apiFailure(event, error)
    return apiFailure(event, new ApiResponseError(500, 'SECURITY_SEARCH_FAILED', '证券搜索失败'))
  }
})

import type { ApiResponse } from '~~/shared/types/api'
import type { FundFlowProvider, FundFlowSnapshot } from '~~/shared/types/fund-flow'

const cache = new Map<string, { value: FundFlowSnapshot, cachedAt: number }>()
const CACHE_TTL_MS = 30_000

/** 按证券路由指定的 Provider 获取资金流向；缓存键包含 Provider，避免跨源串用数据。 */
export async function fetchFundFlow(stockCode: string, provider: FundFlowProvider, force = false) {
  const cacheKey = `${provider}:${stockCode}`
  const cached = cache.get(cacheKey)
  if (!force && cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached.value

  const response = await $fetch<ApiResponse<FundFlowSnapshot>>('/api/securities/fund-flow', {
    query: { code: stockCode, provider },
    ignoreResponseError: true
  })
  if (!response.success || !response.data) throw new Error(response.error?.message ?? '资金流向请求失败')

  cache.set(cacheKey, { value: response.data, cachedAt: Date.now() })
  return response.data
}

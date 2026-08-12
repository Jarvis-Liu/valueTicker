import type { ApiResponse } from '~~/shared/types/api'
import type { EastmoneyKlineApiResult } from '~~/shared/types/eastmoney-kline'

/**
 * 从 Nuxt 正式共享缓存 API 获取指定 A 股的东财前复权日 K。
 * @param secid 东财市场标识与六位证券代码，例如 `0.301217`。
 * @returns 后端原始有效期和缓存状态，不在浏览器端重新延长过期时间。
 */
export async function fetchEastmoneyKlineResult(secid: string): Promise<EastmoneyKlineApiResult> {
  const response = await $fetch<ApiResponse<EastmoneyKlineApiResult>>('/api/quotes/kline/eastmoney', {
    query: { secid, klt: '101', fqt: '1' }
  })
  if (!response.success || !response.data) throw new Error(response.error?.message ?? '历史 K 线加载失败')
  return response.data
}

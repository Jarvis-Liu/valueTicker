import type { ApiError, ApiResponse } from '~~/shared/types/api'
import type { ExchangeTurnoverAmounts, MarketTurnoverDaySnapshots, MarketTurnoverUpdateResult } from '~~/shared/types/market-turnover'

/** 读取一个交易日的已保存成交额快照，用于取得昨日同一时段的比较基准。 */
export async function fetchMarketTurnoverSnapshots(tradeDate: string) {
  return requestMarketTurnoverApi<MarketTurnoverDaySnapshots>(`/api/market-turnover/snapshots?tradeDate=${encodeURIComponent(tradeDate)}`)
}

/**
 * 将浏览器直连腾讯取得的三家交易所成交额交给服务端申请入库。
 * 服务端自行判断时间窗口和封存状态，本函数不传递交易日、时段或客户端时钟。
 */
export async function requestMarketTurnoverSnapshotUpdate(exchanges: ExchangeTurnoverAmounts, sourceUpdatedAt: string | null) {
  return requestMarketTurnoverApi<MarketTurnoverUpdateResult>('/api/market-turnover/snapshots', {
    method: 'PUT',
    body: { exchanges, sourceUpdatedAt }
  })
}

async function requestMarketTurnoverApi<T>(url: string, options?: Parameters<typeof $fetch<ApiResponse<T>>>[1]) {
  const response = await $fetch<ApiResponse<T>>(url, { ...options, ignoreResponseError: true })
  if (!response.success || !response.data) {
    const error: ApiError = response.error ?? { code: 'STORAGE_WRITE_FAILED', message: '成交额快照请求失败' }
    throw new Error(error.message)
  }
  return response.data
}

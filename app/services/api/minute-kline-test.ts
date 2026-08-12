import type { ApiResponse } from '~~/shared/types/api'

const TEST_API_TIMEOUT_MS = 30_000

export interface MinuteKlineTestRouteResult {
  success: boolean
  requestUrl: string
  data?: unknown
  error?: string
}

export interface MinuteKlineTestAResult {
  eastmoney: MinuteKlineTestRouteResult
  tencent: MinuteKlineTestRouteResult
}

/** 调用临时测试接口 A；返回值只用于控制台检查，不进入任何行情状态。 */
export async function fetchMinuteKlineTestA() {
  const response = await $fetch<ApiResponse<MinuteKlineTestAResult>>('/api/test/minute-kline-a', {
    ignoreResponseError: true,
    timeout: TEST_API_TIMEOUT_MS
  })

  if (!response.success || response.data === undefined) {
    throw new Error(response.error?.message ?? '分时 K 线测试请求失败')
  }

  return response.data
}

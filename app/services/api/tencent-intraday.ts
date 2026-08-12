import type { ApiResponse } from '~~/shared/types/api'
import type { TencentIntradayResponse } from '~~/shared/types/tencent-intraday'

const PROXY_TIMEOUT_MS = 10_000

export class TencentIntradayProxyError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    public readonly fallbackEligible: boolean
  ) {
    super(message)
  }
}

/** 调用腾讯分时正式 API；趋势适配器可在代理暂时不可用时决定是否直连兜底。 */
export async function fetchTencentIntradayFromProxy(symbol: string): Promise<TencentIntradayResponse> {
  let response: Response
  try {
    const url = new URL('/api/quotes/intraday/tencent', globalThis.location?.origin ?? 'http://localhost')
    url.searchParams.set('code', symbol)
    response = await fetch(url.pathname + url.search, { signal: AbortSignal.timeout(PROXY_TIMEOUT_MS) })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw new TencentIntradayProxyError('腾讯分时代理网络请求失败', null, true)
  }

  let body: ApiResponse<TencentIntradayResponse>
  try {
    body = await response.json() as ApiResponse<TencentIntradayResponse>
  } catch {
    throw new TencentIntradayProxyError('腾讯分时代理返回格式无效', response.status, response.status >= 500)
  }

  if (!response.ok || !body.success || !body.data) {
    const fallbackEligible = response.status === 502 || response.status === 503 || response.status === 504
    throw new TencentIntradayProxyError(body.error?.message ?? `腾讯分时代理返回 HTTP ${response.status}`, response.status, fallbackEligible)
  }

  return body.data
}

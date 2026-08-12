import type { H3Event } from 'h3'
import { ApiResponseError } from '~~/server/utils/api-response'

const WORKER_TIMEOUT_MS = 8_000

/**
 * 通过服务端私有 CLOUDFLARE_WORKER_URL 请求行情代理。
 * Worker 地址不会暴露给浏览器；该方法只允许调用项目预定义的 Worker 路由。
 */
export async function fetchCloudflareMarketJson<T>(
  event: H3Event,
  pathname: '/qq/minute' | '/eastmoney/kline',
  params: Record<string, string>
): Promise<T> {
  const url = createCloudflareMarketUrl(event, pathname, params)

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(WORKER_TIMEOUT_MS),
      headers: { accept: 'application/json' }
    })
    const body = await response.text()

    if (!response.ok) {
      throw new ApiResponseError(502, 'UPSTREAM_UNAVAILABLE', `行情代理返回 HTTP ${response.status}`)
    }

    try {
      return JSON.parse(body) as T
    } catch {
      throw new ApiResponseError(502, 'UPSTREAM_UNAVAILABLE', '行情代理未返回有效 JSON')
    }
  } catch (error) {
    if (error instanceof ApiResponseError) throw error
    if (isTimeoutError(error)) {
      throw new ApiResponseError(504, 'UPSTREAM_TIMEOUT', '行情代理请求超时')
    }
    throw new ApiResponseError(502, 'UPSTREAM_UNAVAILABLE', '行情代理暂时不可用')
  }
}

function createCloudflareMarketUrl(
  event: H3Event,
  pathname: '/qq/minute' | '/eastmoney/kline',
  params: Record<string, string>
) {
  const configuredUrl = String(useRuntimeConfig(event).cloudflareWorkerUrl ?? '').trim()
  if (!configuredUrl) {
    throw new ApiResponseError(500, 'UPSTREAM_UNAVAILABLE', 'CLOUDFLARE_WORKER_URL 未配置')
  }

  try {
    const baseUrl = new URL(configuredUrl)
    if (baseUrl.protocol !== 'https:' && baseUrl.protocol !== 'http:') throw new Error('Unsupported protocol')
    const normalizedBase = `${baseUrl.origin}${baseUrl.pathname.replace(/\/+$/, '')}`
    const url = new URL(`${normalizedBase}${pathname}`)
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value)
    return url
  } catch (error) {
    if (error instanceof ApiResponseError) throw error
    throw new ApiResponseError(500, 'UPSTREAM_UNAVAILABLE', 'CLOUDFLARE_WORKER_URL 配置无效')
  }
}

function isTimeoutError(error: unknown) {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
}

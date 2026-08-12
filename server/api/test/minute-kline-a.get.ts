import type { H3Event } from 'h3'
import { apiFailure, apiSuccess, ApiResponseError } from '~~/server/utils/api-response'
import { requireUserId } from '~~/server/utils/require-user'

const UPSTREAM_TIMEOUT_MS = 10_000
const EASTMONEY_KLINE_PARAMS = {
  fields1: 'f1,f2,f3,f4,f5,f6',
  fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f116',
  ut: '7eea3edcaed734bea9cbfc24409ed989',
  klt: '101',
  fqt: '1',
  secid: '1.688126',
  beg: '20250207',
  end: '20500101'
} as const

interface TestRouteResult {
  success: boolean
  requestUrl: string
  data?: unknown
  error?: string
}

/**
 * 临时测试接口 A：通过 CLOUDFLARE_WORKER_URL 验证东财日 K 与腾讯分时代理路由。
 * 两路请求只返回原始结构供控制台检查，不得接入轮询、提醒判断或正式行情状态。
 */
export default defineEventHandler(async (event) => {
  try {
    await requireUserId(event)
    const workerBaseUrl = getWorkerBaseUrl(event)
    const eastmoneyUrl = createWorkerUrl(workerBaseUrl, '/eastmoney/kline', EASTMONEY_KLINE_PARAMS)
    const tencentUrl = createWorkerUrl(workerBaseUrl, '/qq/minute', { code: 'sz001309' })

    const [eastmoney, tencent] = await Promise.all([
      requestTestRoute(eastmoneyUrl),
      requestTestRoute(tencentUrl)
    ])

    return apiSuccess({ eastmoney, tencent })
  } catch (error) {
    if (error instanceof ApiResponseError) return apiFailure(event, error)

    console.error('[minute-kline-test:A] request failed', error instanceof Error ? error.message : String(error))
    return apiFailure(event, new ApiResponseError(502, 'SECURITY_SEARCH_FAILED', 'Cloudflare Worker 测试请求失败'))
  }
})

function getWorkerBaseUrl(event: H3Event) {
  const configuredUrl = String(useRuntimeConfig(event).cloudflareWorkerUrl ?? '').trim()
  if (!configuredUrl) {
    throw new ApiResponseError(500, 'STORAGE_WRITE_FAILED', 'CLOUDFLARE_WORKER_URL 未配置')
  }

  try {
    const url = new URL(configuredUrl)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Unsupported protocol')
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
  } catch {
    throw new ApiResponseError(500, 'STORAGE_WRITE_FAILED', 'CLOUDFLARE_WORKER_URL 配置无效')
  }
}

function createWorkerUrl(baseUrl: string, pathname: string, params: Record<string, string>) {
  const url = new URL(`${baseUrl}${pathname}`)
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value)
  return url
}

async function requestTestRoute(url: URL): Promise<TestRouteResult> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) })
    const body = await response.text()
    if (!response.ok) {
      return {
        success: false,
        requestUrl: url.toString(),
        error: `HTTP ${response.status}: ${body.slice(0, 200)}`
      }
    }

    try {
      return { success: true, requestUrl: url.toString(), data: JSON.parse(body) }
    } catch {
      return { success: false, requestUrl: url.toString(), error: 'Worker 未返回有效 JSON' }
    }
  } catch (error) {
    return {
      success: false,
      requestUrl: url.toString(),
      error: error instanceof Error ? error.message : '请求失败'
    }
  }
}

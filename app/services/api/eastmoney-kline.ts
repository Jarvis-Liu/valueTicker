import type { ApiResponse } from '~~/shared/types/api'
import type { EastmoneyKlineApiResult, EastmoneyKlineResponse } from '~~/shared/types/eastmoney-kline'

const EASTMONEY_KLINE_ENDPOINT = 'https://push2his.eastmoney.com/api/qt/stock/kline/get'
const REQUEST_TIMEOUT_MS = 10_000
const DIRECT_BEGIN_LOOKBACK_DAYS = 360

/**
 * 优先从 Nuxt 共享缓存 API 获取东财日 K；服务端失败或返回 STALE 时浏览器直连并回传校验入库。
 * @param secid 东财市场标识与六位证券代码，例如 `0.301217`。
 * @returns 后端统一的缓存结果；STALE 恢复失败时保留旧值，服务端无旧值且恢复失败时抛错。
 */
export async function fetchEastmoneyKlineResult(secid: string): Promise<EastmoneyKlineApiResult> {
  let serverResult: EastmoneyKlineApiResult
  try {
    const response = await $fetch<ApiResponse<EastmoneyKlineApiResult>>('/api/quotes/kline/eastmoney', {
      query: { secid, klt: '101', fqt: '1' },
      timeout: REQUEST_TIMEOUT_MS
    })
    if (response.success && response.data) serverResult = response.data
    else throw new Error(response.error?.message ?? '历史 K 线服务端请求失败')
  } catch (serverError) {
    console.warn('[ValueTicker][历史 K 线服务端降级]', secid, getErrorMessage(serverError))
    return recoverEastmoneyKlineFromBrowser(secid)
  }

  if (!serverResult.stale && serverResult.cacheStatus !== 'STALE') return serverResult

  console.warn('[ValueTicker][历史 K 线旧值恢复]', secid, serverResult.warning ?? '共享缓存已过业务有效期，尝试浏览器直连更新')
  try {
    return await recoverEastmoneyKlineFromBrowser(secid)
  } catch (recoveryError) {
    console.warn('[ValueTicker][历史 K 线直连恢复失败]', secid, getErrorMessage(recoveryError))
    return serverResult
  }
}

/**
 * 浏览器使用固定字段和口径直连东财，并将有效原始响应交由服务端复验后写入 Redis。
 * @param secid 已由筹码模块生成的东财证券标识。
 * @returns 服务端校验并保存后的标准缓存结果。
 */
async function recoverEastmoneyKlineFromBrowser(secid: string): Promise<EastmoneyKlineApiResult> {
  const url = createDirectEastmoneyUrl(secid)
  const payload = await $fetch<EastmoneyKlineResponse>(url.toString(), {
    timeout: REQUEST_TIMEOUT_MS
  })
  if (payload.rc !== 0 || payload.data?.code !== secid.split('.')[1] || !Array.isArray(payload.data?.klines) || !payload.data.klines.length) {
    throw new Error('浏览器直连东财未返回有效历史 K 线')
  }

  const response = await $fetch<ApiResponse<EastmoneyKlineApiResult>>('/api/quotes/kline/eastmoney-recover', {
    method: 'POST',
    body: { secid, payload },
    timeout: REQUEST_TIMEOUT_MS
  })
  if (!response.success || !response.data) throw new Error(response.error?.message ?? '历史 K 线恢复数据保存失败')
  return response.data
}

/**
 * 使用固定字段、日线和前复权口径构造浏览器东财直连 URL。
 * @param secid 东财证券标识。
 * @param now 用于生成约 360 天前起始日期的当前时间。
 * @returns 不允许调用方覆盖上游地址、字段或复权口径的 URL。
 */
export function createDirectEastmoneyUrl(secid: string, now = new Date()) {
  if (!/^[01]\.\d{6}$/.test(secid)) throw new Error('东财证券代码格式无效')
  const begin = new Date(now)
  begin.setUTCDate(begin.getUTCDate() - DIRECT_BEGIN_LOOKBACK_DAYS)
  const url = new URL(EASTMONEY_KLINE_ENDPOINT)
  url.searchParams.set('fields1', 'f1,f2,f3,f4,f5,f6')
  url.searchParams.set('fields2', 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f116')
  url.searchParams.set('ut', '7eea3edcaed734bea9cbfc24409ed989')
  url.searchParams.set('klt', '101')
  url.searchParams.set('fqt', '1')
  url.searchParams.set('secid', secid)
  url.searchParams.set('beg', begin.toISOString().slice(0, 10).replaceAll('-', ''))
  url.searchParams.set('end', '20500101')
  return url
}

/**
 * 将未知网络异常转换为非敏感的控制台提示文本。
 * @param error 捕获到的未知异常。
 * @returns Error 消息或通用失败文本。
 */
function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '历史 K 线服务端请求失败'
}

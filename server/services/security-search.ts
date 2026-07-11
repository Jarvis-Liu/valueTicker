import { TextDecoder } from 'node:util'
import type { SecurityBoard, SecurityItem } from '~~/shared/types/stock'
import { ApiResponseError } from '~~/server/utils/api-response'

const TENCENT_SEARCH_ENDPOINT = 'https://smartbox.gtimg.cn/s3/'
const BAIDU_SEARCH_ENDPOINT = 'https://finance.pae.baidu.com/vapi/v1/sug'
const SEARCH_TIMEOUT_MS = 3000

/** 按腾讯优先、百度兜底的顺序搜索证券。 */
export async function searchSecurities(keyword: string): Promise<SecurityItem[]> {
  let tencentError: unknown

  try {
    const tencentResults = await searchTencentSecurities(keyword)
    if (tencentResults.length > 0) return tencentResults
  } catch (error) {
    tencentError = error
  }

  try {
    return await searchBaiduSecurities(keyword)
  } catch (baiduError) {
    if (baiduError instanceof ApiResponseError) throw baiduError
    if (tencentError instanceof ApiResponseError) throw tencentError
    throw new ApiResponseError(502, 'SECURITY_SEARCH_FAILED', '证券搜索接口暂时不可用')
  }
}

/** 使用腾讯 Smartbox 查询证券，解析失败或请求异常时抛出统一 API 错误。 */
export async function searchTencentSecurities(keyword: string): Promise<SecurityItem[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS)

  try {
    const url = new URL(TENCENT_SEARCH_ENDPOINT)
    url.searchParams.set('q', keyword.trim())
    url.searchParams.set('t', 'all')

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'text/plain, */*' }
    })
    if (!response.ok) {
      throw new ApiResponseError(502, 'SECURITY_SEARCH_FAILED', `腾讯证券搜索源返回 HTTP ${response.status}`)
    }

    const body = new TextDecoder('gbk').decode(await response.arrayBuffer())
    return parseTencentSuggestions(body)
  } catch (error) {
    if (error instanceof ApiResponseError) throw error
    throw new ApiResponseError(502, 'SECURITY_SEARCH_FAILED', '腾讯证券搜索接口暂时不可用')
  } finally {
    clearTimeout(timeout)
  }
}

/** 使用百度财经建议接口查询证券，主要用于补充北交所证券。 */
export async function searchBaiduSecurities(keyword: string): Promise<SecurityItem[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS)

  try {
    const url = new URL(BAIDU_SEARCH_ENDPOINT)
    url.searchParams.set('wd', keyword.trim())
    url.searchParams.set('finClientType', 'pc')

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    })
    if (!response.ok) {
      throw new ApiResponseError(502, 'SECURITY_SEARCH_FAILED', `百度证券搜索源返回 HTTP ${response.status}`)
    }

    const payload = await response.json() as BaiduSearchResponse
    return (payload.Result?.list ?? [])
      .map(convertBaiduResultToSecurityItem)
      .filter((item): item is SecurityItem => item !== null)
  } catch (error) {
    if (error instanceof ApiResponseError) throw error
    throw new ApiResponseError(502, 'SECURITY_SEARCH_FAILED', '百度证券搜索接口暂时不可用')
  } finally {
    clearTimeout(timeout)
  }
}

/** 解析腾讯 v_hint 文本，转换为统一证券列表。 */
function parseTencentSuggestions(body: string) {
  const line = body.split(/\r?\n/).find(item => item.startsWith('v_hint'))
  if (!line) return []

  const rawValue = line.slice(line.indexOf('=') + 1).trim().replace(/;$/, '')
  const value = rawValue.startsWith('"') ? JSON.parse(rawValue) as string : rawValue
  if (!value || value.startsWith('N')) return []

  return value
    .split('^')
    .map(item => item.split('~'))
    .map(convertTencentHintToSecurityItem)
    .filter((item): item is SecurityItem => item !== null)
}

/** 将腾讯返回的字段数组转换为 SecurityItem。 */
export function convertTencentHintToSecurityItem(fields: string[]): SecurityItem | null {
  const rawExchange = fields[0]?.toLowerCase()
  const rawSymbol = fields[1] ?? ''
  const name = fields[2]?.trim()
  const type = fields[4] ?? ''
  const exchange = rawExchange === 'sh' ? 'SSE' : rawExchange === 'sz' ? 'SZSE' : rawExchange === 'bj' ? 'BSE' : null
  const code = rawSymbol.includes('.') ? rawSymbol.split('.').at(-1) : rawSymbol

  if (!exchange || !code || !/^\d{6}$/.test(code) || !name) return null
  if (!['GP', 'GP-A', 'GP-A-KCB', 'ETF', 'LOF', 'QDII-LOF'].includes(type)) return null

  const securityType = type === 'ETF' || type === 'LOF' || type === 'QDII-LOF' ? 'ETF' : 'STOCK'
  const board = getBoard(code, securityType, exchange)
  const boardLabel = board === 'GEM' ? '创' : board === 'STAR' ? '科' : board === 'BSE' ? '北' : ''

  return {
    securityId: `${exchange}:${code}`,
    exchange,
    code,
    name,
    securityType,
    board,
    boardLabel,
    pricePrecision: securityType === 'ETF' ? 3 : 2,
    providerSymbols: { tencent: `${rawExchange}${code}` }
  }
}

/** 将百度财经搜索结果转换为 SecurityItem。 */
export function convertBaiduResultToSecurityItem(item: BaiduSearchItem): SecurityItem | null {
  const exchange = item.exchange === 'SH' ? 'SSE' : item.exchange === 'SZ' ? 'SZSE' : item.exchange === 'BJ' ? 'BSE' : null
  const code = item.code?.trim()
  const name = item.name?.trim()
  if (!exchange || !code || !/^\d{6}$/.test(code) || !name) return null

  const securityType = item.type === 'stock' ? 'STOCK' : item.type === 'fund' ? 'ETF' : 'UNKNOWN'
  if (securityType === 'UNKNOWN') return null

  const board = getBoard(code, securityType, exchange)
  const boardLabel = board === 'GEM' ? '创' : board === 'STAR' ? '科' : board === 'BSE' ? '北' : ''
  const tencentPrefix = exchange === 'SSE' ? 'sh' : exchange === 'SZSE' ? 'sz' : undefined

  return {
    securityId: `${exchange}:${code}`,
    exchange,
    code,
    name,
    securityType,
    board,
    boardLabel,
    pricePrecision: securityType === 'ETF' ? 3 : 2,
    providerSymbols: tencentPrefix ? { tencent: `${tencentPrefix}${code}` } : {}
  }
}

interface BaiduSearchResponse {
  Result?: {
    list?: BaiduSearchItem[]
  }
}

export interface BaiduSearchItem {
  code?: string
  name?: string
  exchange?: string
  type?: string
}

/** 根据证券代码和交易所推断板块及展示标签。 */
function getBoard(code: string, securityType: SecurityItem['securityType'], exchange?: SecurityItem['exchange']): SecurityBoard {
  if (securityType === 'ETF') return 'ETF'
  if (exchange === 'BSE') return 'BSE'
  if (/^(300|301)/.test(code)) return 'GEM'
  if (code.startsWith('688')) return 'STAR'
  if (/^[48]/.test(code)) return 'BSE'
  return 'MAIN'
}

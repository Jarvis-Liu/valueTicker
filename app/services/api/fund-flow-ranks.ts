import type { FundFlowRankEntry, FundFlowRankSnapshot } from '~~/shared/types/fund-flow'

const EASTMONEY_RANK_ENDPOINT = 'https://push2.eastmoney.com/api/qt/clist/get'
const EASTMONEY_UT = 'b2884a393a59ad64002292a3e90d46a5'
const MARKET_FILTER = 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048'
const RANK_FIELDS = 'f12,f14,f2,f3,f62,f184,f66,f72'
const TOP_LIMIT = 500
const TIMEOUT_MS = 10_000

/**
 * 浏览器直连东财 Top 500，并只保留当前自选股票。
 * 普通 fetch 被 CORS 拦截时自动改用 JSONP，两个请求都会直接显示在浏览器 Network 中。
 */
export async function fetchFundFlowRanks(codes: string[]): Promise<FundFlowRankSnapshot> {
  const requestedCodes = new Set(codes.filter(code => /^\d{6}$/.test(code)))
  if (!requestedCodes.size) return { total: 0, updatedAt: '', entries: [] }

  const url = createRankUrl()
  let payload: EastmoneyRankResponse
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!response.ok) throw new Error(`东财资金排名接口返回 HTTP ${response.status}`)
    payload = await response.json() as EastmoneyRankResponse
  } catch {
    payload = await fetchRankByJsonp(url)
  }

  if (payload.rc !== 0 || !payload.data || !Array.isArray(payload.data.diff)) {
    throw new Error('东财资金排名接口未返回有效数据')
  }

  return {
    total: Number(payload.data.total) || payload.data.diff.length,
    updatedAt: new Date().toISOString(),
    entries: createFundFlowRankEntries(payload.data.diff).filter(entry => requestedCodes.has(entry.code))
  }
}

/** 按东财返回顺序生成 Top 500 名次，重复或非法证券代码不会造成名次空洞。 */
export function createFundFlowRankEntries(rows: EastmoneyRankRow[]): FundFlowRankEntry[] {
  const seenCodes = new Set<string>()
  const entries: FundFlowRankEntry[] = []
  for (const row of rows.slice(0, TOP_LIMIT)) {
    const code = String(row.f12 ?? '').trim()
    if (!/^\d{6}$/.test(code) || seenCodes.has(code)) continue
    seenCodes.add(code)
    entries.push({
      code,
      name: String(row.f14 ?? ''),
      rank: entries.length + 1,
      mainNetInflow: nullableNumber(row.f62),
      mainNetInflowPercent: nullableNumber(row.f184)
    })
  }
  return entries
}

function createRankUrl() {
  const query = new URLSearchParams({
    pn: '1',
    pz: String(TOP_LIMIT),
    po: '1',
    np: '1',
    ut: EASTMONEY_UT,
    fltt: '2',
    invt: '2',
    fid: 'f62',
    fs: MARKET_FILTER,
    fields: RANK_FIELDS
  })
  return `${EASTMONEY_RANK_ENDPOINT}?${query}`
}

/** 使用 script 标签跨域取得东财 JSONP，避免公开行情接口未返回 CORS 头时请求失败。 */
function fetchRankByJsonp(url: string): Promise<EastmoneyRankResponse> {
  return new Promise((resolve, reject) => {
    const callbackName = `__valueTickerFundRank${Date.now()}${Math.random().toString(36).slice(2)}`
    const callbackHost = window as unknown as Record<string, unknown>
    const script = document.createElement('script')
    const timer = window.setTimeout(() => finish(() => reject(new Error('东财资金排名请求超时'))), TIMEOUT_MS)

    function finish(action: () => void) {
      window.clearTimeout(timer)
      script.remove()
      Reflect.deleteProperty(callbackHost, callbackName)
      action()
    }

    callbackHost[callbackName] = (payload: EastmoneyRankResponse) => finish(() => resolve(payload))
    script.onerror = () => finish(() => reject(new Error('东财资金排名 JSONP 请求失败')))
    const requestUrl = new URL(url)
    requestUrl.searchParams.set('cb', callbackName)
    script.src = requestUrl.toString()
    document.head.appendChild(script)
  })
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '' || value === '-') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

interface EastmoneyRankResponse {
  rc: number
  data?: {
    total?: number
    diff?: EastmoneyRankRow[]
  }
}

interface EastmoneyRankRow {
  f12?: unknown
  f14?: unknown
  f62?: unknown
  f184?: unknown
}

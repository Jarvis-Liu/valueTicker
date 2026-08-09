import type { FundFlowSnapshot, IntradayFundFlowPoint, TodayFundFlowSummary } from '~~/shared/types/fund-flow'

const ENDPOINT = 'https://push2.eastmoney.com/api/qt/stock/fflow/kline/get'
const TIMEOUT_MS = 7000

/** 获取东财单只沪深北股票的分钟累计资金流向，并转换为通用资金流结构。 */
export async function fetchEastmoneyFundFlow(stockCode: string): Promise<FundFlowSnapshot> {
  const secid = toEastmoneySecid(stockCode)
  const url = new URL(ENDPOINT)
  url.searchParams.set('lmt', '0')
  url.searchParams.set('klt', '1')
  url.searchParams.set('secid', secid)
  url.searchParams.set('fields1', 'f1,f2,f3,f4,f5,f6')
  url.searchParams.set('fields2', 'f51,f52,f53,f54,f55,f56,f57,f58')

  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      accept: 'application/json,text/plain,*/*',
      referer: 'https://quote.eastmoney.com/'
    }
  })
  if (!response.ok) throw new Error(`东财资金流向接口返回 HTTP ${response.status}`)

  const payload = await response.json() as EastmoneyFundFlowResponse
  if (payload.rc !== 0 || !payload.data?.klines) throw new Error('东财资金流向接口未返回有效数据')

  const points = payload.data.klines
    .map(parseEastmoneyFundFlowPoint)
    .filter((point): point is IntradayFundFlowPoint => point !== null)
  if (!points.length) throw new Error('东财资金流向接口暂无分钟数据')

  return {
    provider: 'EASTMONEY',
    stockCode,
    points,
    summary: createSummary(stockCode, points.at(-1)!),
    pricePrecision: 2,
    updatedAt: new Date().toISOString()
  }
}

/** 解析 f51-f56：时间、主力、小单、中单、大单、超大单累计净流入。 */
export function parseEastmoneyFundFlowPoint(row: string): IntradayFundFlowPoint | null {
  const [dateTime = '', mainRaw, smallRaw, normalRaw, bigRaw, superRaw] = row.split(',')
  const time = dateTime.match(/(\d{2}:\d{2})$/)?.[1]
  const values = [mainRaw, smallRaw, normalRaw, bigRaw, superRaw].map(Number)
  if (!time || values.some(value => !Number.isFinite(value))) return null

  const [mainNetInflow, smallNetInflow, normalNetInflow, bigNetInflow, superNetInflow] = values as [number, number, number, number, number]
  return {
    time,
    price: null,
    mainNetInflow,
    retailNetInflow: smallNetInflow + normalNetInflow,
    superNetInflow,
    bigNetInflow,
    normalNetInflow,
    smallNetInflow,
    mainInflow: null,
    mainOutflow: null
  }
}

function createSummary(stockCode: string, latest: IntradayFundFlowPoint): TodayFundFlowSummary {
  return {
    stockCode,
    mainNetIn: latest.mainNetInflow,
    mainIn: null,
    mainInRate: null,
    mainOut: null,
    mainOutRate: null,
    retailIn: null,
    retailInRate: null,
    retailOut: null,
    retailOutRate: null,
    superFlow: latest.superNetInflow,
    bigFlow: latest.bigNetInflow,
    normalFlow: latest.normalNetInflow,
    smallFlow: latest.smallNetInflow,
    marketCapRatio: null,
    rank: null,
    description: '',
    summaryText: ''
  }
}

export function toEastmoneySecid(stockCode: string) {
  const matched = stockCode.match(/^(sh|sz|bj)(\d{6})$/)
  if (!matched) throw new Error('不支持的东财证券代码')
  return `${matched[1] === 'sh' ? 1 : 0}.${matched[2]}`
}

interface EastmoneyFundFlowResponse {
  rc: number
  data?: {
    code?: string
    market?: number
    name?: string
    klines?: string[]
  }
}

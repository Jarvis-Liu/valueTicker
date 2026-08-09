import type { FundFlowSnapshot, IntradayFundFlowPoint, TodayFundFlowSummary } from '~~/shared/types/fund-flow'

const ENDPOINT = 'https://proxy.finance.qq.com/cgi/cgi-bin/fundflow/hsfundtab'
const TIMEOUT_MS = 7000

/** 获取腾讯单只沪深股票的当日资金流向，并将字符串金额转换为数值。 */
export async function fetchTencentFundFlow(stockCode: string): Promise<FundFlowSnapshot> {
  if (!/^(?:sh|sz)\d{6}$/.test(stockCode)) throw new Error('不支持的腾讯证券代码')

  const url = new URL(ENDPOINT)
  url.searchParams.set('code', stockCode)
  url.searchParams.set('type', 'todayFundTrend,todayFundFlow')

  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      accept: 'application/json,text/plain,*/*',
      referer: 'https://gu.qq.com/'
    }
  })
  if (!response.ok) throw new Error(`腾讯资金流向接口返回 HTTP ${response.status}`)

  const payload = await response.json() as TencentFundFlowResponse
  if (payload.code !== 0 || !payload.data?.todayFundFlow || !payload.data.todayFundTrend) {
    throw new Error(payload.msg || '腾讯资金流向接口未返回有效数据')
  }

  const points = (payload.data.todayFundTrend.minList ?? [])
    .map(parseFundFlowPoint)
    .filter((point): point is IntradayFundFlowPoint => point !== null)

  return {
    provider: 'TENCENT',
    stockCode,
    points,
    summary: parseSummary(payload.data.todayFundFlow),
    pricePrecision: finiteNumber(payload.data.prec, 2),
    updatedAt: new Date().toISOString()
  }
}

export function parseFundFlowPoint(point: TencentRawFundFlowPoint): IntradayFundFlowPoint | null {
  const time = formatMinute(point.time)
  const price = finiteNumber(point.Price)
  const mainNetInflow = finiteNumber(point.MainNetInflow)
  if (!time || !Number.isFinite(price) || !Number.isFinite(mainNetInflow)) return null

  return {
    time,
    price,
    mainNetInflow,
    retailNetInflow: finiteNumber(point.RetailNetInflow),
    superNetInflow: finiteNumber(point.SuperNetInflow),
    bigNetInflow: finiteNumber(point.BigNetInflow),
    normalNetInflow: finiteNumber(point.NormalNetInflow),
    smallNetInflow: finiteNumber(point.SmallNetInflow),
    mainInflow: finiteNumber(point.MainInflow),
    mainOutflow: finiteNumber(point.MainOutflow)
  }
}

function parseSummary(summary: TencentRawTodayFundFlow): TodayFundFlowSummary {
  return {
    stockCode: summary.stockCode ?? '',
    mainNetIn: finiteNumber(summary.mainNetIn),
    mainIn: finiteNumber(summary.mainIn),
    mainInRate: finiteNumber(summary.mainInRate),
    mainOut: finiteNumber(summary.mainOut),
    mainOutRate: finiteNumber(summary.mainOutRate),
    retailIn: finiteNumber(summary.retailIn),
    retailInRate: finiteNumber(summary.retailInRate),
    retailOut: finiteNumber(summary.retailOut),
    retailOutRate: finiteNumber(summary.retailOutRate),
    superFlow: finiteNumber(summary.superFlow),
    bigFlow: finiteNumber(summary.bigFlow),
    normalFlow: finiteNumber(summary.normalFlow),
    smallFlow: finiteNumber(summary.smallFlow),
    marketCapRatio: nullableNumber(summary.summary?.mcRatio),
    rank: summary.summary?.rank ?? summary.rank ?? '',
    description: summary.desc ?? '',
    summaryText: summary.summary?.s0 ?? ''
  }
}

function formatMinute(value: string | undefined) {
  const matched = value?.match(/^\d{8}(\d{2})(\d{2})$/)
  return matched ? `${matched[1]}:${matched[2]}` : ''
}

function finiteNumber(value: string | number | undefined, fallback = Number.NaN) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function nullableNumber(value: string | number | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

interface TencentFundFlowResponse {
  code: number
  msg?: string
  data?: {
    todayFundFlow?: TencentRawTodayFundFlow
    todayFundTrend?: { stockCode?: string, minList?: TencentRawFundFlowPoint[] }
    prec?: string
  }
}

interface TencentRawTodayFundFlow {
  desc?: string
  stockCode?: string
  mainNetIn?: string
  mainIn?: string
  mainInRate?: string
  mainOut?: string
  mainOutRate?: string
  retailIn?: string
  retailInRate?: string
  retailOut?: string
  retailOutRate?: string
  superFlow?: string
  bigFlow?: string
  normalFlow?: string
  smallFlow?: string
  rank?: string
  summary?: { mcRatio?: string, rank?: string, s0?: string }
}

export interface TencentRawFundFlowPoint {
  time?: string
  Price?: string
  MainNetInflow?: string
  RetailNetInflow?: string
  SuperNetInflow?: string
  BigNetInflow?: string
  NormalNetInflow?: string
  SmallNetInflow?: string
  MainInflow?: string
  MainOutflow?: string
}

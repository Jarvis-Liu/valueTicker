export type FundFlowProvider = 'EASTMONEY' | 'TENCENT'

export interface IntradayFundFlowPoint {
  time: string
  /** 资金接口若不返回分钟价格则为 null；页面价格始终以分时行情为准。 */
  price: number | null
  mainNetInflow: number
  retailNetInflow: number
  superNetInflow: number
  bigNetInflow: number
  normalNetInflow: number
  smallNetInflow: number
  mainInflow: number | null
  mainOutflow: number | null
}

export interface TodayFundFlowSummary {
  stockCode: string
  mainNetIn: number
  mainIn: number | null
  mainInRate: number | null
  mainOut: number | null
  mainOutRate: number | null
  retailIn: number | null
  retailInRate: number | null
  retailOut: number | null
  retailOutRate: number | null
  superFlow: number
  bigFlow: number
  normalFlow: number
  smallFlow: number
  marketCapRatio: number | null
  rank: string | null
  description: string
  summaryText: string
}

export interface FundFlowSnapshot {
  provider: FundFlowProvider
  stockCode: string
  points: IntradayFundFlowPoint[]
  summary: TodayFundFlowSummary
  pricePrecision: number
  updatedAt: string
}

/** 全市场主力净流入 Top 500 项；rank 为东财按当日主力净流入返回的顺序。 */
export interface FundFlowRankEntry {
  code: string
  name: string
  rank: number
  mainNetInflow: number | null
  mainNetInflowPercent: number | null
}

/** 服务端缓存的东财全市场主力净流入 Top 500 快照；total 是东财返回的市场总数。 */
export interface FundFlowRankSnapshot {
  total: number
  updatedAt: string
  entries: FundFlowRankEntry[]
}

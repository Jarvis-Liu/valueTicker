export interface WatchGroup {
  id: string
  name: string
  count: number
  isDefault?: boolean
}

export interface SecurityQuote {
  securityId: string
  name: string
  code: string
  boardLabel?: '创' | '科' | '北'
  securityType: 'STOCK' | 'ETF'
  price: number
  change: number
  changePercent: number
  open: number
  high: number
  low: number
  previousClose: number
  updatedAt: string
  status: 'TRADING' | 'STALE' | 'SUSPENDED'
  alertCount: number
  groupIds: string[]
}

/** 可在分时详情弹框中展示的证券最小信息集，兼容自选证券与市场指数。 */
export interface IntradayTrendTarget {
  securityId: string
  name: string
  code: string
  boardLabel?: '创' | '科' | '北'
  securityType: 'STOCK' | 'ETF' | 'UNKNOWN'
}
export interface AlertNotification {
  id: string
  title: string
  detail: string
  time: string
  tone: 'up' | 'down' | 'info'
}

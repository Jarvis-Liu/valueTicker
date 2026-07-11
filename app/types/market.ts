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

export interface AlertNotification {
  id: string
  title: string
  detail: string
  time: string
  tone: 'up' | 'down' | 'info'
}

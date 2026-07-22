import type { AlertRule, SecurityAlerts, SecurityItem } from '~~/shared/types/stock'

export type MonitorStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'MARKET_CLOSED' | 'STALE' | 'ERROR'
export type QuoteProvider = 'TENCENT' | 'EASTMONEY'

export interface NormalizedQuote {
  securityId: string
  price: number
  change: number
  changePercent: number
  volume: number
  amount: number
  turnoverRate: number
  open: number
  high: number
  low: number
  previousClose: number
  totalMarketValue: number
  peTtm: number
  providerCode: string
  providerMarket: number
  providerName: string
  updatedAt: string
  status: 'TRADING' | 'STALE' | 'SUSPENDED' | 'ERROR'
  provider: QuoteProvider
}

export interface IntradayTrendPoint {
  time: string
  price: number
  averagePrice: number
  volume: number
  amount: number
}

export interface SecurityIntradayTrend {
  securityId: string
  previousClose: number
  openingPrice: number
  points: IntradayTrendPoint[]
  updatedAt: string
  provider: QuoteProvider
  status: 'READY' | 'STALE' | 'ERROR'
}

export interface QuoteAlertEvent {
  id: string
  securityId: string
  securityName: string
  code: string
  rule: AlertRule
  price: number
  changePercent: number
  triggeredAt: string
  provider: QuoteProvider
}

export type QuoteWorkerRequest
  = | { type: 'START', securities: SecurityItem[], provider: QuoteProvider, alerts?: Record<string, SecurityAlerts>, pollingIntervalMs?: number }
    | { type: 'STOP' }
    | { type: 'PAUSE' }
    | { type: 'RESUME' }
    | { type: 'FORCE_REFRESH' }
    | { type: 'REFRESH_SECURITIES', securities: SecurityItem[] }
    | { type: 'UPDATE_TREND_SECURITIES', securities: SecurityItem[] }
    | { type: 'UPDATE_WINDOW_ACTIVITY', active: boolean }
    | { type: 'UPDATE_PROVIDER', provider: QuoteProvider }
    | { type: 'UPDATE_POLLING_INTERVAL', pollingIntervalMs: number }
    | { type: 'UPDATE_SECURITIES', securities: SecurityItem[], provider?: QuoteProvider }
    | { type: 'UPDATE_ALERTS', alerts: Record<string, SecurityAlerts> }

export type QuoteWorkerResponse
  = | { type: 'QUOTE_SNAPSHOT', quotes: NormalizedQuote[], securityIds: string[] }
    | { type: 'TREND_SNAPSHOT', trends: SecurityIntradayTrend[], securityIds: string[] }
    | { type: 'ALERT_TRIGGERED', event: QuoteAlertEvent }
    | { type: 'STATUS', status: MonitorStatus, message?: string }
    | { type: 'METRICS', providerLatencyMs: number | null }
    | { type: 'ERROR', message: string }

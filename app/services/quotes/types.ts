import type { AlertRule, SecurityAlerts, SecurityItem } from '~~/shared/types/stock'

export type MonitorStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'MARKET_CLOSED' | 'STALE' | 'ERROR'
export type QuoteProvider = 'TENCENT' | 'EASTMONEY'

export interface NormalizedQuote {
  securityId: string
  price: number
  change: number
  changePercent: number
  open: number
  high: number
  low: number
  previousClose: number
  updatedAt: string
  status: 'TRADING' | 'STALE' | 'SUSPENDED' | 'ERROR'
  provider: QuoteProvider
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
    | { type: 'UPDATE_PROVIDER', provider: QuoteProvider }
    | { type: 'UPDATE_POLLING_INTERVAL', pollingIntervalMs: number }
    | { type: 'UPDATE_SECURITIES', securities: SecurityItem[], provider?: QuoteProvider }
    | { type: 'UPDATE_ALERTS', alerts: Record<string, SecurityAlerts> }

export type QuoteWorkerResponse
  = | { type: 'QUOTE_SNAPSHOT', quotes: NormalizedQuote[], securityIds: string[] }
    | { type: 'ALERT_TRIGGERED', event: QuoteAlertEvent }
    | { type: 'STATUS', status: MonitorStatus, message?: string }
    | { type: 'ERROR', message: string }

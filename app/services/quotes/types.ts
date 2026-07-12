import type { SecurityItem } from '~~/shared/types/stock'

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

export type QuoteWorkerRequest
  = | { type: 'START', securities: SecurityItem[], provider: QuoteProvider }
    | { type: 'STOP' }
    | { type: 'PAUSE' }
    | { type: 'RESUME' }
    | { type: 'FORCE_REFRESH' }
    | { type: 'UPDATE_PROVIDER', provider: QuoteProvider }
    | { type: 'UPDATE_SECURITIES', securities: SecurityItem[], provider?: QuoteProvider }

export type QuoteWorkerResponse
  = | { type: 'QUOTE_SNAPSHOT', quotes: NormalizedQuote[], securityIds: string[] }
    | { type: 'STATUS', status: MonitorStatus, message?: string }
    | { type: 'ERROR', message: string }

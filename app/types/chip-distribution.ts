import type { SignalType } from 'stock-sdk'

export interface ChipDistributionPoint {
  date: string
  close: number | null
  profitRatio: number | null
  avgCost: number | null
  cost90Low: number | null
  cost90High: number | null
  concentration90: number | null
  cost70Low: number | null
  cost70High: number | null
  concentration70: number | null
}

export interface ChipTechnicalSignal {
  type: SignalType
  date: string
  timestamp: number
  close: number | null
  detail?: Record<string, number>
}

export type ChipDistributionStatus = 'IDLE' | 'LOADING' | 'READY' | 'EMPTY' | 'ERROR' | 'UNSUPPORTED'

export interface ChipDistributionSnapshot {
  securityId: string
  points: ChipDistributionPoint[]
  signals: ChipTechnicalSignal[]
  fetchedAt: string
}

export interface ChipDistributionEntry {
  status: ChipDistributionStatus
  snapshot: ChipDistributionSnapshot | null
  errorMessage: string
}

export interface ChipDistributionTarget {
  securityId: string
  code: string
  securityType: 'STOCK' | 'ETF' | 'UNKNOWN'
}

export interface EastmoneyKlineData {
  code?: string
  market?: number
  name?: string
  decimal?: number
  dktotal?: number
  preKPrice?: number
  klines?: string[]
}

export interface EastmoneyKlineResponse {
  rc: number
  rt?: number
  svr?: number
  lt?: number
  full?: number
  data?: EastmoneyKlineData | null
}

export type EastmoneyKlineCacheStatus = 'HIT' | 'MISS' | 'REFRESHED' | 'STALE'

export interface EastmoneyKlineCacheDocument {
  schemaVersion: 1
  secid: string
  symbol: string
  period: 'daily'
  adjust: 'qfq'
  beginDate: string
  endDate: string
  source: 'EASTMONEY'
  payload: EastmoneyKlineResponse
  sourceUpdatedAt: string | null
  fetchedAt: string
  expiresAt: string
}

export interface EastmoneyKlineApiResult {
  secid: string
  payload: EastmoneyKlineResponse
  fetchedAt: string
  expiresAt: string
  cacheStatus: EastmoneyKlineCacheStatus
  stale: boolean
  warning?: string
}

export interface RecoverEastmoneyKlinePayload {
  secid: string
  payload: EastmoneyKlineResponse
}

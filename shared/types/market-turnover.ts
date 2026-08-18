export type MarketTurnoverPhase = 'MIDDAY' | 'CLOSE'

export interface ExchangeTurnoverAmounts {
  sse: number
  szse: number
  bse: number
}

export type ExchangeTurnoverSourceTimes = Record<keyof ExchangeTurnoverAmounts, string | null>

/** 腾讯三市成交额实时响应的统一解析结果。 */
export interface TencentMarketTurnover {
  exchanges: ExchangeTurnoverAmounts
  /** 三条行情中最晚的供应商时间，ISO 格式；解析不到时为 null。 */
  sourceUpdatedAt: string | null
  /** 各交易所独立的供应商时间，供定时采集时校验数据完整性。 */
  sourceUpdatedAtByExchange: ExchangeTurnoverSourceTimes
}

/** 后端保存的一个确定性时段成交额快照。金额统一为元。 */
export interface MarketTurnoverSnapshot {
  tradeDate: string
  phase: MarketTurnoverPhase
  exchanges: ExchangeTurnoverAmounts
  /** 腾讯行情源所携带的最后更新时间；不可用时为 null。 */
  sourceUpdatedAt: string | null
  /** 后端接收到并保存该数据的时间。 */
  capturedAt: string
  /** 非 null 表示该时段已封存，不再被后续请求覆盖。 */
  sealedAt: string | null
}

export interface MarketTurnoverDaySnapshots {
  tradeDate: string
  snapshots: Partial<Record<MarketTurnoverPhase, MarketTurnoverSnapshot>>
}

export type MarketTurnoverUpdateOutcome = 'UPDATED' | 'SNAPSHOT_SEALED' | 'OUTSIDE_WINDOW'

export interface MarketTurnoverUpdateResult {
  outcome: MarketTurnoverUpdateOutcome
  message: string
  snapshot: MarketTurnoverSnapshot | null
}

import type { ExchangeTurnoverSourceTimes, MarketTurnoverPhase } from '~~/shared/types/market-turnover'

const SHANGHAI_TIME_ZONE = 'Asia/Shanghai'
const MIN_SOURCE_SECONDS: Record<MarketTurnoverPhase, number> = {
  MIDDAY: 11 * 3600 + 30 * 60,
  CLOSE: 15 * 3600
}

/**
 * 确保三家交易所都已更新到当前交易日的目标收盘点。
 * 该校验同时阻止周中节假日把上一个交易日的旧行情写成当天快照。
 */
export function validateMarketTurnoverSourceTimes(
  tradeDate: string,
  phase: MarketTurnoverPhase,
  sourceTimes: ExchangeTurnoverSourceTimes
) {
  for (const [exchange, sourceUpdatedAt] of Object.entries(sourceTimes)) {
    if (!sourceUpdatedAt) {
      throw new MarketTurnoverSourceError(`${exchange.toUpperCase()} 行情缺少更新时间`)
    }
    const source = getShanghaiDateTime(new Date(sourceUpdatedAt))
    if (!source || source.tradeDate !== tradeDate || source.seconds < MIN_SOURCE_SECONDS[phase]) {
      throw new MarketTurnoverSourceError(`${exchange.toUpperCase()} 行情尚未更新到当前${phase === 'MIDDAY' ? '午盘' : '收盘'}`)
    }
  }
}

export class MarketTurnoverSourceError extends Error {}

function getShanghaiDateTime(date: Date) {
  if (Number.isNaN(date.getTime())) return null
  const values = new Intl.DateTimeFormat('en-CA', {
    timeZone: SHANGHAI_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => values.find(value => value.type === type)?.value ?? '0'
  return {
    tradeDate: `${part('year')}-${part('month')}-${part('day')}`,
    seconds: Number(part('hour')) * 3600 + Number(part('minute')) * 60 + Number(part('second'))
  }
}

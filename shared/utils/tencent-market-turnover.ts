import type { TencentMarketTurnover } from '~~/shared/types/market-turnover'

/**
 * 解析腾讯指数行情文本中的三市成交额和更新时间。
 * 浏览器直连与服务端定时采集共用此逻辑，避免两条采集链路产生口径差异。
 */
export function parseTencentMarketTurnoverBody(body: string): TencentMarketTurnover {
  const records = Array.from(body.matchAll(/v_([^=]+)="([^"]*)";?/g))
    .map(match => parseTencentTurnoverRecord(match[1]!, match[2]!))
    .filter((record): record is TencentTurnoverRecord => record !== null)
  const bySymbol = new Map(records.map(record => [record.symbol, record]))
  const sse = bySymbol.get('sh000001')
  const szse = bySymbol.get('sz399001')
  const bse = bySymbol.get('bj899050')
  if (!sse || !szse || !bse) throw new Error('腾讯成交额接口返回不完整')

  const sourceUpdatedAtByExchange = {
    sse: sse.updatedAt,
    szse: szse.updatedAt,
    bse: bse.updatedAt
  }
  const sourceTimes = Object.values(sourceUpdatedAtByExchange)
    .filter((value): value is string => value !== null)
    .sort()

  return {
    exchanges: { sse: sse.amount, szse: szse.amount, bse: bse.amount },
    sourceUpdatedAt: sourceTimes.at(-1) ?? null,
    sourceUpdatedAtByExchange
  }
}

function parseTencentTurnoverRecord(symbol: string, payload: string): TencentTurnoverRecord | null {
  const fields = payload.split('~')
  // 腾讯复合字段形如“最新价/成交量/成交额”，最后一项的单位为元。
  const amountField = fields.find(value => /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/.test(value))
  const amount = Number(amountField?.split('/').at(-1))
  if (!Number.isFinite(amount) || amount < 0) return null
  const time = fields.find(value => /^\d{14}$/.test(value))
  return { symbol, amount, updatedAt: time ? tencentTimeToIso(time) : null }
}

function tencentTimeToIso(value: string) {
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(4, 6)) - 1
  const day = Number(value.slice(6, 8))
  const hour = Number(value.slice(8, 10))
  const minute = Number(value.slice(10, 12))
  const second = Number(value.slice(12, 14))
  // 腾讯时间是北京时间；统一转换为 ISO 后再由服务端按 Asia/Shanghai 校验。
  return new Date(Date.UTC(year, month, day, hour - 8, minute, second)).toISOString()
}

interface TencentTurnoverRecord {
  symbol: string
  amount: number
  updatedAt: string | null
}

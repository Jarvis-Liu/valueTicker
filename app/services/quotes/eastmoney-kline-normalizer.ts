import type { HistoryKline } from 'stock-sdk'
import { buildTimeMeta, MARKET_TZ } from 'stock-sdk'
import type { EastmoneyKlineResponse } from '~~/shared/types/eastmoney-kline'

/**
 * 将东财 f51-f61 日 K 字符串转换为 stock-sdk 纯计算方法接受的标准 A 股 K 线。
 * @param payload 已由服务端校验过的东财原始响应。
 * @param fallbackCode 上游未返回代码时使用的六位证券代码。
 * @returns 按上游顺序排列且过滤损坏行的标准日 K 数组。
 */
export function normalizeEastmoneyDailyKlines(payload: EastmoneyKlineResponse, fallbackCode: string): HistoryKline[] {
  const code = payload.data?.code || fallbackCode
  return (payload.data?.klines ?? [])
    .map(row => normalizeEastmoneyDailyKline(row, code))
    .filter((row): row is HistoryKline => row !== null)
}

/**
 * 解析单条东财日 K 字符串，日期或价格核心字段损坏时丢弃该行。
 * @param row f51-f61 逗号分隔的日 K 行。
 * @param code 六位证券代码。
 * @returns 标准 HistoryKline；核心字段无效时返回 null。
 */
export function normalizeEastmoneyDailyKline(row: string, code: string): HistoryKline | null {
  const [date = '', openRaw, closeRaw, highRaw, lowRaw, volumeRaw, amountRaw, amplitudeRaw, percentRaw, changeRaw, turnoverRaw] = row.split(',')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const open = finiteNumber(openRaw)
  const close = finiteNumber(closeRaw)
  const high = finiteNumber(highRaw)
  const low = finiteNumber(lowRaw)
  if (open === null || close === null || high === null || low === null) return null
  const time = buildTimeMeta(date, MARKET_TZ.CN)
  return {
    date,
    timestamp: time.timestamp,
    tz: time.tz,
    code,
    open,
    close,
    high,
    low,
    volume: finiteNumber(volumeRaw),
    amount: finiteNumber(amountRaw),
    amplitude: finiteNumber(amplitudeRaw),
    changePercent: finiteNumber(percentRaw),
    change: finiteNumber(changeRaw),
    turnoverRate: finiteNumber(turnoverRaw)
  }
}

/**
 * 将东财数字文本归一为有限数字。
 * @param value 待转换的文本。
 * @returns 有限数字；缺失、占位符或非数值时返回 null。
 */
function finiteNumber(value: string | undefined) {
  if (!value || value === '-' || value === '--') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

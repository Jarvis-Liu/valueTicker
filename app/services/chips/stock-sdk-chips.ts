import type { ChipDistributionItem, HistoryKline, StockSDK } from 'stock-sdk'
import { fetchEastmoneyKlineResult } from '../api/eastmoney-kline'
import { normalizeEastmoneyDailyKlines } from '../quotes/eastmoney-kline-normalizer'
import type { ChipDistributionPoint, ChipDistributionSnapshot, ChipDistributionTarget, ChipTechnicalSignal } from '../../types/chip-distribution'

const CHIP_DAYS = 60
const CHIP_CALCULATION_RANGE = 120
const KLINE_LOOKBACK_CALENDAR_DAYS = 360
const FALLBACK_CACHE_TTL_MS = 30 * 60 * 1000

type CalculateChipDistribution = typeof import('stock-sdk')['calcChipDistribution']
type CalculateSignals = typeof import('stock-sdk')['calcSignals']
type AddIndicators = typeof import('stock-sdk')['addIndicators']
interface ChipSdkContext {
  sdk: StockSDK
  calcChipDistribution: CalculateChipDistribution
  calcSignals: CalculateSignals
  addIndicators: AddIndicators
}

let sdkPromise: Promise<ChipSdkContext> | null = null

/**
 * 判断证券是否属于当前筹码功能支持的沪深北 A 股范围。
 * @param target 证券目标。
 * @returns 仅股票且证券 ID 合法时为 true。
 */
export function isChipDistributionSupported(target: ChipDistributionTarget) {
  return target.securityType === 'STOCK' && /^(SSE|SZSE|BSE):\d{6}$/.test(target.securityId)
}

/**
 * 将项目证券目标转换为 stock-sdk 旧链路使用的显式市场代码。
 * @param target 已支持的 A 股目标。
 * @returns `sh`、`sz` 或 `bj` 开头的代码。
 */
export function toStockSdkChipSymbol(target: ChipDistributionTarget) {
  const exchange = target.securityId.split(':')[0]
  const prefix = exchange === 'SSE' ? 'sh' : exchange === 'SZSE' ? 'sz' : exchange === 'BSE' ? 'bj' : ''
  if (!prefix || !/^\d{6}$/.test(target.code)) throw new Error('暂不支持该证券的筹码分布')
  return `${prefix}${target.code}`
}

/**
 * 将项目证券目标转换为东财 secid，沪市为 1，深市和北市为 0。
 * @param target 已支持的 A 股目标。
 * @returns 东财 `market.code` 格式证券标识。
 */
export function toEastmoneySecid(target: ChipDistributionTarget) {
  const market = target.securityId.startsWith('SSE:') ? '1' : '0'
  return `${market}.${target.code}`
}

/**
 * 获取同一批前复权日 K 并生成最近 60 日筹码、收盘价和技术信号。
 * @param target 需要计算筹码的 A 股目标。
 * @returns 携带服务端原始过期时间和缓存状态的筹码快照。
 */
export async function fetchChipDistribution(target: ChipDistributionTarget): Promise<ChipDistributionSnapshot> {
  if (!isChipDistributionSupported(target)) throw new Error('该品种暂不支持筹码分布')
  const { sdk, calcChipDistribution, calcSignals, addIndicators } = await getSdk()
  const sharedCacheEnabled = useRuntimeConfig().public.serverKlineCacheEnabled
  const result = sharedCacheEnabled ? await fetchEastmoneyKlineResult(toEastmoneySecid(target)) : null
  const rawKlines: HistoryKline[] = result
    ? normalizeEastmoneyDailyKlines(result.payload, target.code)
    : await sdk.kline.cn(toStockSdkChipSymbol(target), {
        period: 'daily',
        adjust: 'qfq',
        startDate: getKlineStartDate()
      })
  if (!rawKlines.length) throw new Error('历史 K 线暂时无有效数据')

  const klines = addIndicators(rawKlines, {
    ma: [5, 20],
    macd: true,
    kdj: true,
    rsi: { period: 6 },
    boll: true,
    sar: true
  })
  const rows = calcChipDistribution(klines, {
    range: CHIP_CALCULATION_RANGE,
    tail: CHIP_DAYS
  })
  const closesByDate = new Map(klines.map(row => [row.date, finiteOrNull(row.close)]))
  const visibleDates = new Set(rows.map(row => row.date))
  const signals = calculateTechnicalSignals(klines, visibleDates, calcSignals)
  const fallbackFetchedAt = new Date().toISOString()

  return {
    securityId: target.securityId,
    points: rows.map(row => normalizeChipPoint(row, closesByDate.get(row.date) ?? null)),
    signals,
    fetchedAt: result?.fetchedAt ?? fallbackFetchedAt,
    expiresAt: result?.expiresAt ?? new Date(Date.parse(fallbackFetchedAt) + FALLBACK_CACHE_TTL_MS).toISOString(),
    cacheStatus: result?.cacheStatus ?? 'MISS',
    stale: result?.stale ?? false,
    ...(result?.warning ? { warning: result.warning } : {})
  }
}

/**
 * 延迟加载 stock-sdk，正式链路仅复用其纯计算方法，关闭开关时保留旧网络路径。
 * @returns 单例化的 SDK 与指标、筹码、信号计算函数。
 */
function getSdk() {
  sdkPromise ??= import('stock-sdk').then(({ StockSDK, addIndicators, calcChipDistribution, calcSignals }) => ({
    sdk: new StockSDK({ timeout: 8_000 }),
    addIndicators,
    calcChipDistribution,
    calcSignals
  }))
  return sdkPromise
}

/**
 * 计算技术信号并限制为筹码图当前可见日期，辅助信号异常不影响筹码主数据。
 * @param klines 已带技术指标的标准日 K。
 * @param visibleDates 最近 60 个筹码交易日集合。
 * @param calcSignals stock-sdk 纯信号计算函数。
 * @returns 可显示的技术信号；计算失败时返回空数组。
 */
function calculateTechnicalSignals(klines: ReturnType<AddIndicators>, visibleDates: Set<string>, calcSignals: CalculateSignals): ChipTechnicalSignal[] {
  try {
    return calcSignals(klines, {
      ma: { fast: 5, slow: 20 },
      macd: true,
      kdj: {},
      rsi: { period: 6 },
      boll: true,
      sar: true
    }).map((signal): ChipTechnicalSignal | null => {
      const row = klines[signal.index]
      if (!row || !visibleDates.has(row.date)) return null
      return {
        type: signal.type,
        date: row.date,
        timestamp: signal.at,
        close: finiteOrNull(row.close),
        detail: signal.detail
      }
    }).filter((signal): signal is ChipTechnicalSignal => signal !== null)
  } catch {
    return []
  }
}

/**
 * 生成旧直连回滚路径所需的约 360 个自然日前起始日期。
 * @returns YYYYMMDD 格式起始日期。
 */
function getKlineStartDate() {
  const startDate = new Date()
  startDate.setUTCDate(startDate.getUTCDate() - KLINE_LOOKBACK_CALENDAR_DAYS)
  return startDate.toISOString().slice(0, 10).replaceAll('-', '')
}

/**
 * 将 stock-sdk 筹码计算结果裁剪为页面使用的统一点结构。
 * @param row 单日筹码计算结果。
 * @param close 同日收盘价。
 * @returns 页面筹码趋势点。
 */
function normalizeChipPoint(row: ChipDistributionItem, close: number | null): ChipDistributionPoint {
  return {
    date: row.date,
    close,
    profitRatio: finiteOrNull(row.profitRatio),
    avgCost: finiteOrNull(row.avgCost),
    cost90Low: finiteOrNull(row.cost90Low),
    cost90High: finiteOrNull(row.cost90High),
    concentration90: finiteOrNull(row.concentration90),
    cost70Low: finiteOrNull(row.cost70Low),
    cost70High: finiteOrNull(row.cost70High),
    concentration70: finiteOrNull(row.concentration70)
  }
}

/**
 * 将可能为空或非有限的指标数值归一为 null。
 * @param value 待校验数值。
 * @returns 有限数值或 null。
 */
function finiteOrNull(value: number | null) {
  return Number.isFinite(value) ? value : null
}

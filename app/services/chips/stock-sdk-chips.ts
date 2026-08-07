import type { ChipDistributionItem, StockSDK } from 'stock-sdk'
import type { ChipDistributionPoint, ChipDistributionSnapshot, ChipDistributionTarget, ChipTechnicalSignal } from '~/types/chip-distribution'

const CHIP_DAYS = 60
const CHIP_CALCULATION_RANGE = 120
// 约 360 个自然日通常可覆盖 180 根以上交易日 K 线，为 120 日筹码窗口预热并展示最后 60 日。
const KLINE_LOOKBACK_CALENDAR_DAYS = 360

type CalculateChipDistribution = typeof import('stock-sdk')['calcChipDistribution']
type CalculateSignals = typeof import('stock-sdk')['calcSignals']
interface ChipSdkContext {
  sdk: StockSDK
  calcChipDistribution: CalculateChipDistribution
  calcSignals: CalculateSignals
}

let sdkPromise: Promise<ChipSdkContext> | null = null

export function isChipDistributionSupported(target: ChipDistributionTarget) {
  return target.securityType === 'STOCK' && /^(SSE|SZSE|BSE):\d{6}$/.test(target.securityId)
}

export function toStockSdkChipSymbol(target: ChipDistributionTarget) {
  const exchange = target.securityId.split(':')[0]
  const prefix = exchange === 'SSE' ? 'sh' : exchange === 'SZSE' ? 'sz' : exchange === 'BSE' ? 'bj' : ''
  if (!prefix || !/^\d{6}$/.test(target.code)) throw new Error('暂不支持该证券的筹码分布')
  return `${prefix}${target.code}`
}

/**
 * 仅请求一次 stock-sdk 东财日 K，并使用同一批前复权数据生成收盘价、筹码指标和技术信号。
 * 额外的历史 K 线用于给 120 日筹码窗口预热，最终只向界面输出最后 60 个交易日。
 * 该低频研究数据不进入行情 Worker，也不参与 5 秒轮询和提醒判断。
 */
export async function fetchChipDistribution(target: ChipDistributionTarget): Promise<ChipDistributionSnapshot> {
  if (!isChipDistributionSupported(target)) throw new Error('该品种暂不支持筹码分布')
  const { sdk, calcChipDistribution, calcSignals } = await getSdk()
  const klines = await sdk.kline.withIndicators(toStockSdkChipSymbol(target), {
    market: 'A',
    period: 'daily',
    adjust: 'qfq',
    startDate: getKlineStartDate(),
    indicators: {
      ma: [5, 20],
      macd: true,
      kdj: true,
      rsi: { period: 6 },
      boll: true,
      sar: true
    }
  })
  const rows = calcChipDistribution(klines, {
    range: CHIP_CALCULATION_RANGE,
    tail: CHIP_DAYS
  })
  const closesByDate = new Map(klines.map(row => [row.date, finiteOrNull(row.close)]))
  const visibleDates = new Set(rows.map(row => row.date))
  let signals: ChipTechnicalSignal[] = []
  try {
    signals = calcSignals(klines, {
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
    // 技术信号属于辅助信息；计算异常时保留筹码与股价主数据，界面退化为“暂无信号”。
  }

  return {
    securityId: target.securityId,
    points: rows.map(row => normalizeChipPoint(row, closesByDate.get(row.date) ?? null)),
    signals,
    fetchedAt: new Date().toISOString()
  }
}

/** 延迟加载 SDK，避免用户未查看筹码数据时增加首页脚本解析成本。 */
function getSdk() {
  sdkPromise ??= import('stock-sdk').then(({ StockSDK, calcChipDistribution, calcSignals }) => ({
    sdk: new StockSDK({ timeout: 8_000 }),
    calcChipDistribution,
    calcSignals
  }))
  return sdkPromise
}

function getKlineStartDate() {
  const startDate = new Date()
  startDate.setUTCDate(startDate.getUTCDate() - KLINE_LOOKBACK_CALENDAR_DAYS)
  return startDate.toISOString().slice(0, 10).replaceAll('-', '')
}

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

function finiteOrNull(value: number | null) {
  return Number.isFinite(value) ? value : null
}

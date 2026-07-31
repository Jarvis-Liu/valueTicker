<script setup lang="ts">
import {
  ColorType,
  CrosshairMode,
  BaselineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type BaselineSeriesPartialOptions,
  type LineData,
  type Time,
  type UTCTimestamp,
  type WhitespaceData
} from 'lightweight-charts'
import type { IntradayTrendPoint, SecurityIntradayTrend } from '~/services/quotes/types'
import { normalizeIntradayTrendPoints } from '~/utils/intraday-trend-normalizer'

const props = defineProps<{
  trend: SecurityIntradayTrend | undefined
  pricePrecision: 2 | 3
}>()

const chartElement = ref<HTMLElement | null>(null)
// 时间轴两侧各保留 15% 可视留白，避开左上角悬浮信息层并保持左右平衡。
const TIMELINE_SIDE_INSET_RATIO = 0.15
const hoverPoint = ref<IntradayTrendPoint | null>(null)
let chart: IChartApi | null = null
let series: ISeriesApi<'Baseline'> | null = null
let previousCloseLine: IPriceLine | null = null
let dailyHighLine: IPriceLine | null = null
let dailyLowLine: IPriceLine | null = null
let resizeObserver: ResizeObserver | null = null

/**
 * 趋势通常已在 Provider 层清洗；这里再补一次 A 股全天时间轴，避免 Worker 快照或
 * 历史缓存只携带当前分钟以前的点时，详情图把 09:30 错排到图表中部。
 */
const chartPoints = computed(() => completeChartTimeline(props.trend?.points ?? []))
const latestPoint = computed(() => findLastPricePoint(chartPoints.value))
const displayPoint = computed(() => hoverPoint.value ?? latestPoint.value)
const pointMap = computed(() => new Map(chartPoints.value.map(point => [toTimestamp(point.time), point])))
const change = computed(() => {
  const price = displayPoint.value?.price
  const previousClose = props.trend?.previousClose
  if (!Number.isFinite(price) || !Number.isFinite(previousClose) || previousClose === 0) return null
  const value = price! - previousClose!
  return { value, percent: value / previousClose! * 100 }
})
watch(() => [props.trend, props.pricePrecision] as const, updateChart, { deep: true })

onMounted(createInteractiveChart)
onUnmounted(destroyChart)

function createInteractiveChart() {
  if (!chartElement.value) return

  chart = createChart(chartElement.value, {
    autoSize: true,
    height: 460,
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: '#64748b',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      fontSize: 11,
      attributionLogo: false
    },
    grid: { vertLines: { color: '#eef2f3' }, horzLines: { color: '#eef2f3' } },
    rightPriceScale: { borderColor: '#e2e8f0', minimumWidth: 62, scaleMargins: { top: 0.12, bottom: 0.12 } },
    timeScale: {
      borderColor: '#e2e8f0', timeVisible: true, secondsVisible: false, rightOffset: 0, fixLeftEdge: false, fixRightEdge: false,
      tickMarkFormatter: (time: Time) => formatMinuteFromTimestamp(time)
    },
    crosshair: {
      mode: CrosshairMode.Magnet,
      vertLine: { color: '#94a3b8', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#334155' },
      horzLine: { color: '#94a3b8', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#334155' }
    },
    handleScroll: true,
    handleScale: true,
    localization: {
      priceFormatter: (value: number) => Number(value).toFixed(props.pricePrecision),
      // 分时图的内部时间戳只用于排序，展示层始终输出交易时间，避免泄露占位日期。
      timeFormatter: (time: Time) => formatMinuteFromTimestamp(time)
    }
  })
  // 官方 BaselineSeries 以昨收为基准自动切换上下颜色；填充保持透明，仅展示分时折线。
  series = chart.addSeries(BaselineSeries, createBaselineOptions(getPreviousClose(props.trend)))
  chart.subscribeCrosshairMove((param) => {
    hoverPoint.value = param.time ? pointMap.value.get(Number(param.time) as UTCTimestamp) ?? null : null
  })
  resizeObserver = new ResizeObserver(fitIntradayTimeline)
  resizeObserver.observe(chartElement.value)
  updateChart()
}

function updateChart() {
  if (!chart || !series) return
  const trend = props.trend
  const data = chartPoints.value.map((point): LineData<Time> | WhitespaceData<Time> => {
    const time = toTimestamp(point.time)
    return Number.isFinite(point.price) ? { time, value: point.price! } : { time }
  })
  series.setData(data)
  series.applyOptions(createBaselineOptions(getPreviousClose(trend)))
  if (previousCloseLine) series.removePriceLine(previousCloseLine)
  if (dailyHighLine) series.removePriceLine(dailyHighLine)
  if (dailyLowLine) series.removePriceLine(dailyLowLine)
  previousCloseLine = Number.isFinite(trend?.previousClose)
    ? series.createPriceLine({ price: trend!.previousClose, color: '#94a3b8', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '昨收' })
    : null
  const priceRange = getDailyPriceRange(trend)
  dailyHighLine = priceRange
    ? series.createPriceLine({ price: priceRange.high, color: '#f43f5e', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '最高' })
    : null
  dailyLowLine = priceRange
    ? series.createPriceLine({ price: priceRange.low, color: '#10b981', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '最低' })
    : null
  fitIntradayTimeline()
}

/** 强制展示完整交易时间轴：首个节点贴左，未来 null 节点占据后续 X 轴空间。 */
function fitIntradayTimeline() {
  if (!chart) return
  const pointCount = chartPoints.value.length
  if (!pointCount) return

  // 将数据区映射到中间 70%，使首尾两端分别保留约 15% 的可视缩进。
  const timelineSpan = Math.max(pointCount - 1, 1)
  const sidePaddingBars = timelineSpan * TIMELINE_SIDE_INSET_RATIO / (1 - TIMELINE_SIDE_INSET_RATIO * 2)
  chart.timeScale().setVisibleLogicalRange({ from: -sidePaddingBars, to: pointCount - 1 + sidePaddingBars })
}

/** 仅为 A 股时间轴补齐未来空点；海外指数继续使用 Provider 的原生交易时段。 */
function completeChartTimeline(points: IntradayTrendPoint[]) {
  const firstTime = points.find(point => point.time)?.time
  return firstTime && firstTime >= '09:30' ? normalizeIntradayTrendPoints(points) : points
}
/** 从已清洗的有效分钟价格计算当日最高/最低，所有 Provider 共用此口径。 */
function getDailyPriceRange(trend: SecurityIntradayTrend | undefined) {
  const prices = (trend?.points ?? []).map(point => point.price).filter(isFiniteNumber)
  if (!prices.length) return null
  return { high: Math.max(...prices), low: Math.min(...prices) }
}
function createBaselineOptions(previousClose: number): BaselineSeriesPartialOptions {
  return {
    baseValue: { type: 'price', price: previousClose },
    // A 股语义：高于昨收为红、低于昨收为绿。
    topLineColor: '#f43f5e',
    bottomLineColor: '#10b981',
    // 详情图维持纯折线视觉，不启用 Baseline 默认的红绿面积填充。
    topFillColor1: 'rgba(244, 63, 94, 0)',
    topFillColor2: 'rgba(244, 63, 94, 0)',
    bottomFillColor1: 'rgba(16, 185, 129, 0)',
    bottomFillColor2: 'rgba(16, 185, 129, 0)',
    lineWidth: 2,
    crosshairMarkerVisible: true,
    crosshairMarkerRadius: 4,
    lastValueVisible: true,
    priceLineVisible: false,
    autoscaleInfoProvider: () => getSymmetricAutoScale(props.trend)
  }
}

function getPreviousClose(trend: SecurityIntradayTrend | undefined) {
  return Number.isFinite(trend?.previousClose) ? trend!.previousClose : 0
}
function destroyChart() {
  resizeObserver?.disconnect()
  resizeObserver = null
  chart?.remove()
  chart = null
  series = null
  previousCloseLine = null
  dailyHighLine = null
  dailyLowLine = null
}

function getSymmetricAutoScale(trend: SecurityIntradayTrend | undefined) {
  const previousClose = trend?.previousClose
  const prices = (trend?.points ?? []).map(point => point.price).filter(isFiniteNumber)
  if (!Number.isFinite(previousClose) || prices.length === 0) return null
  const distance = Math.max(...prices.map(price => Math.abs(price - previousClose!)), Math.abs(previousClose!) * 0.002, 0.01)
  return { priceRange: { minValue: previousClose! - distance, maxValue: previousClose! + distance }, margins: { above: 12, below: 12 } }
}

function findLastPricePoint(points: IntradayTrendPoint[]) {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (isFiniteNumber(points[index]?.price)) return points[index]!
  }
  return null
}

function toTimestamp(time: string): UTCTimestamp {
  const [hour = '0', minute = '0'] = time.split(':')
  return Math.floor(Date.UTC(2024, 0, 2, Number(hour), Number(minute)) / 1000) as UTCTimestamp
}

function formatMinuteFromTimestamp(value: Time) {
  const date = new Date(Number(value) * 1000)
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return Number.isFinite(value)
}
</script>

<template>
  <div class="relative min-h-[360px] sm:min-h-[460px]">
    <div
      ref="chartElement"
      class="absolute inset-0"
    />
    <div class="pointer-events-none absolute left-3 top-3 z-10 rounded-lg border border-slate-100 bg-white/92 px-2.5 py-2 shadow-sm backdrop-blur">
      <p class="text-[10px] text-slate-400">
        {{ displayPoint?.time ?? '--' }}
      </p>
      <p
        class="mt-0.5 text-sm font-semibold tabular-number"
        :class="change?.value && change.value < 0 ? 'text-emerald-600' : 'text-rose-600'"
      >
        {{ displayPoint?.price?.toFixed(pricePrecision) ?? '--' }}
      </p>
      <p
        class="mt-0.5 text-[10px] font-medium tabular-number"
        :class="change?.value && change.value < 0 ? 'text-emerald-600' : 'text-rose-600'"
      >
        {{ change ? `${change.value >= 0 ? '+' : ''}${change.value.toFixed(pricePrecision)} · ${change.percent >= 0 ? '+' : ''}${change.percent.toFixed(2)}%` : '--' }}
      </p>
    </div>
  </div>
</template>

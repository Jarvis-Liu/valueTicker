<script setup lang="ts">
import type { SecurityIntradayTrend } from '~/services/quotes/types'

const props = defineProps<{
  trend?: SecurityIntradayTrend
}>()

const chartWidth = 96
const chartHeight = 32
const padding = 2
// 东财分时均价字段待核对，暂不绘制，避免错误数据影响走势展示。
const showAverageLine = false

const chartData = computed(() => {
  const points = props.trend?.points ?? []
  const prices = points.map(point => point.price).filter(Number.isFinite)
  if (!prices.length) return null

  const reference = Number.isFinite(props.trend?.openingPrice) ? props.trend!.openingPrice : prices[0]!
  const averagePrices = showAverageLine && props.trend?.provider === 'EASTMONEY'
    ? points.map(point => point.averagePrice).filter(Number.isFinite)
    : []
  const distance = Math.max(...[...prices, ...averagePrices].map(price => Math.abs(price - reference)), 0.01)
  const usableWidth = chartWidth - padding * 2
  const usableHeight = chartHeight - padding * 2
  const toX = (index: number) => padding + (points.length === 1 ? usableWidth / 2 : index / (points.length - 1) * usableWidth)
  const toY = (price: number) => padding + (distance - (price - reference)) / (distance * 2) * usableHeight

  const toPolyline = (value: 'price' | 'averagePrice') => points
    .map((point, index) => ({ index, value: point[value] }))
    .filter((point): point is { index: number, value: number } => Number.isFinite(point.value))
    .map(point => `${toX(point.index).toFixed(2)},${toY(point.value).toFixed(2)}`)
    .join(' ')

  return {
    pricePoints: toPolyline('price'),
    averagePoints: showAverageLine && props.trend?.provider === 'EASTMONEY' ? toPolyline('averagePrice') : '',
    openingPriceY: toY(reference)
  }
})

const toneClass = computed(() => {
  const trend = props.trend
  const lastPrice = trend?.points.at(-1)?.price ?? Number.NaN
  if (!trend || !Number.isFinite(lastPrice) || !Number.isFinite(trend.previousClose)) return 'text-slate-300'
  if (lastPrice > trend.previousClose) return 'text-rose-500'
  if (lastPrice < trend.previousClose) return 'text-emerald-500'
  return 'text-slate-400'
})
</script>

<template>
  <div class="flex h-9 w-24 items-center justify-center">
    <svg
      v-if="trend?.status === 'READY' && chartData?.pricePoints"
      :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
      class="h-8 w-24 overflow-visible"
      aria-label="当日分时走势"
      role="img"
    >
      <line
        x1="0"
        :y1="chartData.openingPriceY"
        :x2="chartWidth"
        :y2="chartData.openingPriceY"
        class="stroke-slate-200"
        stroke-dasharray="2 2"
      />
      <polyline
        :points="chartData.pricePoints"
        class="fill-none stroke-current"
        :class="toneClass"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.8"
      />
      <polyline
        v-if="showAverageLine && chartData.averagePoints"
        :points="chartData.averagePoints"
        class="fill-none"
        stroke="#fbbf24"
        stroke-dasharray="3 1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
      />
    </svg>
    <span
      v-else
      class="text-[11px] text-slate-300"
    >
      --
    </span>
  </div>
</template>

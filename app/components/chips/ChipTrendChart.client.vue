<script setup lang="ts">
import * as echarts from 'echarts/core'
import { LineChart, ScatterChart } from 'echarts/charts'
import { DataZoomComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { ECharts, EChartsCoreOption } from 'echarts/core'
import type { ChipDistributionPoint, ChipTechnicalSignal } from '~/types/chip-distribution'
import {
  CHIP_SIGNAL_DEFINITIONS,
  filterChipSignals,
  formatChipSignalDetail,
  groupChipSignals,
  type ChipSignalFilter
} from '~/utils/chip-signals'

const props = defineProps<{
  points: ChipDistributionPoint[]
  signals: ChipTechnicalSignal[]
  signalFilter: ChipSignalFilter
}>()
const chartElement = ref<HTMLElement | null>(null)
let chart: ECharts | null = null

echarts.use([LineChart, ScatterChart, DataZoomComponent, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

watch(() => [props.points, props.signals, props.signalFilter], renderChart, { deep: true })
useResizeObserver(chartElement, () => chart?.resize())
onMounted(() => {
  if (!chartElement.value) return
  chart = echarts.init(chartElement.value)
  renderChart()
})
onUnmounted(() => {
  chart?.dispose()
  chart = null
})

function renderChart() {
  if (!chart) return
  const compact = (chartElement.value?.clientWidth ?? 800) < 640
  const signalMarkers = groupChipSignals(filterChipSignals(props.signals, props.signalFilter))
  const bullishMarkers = signalMarkers.filter(marker => marker.direction === 'BULLISH')
  const bearishMarkers = signalMarkers.filter(marker => marker.direction === 'BEARISH')
  const option: EChartsCoreOption = {
    animationDuration: 350,
    color: ['#1f2937', '#722ed1', '#f5222d', '#8c8c8c'],
    tooltip: {
      trigger: 'axis',
      triggerOn: 'mousemove|click',
      confine: true,
      enterable: true,
      axisPointer: { type: 'cross' },
      formatter: formatChartTooltip
    },
    legend: {
      data: ['收盘价（元）', '平均成本（元）', '获利比例（%）', '70%集中度（%）'],
      top: 0,
      left: 8,
      itemWidth: 16,
      itemHeight: 8,
      textStyle: { color: '#64748b', fontSize: compact ? 10 : 11 }
    },
    grid: { left: compact ? 4 : 12, right: compact ? 8 : 16, top: compact ? 58 : 44, bottom: 62, containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: props.points.map(point => point.date),
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      axisTick: { show: false },
      axisLabel: { color: '#94a3b8', fontSize: 10, hideOverlap: true }
    },
    yAxis: [
      {
        type: 'value',
        scale: true,
        name: '价格',
        nameTextStyle: { color: '#94a3b8', fontSize: 10 },
        axisLabel: { color: '#94a3b8', fontSize: 10 },
        splitLine: { lineStyle: { color: '#eef2f7' } }
      },
      {
        type: 'value',
        min: 0,
        max: 100,
        name: '比例',
        nameTextStyle: { color: '#94a3b8', fontSize: 10 },
        axisLabel: { color: '#94a3b8', fontSize: 10, formatter: '{value}%' },
        splitLine: { show: false }
      }
    ],
    dataZoom: [
      { type: 'inside', start: compact ? 50 : 0, end: 100, minValueSpan: 8 },
      { type: 'slider', start: compact ? 50 : 0, end: 100, height: 18, bottom: 10, borderColor: 'transparent', backgroundColor: '#f8fafc', fillerColor: 'rgba(24, 144, 255, 0.12)', handleStyle: { color: '#1890ff' }, textStyle: { color: '#94a3b8', fontSize: 9 } }
    ],
    series: [
      {
        name: '收盘价（元）',
        type: 'line',
        yAxisIndex: 0,
        showSymbol: false,
        connectNulls: false,
        data: props.points.map(point => point.close),
        lineStyle: { width: 2.5 },
        z: 4,
        tooltip: { valueFormatter: (value: unknown) => formatTooltipValue(value, ' 元') }
      },
      {
        name: '平均成本（元）',
        type: 'line',
        yAxisIndex: 0,
        showSymbol: false,
        connectNulls: false,
        data: props.points.map(point => point.avgCost),
        lineStyle: { width: 1.5, type: 'dashed' },
        z: 3,
        tooltip: { valueFormatter: (value: unknown) => formatTooltipValue(value, ' 元') }
      },
      {
        name: '获利比例（%）',
        type: 'line',
        yAxisIndex: 1,
        showSymbol: false,
        connectNulls: false,
        data: props.points.map(point => Number.isFinite(point.profitRatio) ? point.profitRatio! * 100 : null),
        lineStyle: { width: 1.5 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(245, 34, 45, 0.15)' },
              { offset: 1, color: 'rgba(245, 34, 45, 0.01)' }
            ]
          }
        },
        z: 2,
        tooltip: { valueFormatter: (value: unknown) => formatTooltipValue(value, '%') }
      },
      {
        name: '70%集中度（%）',
        type: 'line',
        yAxisIndex: 1,
        showSymbol: false,
        connectNulls: false,
        data: props.points.map(point => Number.isFinite(point.concentration70) ? point.concentration70! * 100 : null),
        lineStyle: { width: 1.25, type: 'dashed' },
        z: 1,
        tooltip: { valueFormatter: (value: unknown) => formatTooltipValue(value, '%') }
      },
      {
        name: '偏强技术信号',
        type: 'scatter',
        yAxisIndex: 0,
        symbol: 'triangle',
        symbolOffset: [0, 11],
        data: bullishMarkers.map(toSignalMarkerData),
        itemStyle: { color: '#f5222d', borderColor: '#ffffff', borderWidth: 1 },
        z: 8,
        clip: false
      },
      {
        name: '偏弱技术信号',
        type: 'scatter',
        yAxisIndex: 0,
        symbol: 'triangle',
        symbolRotate: 180,
        symbolOffset: [0, -11],
        data: bearishMarkers.map(toSignalMarkerData),
        itemStyle: { color: '#00a870', borderColor: '#ffffff', borderWidth: 1 },
        z: 8,
        clip: false
      }
    ]
  }
  chart.setOption(option, true)
}

function formatTooltipValue(value: unknown, suffix: string) {
  const number = Number(value)
  return Number.isFinite(number) ? `${number.toFixed(2)}${suffix}` : '--'
}

function toSignalMarkerData(marker: ReturnType<typeof groupChipSignals>[number]) {
  const count = marker.signals.length
  return {
    value: [marker.date, marker.close],
    signals: marker.signals,
    symbolSize: count > 1 ? 17 : 12,
    label: count > 1
      ? { show: true, formatter: String(count), color: '#ffffff', fontSize: 8, fontWeight: 700 }
      : { show: false }
  }
}

interface ChartTooltipParam {
  axisValueLabel?: string
  seriesName?: string
  marker?: string
  value?: unknown
  data?: {
    signals?: ChipTechnicalSignal[]
  }
}

function formatChartTooltip(input: unknown) {
  const params = (Array.isArray(input) ? input : [input]).filter(isChartTooltipParam)
  if (!params.length) return ''
  const date = params.find(param => param.axisValueLabel)?.axisValueLabel ?? ''
  const valueRows = params
    .filter(param => !param.data?.signals && isTrendSeries(param.seriesName))
    .map((param) => {
      const suffix = param.seriesName?.includes('（%）') ? '%' : ' 元'
      return `<div style="display:flex;justify-content:space-between;gap:20px"><span>${param.marker ?? ''}${escapeHtml(param.seriesName ?? '')}</span><strong>${formatTooltipValue(param.value, suffix)}</strong></div>`
    })
  const signals = params.flatMap(param => param.data?.signals ?? [])
  const signalRows = signals.map((signal) => {
    const definition = CHIP_SIGNAL_DEFINITIONS[signal.type]
    const detail = formatChipSignalDetail(signal.detail)
    return `<div style="margin-top:4px"><strong style="color:${definition.direction === 'BULLISH' ? '#f5222d' : '#00a870'}">${escapeHtml(definition.label)}</strong>${detail ? `<span style="margin-left:6px;color:#64748b">${escapeHtml(detail)}</span>` : ''}</div>`
  })

  return [
    `<div style="min-width:180px"><div style="margin-bottom:6px;font-weight:600;color:#334155">${escapeHtml(date)}</div>`,
    ...valueRows,
    signalRows.length ? '<div style="margin-top:7px;padding-top:5px;border-top:1px solid #e2e8f0;color:#475569">技术信号</div>' : '',
    ...signalRows,
    '</div>'
  ].join('')
}

function isChartTooltipParam(value: unknown): value is ChartTooltipParam {
  return Boolean(value && typeof value === 'object')
}

function isTrendSeries(name?: string) {
  return name === '收盘价（元）' || name === '平均成本（元）' || name === '获利比例（%）' || name === '70%集中度（%）'
}

function escapeHtml(value: unknown) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#039;')
}
</script>

<template>
  <div
    ref="chartElement"
    class="h-[340px] w-full sm:h-[420px]"
    role="img"
    aria-label="近60个交易日收盘价、平均成本、筹码集中度和获利比例趋势图"
  />
</template>

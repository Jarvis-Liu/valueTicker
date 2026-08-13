<script setup lang="ts">
import { IconArrowLeft, IconArrowRight } from '@tabler/icons-vue'
import type { ChipDistributionTarget } from '~/types/chip-distribution'

interface ChipCostRangeTarget extends ChipDistributionTarget {
  price: number
}

type CostPositionState = 'BELOW' | 'LOWER' | 'MIDDLE' | 'UPPER' | 'ABOVE' | 'UNKNOWN'

const props = defineProps<{ target: ChipCostRangeTarget }>()
const root = ref<HTMLElement | null>(null)
const chips = useChipDistribution()
const entry = computed(() => chips.getEntry(props.target))
const latest = computed(() => entry.value.snapshot?.points.at(-1) ?? null)
const range = computed(() => {
  const low = latest.value?.cost70Low
  const high = latest.value?.cost70High
  if (!isFiniteNumber(low) || !isFiniteNumber(high) || high <= low) return null
  return { low, high }
})
const currentPrice = computed(() => isFiniteNumber(props.target.price) ? props.target.price : null)
const relativePosition = computed(() => {
  if (!range.value || currentPrice.value === null) return null
  return (currentPrice.value - range.value.low) / (range.value.high - range.value.low)
})
const positionPercent = computed(() => Math.min(100, Math.max(0, (relativePosition.value ?? 0) * 100)))
const positionState = computed<CostPositionState>(() => {
  const position = relativePosition.value
  if (position === null) return 'UNKNOWN'
  if (position < 0) return 'BELOW'
  if (position <= 0.35) return 'LOWER'
  if (position < 0.65) return 'MIDDLE'
  if (position <= 1) return 'UPPER'
  return 'ABOVE'
})
const positionLabel = computed(() => ({
  BELOW: '低于成本区间',
  LOWER: '处于区间下部',
  MIDDLE: '处于区间中部',
  UPPER: '处于区间上部',
  ABOVE: '高于成本区间',
  UNKNOWN: '最新价待更新'
})[positionState.value])
const anchorClass = computed(() => {
  if (positionState.value === 'LOWER') return 'bg-sky-500 ring-sky-100'
  if (positionState.value === 'UPPER') return 'bg-amber-500 ring-amber-100'
  return 'bg-indigo-500 ring-indigo-100'
})
const title = computed(() => {
  if (!chips.isSupported(props.target)) return 'ETF、指数等品种暂不支持筹码分布'
  if (entry.value.status === 'ERROR') return entry.value.errorMessage
  if (range.value) {
    const price = currentPrice.value === null ? '--' : formatPrice(currentPrice.value)
    const date = latest.value?.date ? ` · 数据日期 ${latest.value.date}` : ''
    return `${positionLabel.value} · 最新价 ${price} · 70%筹码成本 ${formatPrice(range.value.low)}–${formatPrice(range.value.high)}${date} · 仅供参考`
  }
  return '进入可视区域后加载筹码数据'
})

useIntersectionObserver(root, ([intersection]) => {
  if (intersection?.isIntersecting && chips.isSupported(props.target)) void chips.ensure(props.target)
}, { rootMargin: '120px 0px' })

function isFiniteNumber(value: number | null | undefined): value is number {
  return Number.isFinite(value)
}

function formatPrice(value: number) {
  return value.toFixed(2)
}
</script>

<template>
  <div
    ref="root"
    class="min-w-[136px] tabular-number"
    :title="title"
    :aria-label="title"
  >
    <div
      v-if="range"
      class="ml-auto w-[124px]"
    >
      <div class="relative mx-1.5 h-3">
        <span class="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-slate-200" />
        <span class="absolute left-0 top-1/2 h-2 w-px -translate-y-1/2 bg-slate-400" />
        <span class="absolute right-0 top-1/2 h-2 w-px -translate-y-1/2 bg-slate-400" />
        <IconArrowLeft
          v-if="positionState === 'BELOW'"
          class="absolute -left-1 top-1/2 -translate-y-1/2 text-emerald-600"
          :size="14"
          stroke="2.5"
        />
        <IconArrowRight
          v-else-if="positionState === 'ABOVE'"
          class="absolute -right-1 top-1/2 -translate-y-1/2 text-rose-600"
          :size="14"
          stroke="2.5"
        />
        <span
          v-else-if="positionState !== 'UNKNOWN'"
          class="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm ring-2"
          :class="anchorClass"
          :style="{ left: `${positionPercent}%` }"
        />
      </div>
      <div class="mt-0.5 flex items-center justify-between text-[9px] font-medium leading-none text-slate-600">
        <span>{{ formatPrice(range.low) }}</span>
        <span>{{ formatPrice(range.high) }}</span>
      </div>
      <div class="mt-0.5 flex items-center justify-between text-[8px] leading-none text-slate-400">
        <span>下限</span>
        <span>上限</span>
      </div>
    </div>
    <span
      v-else-if="entry.status === 'LOADING' || entry.status === 'IDLE'"
      class="ml-auto block h-8 w-28 animate-pulse rounded bg-slate-100"
    />
    <span
      v-else
      class="block text-right text-xs text-slate-400"
    >--</span>
  </div>
</template>

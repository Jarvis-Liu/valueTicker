<script setup lang="ts">
import type { ChipDistributionTarget } from '~/types/chip-distribution'

const props = defineProps<{ target: ChipDistributionTarget }>()
const root = ref<HTMLElement | null>(null)
const chips = useChipDistribution()
const entry = computed(() => chips.getEntry(props.target))
const latest = computed(() => entry.value.snapshot?.points.at(-1) ?? null)
const hasRange = computed(() => Number.isFinite(latest.value?.cost70Low) && Number.isFinite(latest.value?.cost70High))
const title = computed(() => {
  if (!chips.isSupported(props.target)) return 'ETF、指数等品种暂不支持筹码分布'
  if (entry.value.status === 'ERROR') return entry.value.errorMessage
  if (latest.value?.date) return `70% 筹码成本区间 · 数据日期 ${latest.value.date}`
  return '进入可视区域后加载筹码数据'
})

useIntersectionObserver(root, ([intersection]) => {
  if (intersection?.isIntersecting && chips.isSupported(props.target)) void chips.ensure(props.target)
}, { rootMargin: '120px 0px' })
</script>

<template>
  <div
    ref="root"
    class="min-w-[126px] text-right tabular-number"
    :title="title"
  >
    <span
      v-if="hasRange"
      class="text-[11px] font-medium text-slate-700"
    >{{ latest!.cost70Low!.toFixed(2) }}–{{ latest!.cost70High!.toFixed(2) }}</span>
    <span
      v-else-if="entry.status === 'LOADING' || entry.status === 'IDLE'"
      class="inline-block h-3 w-24 animate-pulse rounded bg-slate-100 align-middle"
    />
    <span
      v-else
      class="text-xs text-slate-400"
    >--</span>
  </div>
</template>

<script setup lang="ts">
import type { ChipDistributionPoint } from '~/types/chip-distribution'

const props = defineProps<{ points: ChipDistributionPoint[] }>()
const latest = computed(() => props.points.at(-1) ?? null)
const highestAverageCost = computed(() => Math.max(...props.points.map(point => point.avgCost).filter(isFiniteNumber)))
const averageCostPullback = computed(() => {
  const value = latest.value?.avgCost
  const high = highestAverageCost.value
  if (!Number.isFinite(value) || !Number.isFinite(high) || high <= 0) return null
  return (value! - high) / high * 100
})
const profitSummary = computed(() => {
  const value = latest.value?.profitRatio
  if (!Number.isFinite(value)) return '暂无有效获利比例'
  if (value! >= 0.8) return '多数筹码处于获利状态'
  if (value! >= 0.5) return '获利筹码占比较高'
  if (value! >= 0.2) return '获利筹码占比较低'
  return '少量筹码处于获利状态'
})

function isFiniteNumber(value: number | null | undefined): value is number {
  return Number.isFinite(value)
}
</script>

<template>
  <div class="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
    <section class="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
      <p class="text-[11px] text-slate-400">
        平均成本（算法口径）
      </p>
      <p class="mt-1.5 text-lg font-semibold text-slate-900 tabular-number">
        {{ Number.isFinite(latest?.avgCost) ? latest!.avgCost!.toFixed(2) : '--' }}
      </p>
      <p class="mt-1 text-[10px] leading-4 text-slate-400">
        {{ averageCostPullback === null ? '60日区间暂无比较' : `距60日最高成本 ${averageCostPullback.toFixed(1)}%` }}
      </p>
    </section>
    <section class="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
      <p class="text-[11px] text-slate-400">
        获利比例
      </p>
      <p class="mt-1.5 text-lg font-semibold text-rose-600 tabular-number">
        {{ Number.isFinite(latest?.profitRatio) ? `${(latest!.profitRatio! * 100).toFixed(1)}%` : '--' }}
      </p>
      <p class="mt-1 text-[10px] leading-4 text-slate-400">
        {{ profitSummary }}
      </p>
    </section>
    <section class="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
      <p class="text-[11px] text-slate-400">
        70%筹码集中度
      </p>
      <p class="mt-1.5 text-lg font-semibold text-amber-600 tabular-number">
        {{ Number.isFinite(latest?.concentration70) ? `${(latest!.concentration70! * 100).toFixed(1)}%` : '--' }}
      </p>
      <p class="mt-1 text-[10px] leading-4 text-slate-400">
        数值越低，成本分布越集中
      </p>
    </section>
    <section class="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
      <p class="text-[11px] text-slate-400">
        70%筹码成本区间
      </p>
      <p class="mt-1.5 text-sm font-semibold text-slate-900 tabular-number sm:text-base">
        {{ Number.isFinite(latest?.cost70Low) && Number.isFinite(latest?.cost70High) ? `${latest!.cost70Low!.toFixed(2)}–${latest!.cost70High!.toFixed(2)}` : '--' }}
      </p>
      <p class="mt-1 text-[10px] leading-4 text-slate-400">
        中间70%筹码的估算价格区间
      </p>
    </section>
  </div>
</template>

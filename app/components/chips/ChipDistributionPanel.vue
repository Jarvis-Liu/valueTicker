<script setup lang="ts">
import { IconAlertCircle, IconChartHistogram, IconLoader2, IconRefresh } from '@tabler/icons-vue'
import type { ChipDistributionTarget } from '~/types/chip-distribution'
import type { ChipSignalFilter } from '~/utils/chip-signals'
import ChipMetrics from './ChipMetrics.vue'
import ChipSignalHelpDialog from './ChipSignalHelpDialog.vue'
import ChipSignalFilters from './ChipSignalFilters.vue'
import ChipTrendChart from './ChipTrendChart.client.vue'

const props = defineProps<{ target: ChipDistributionTarget }>()
const chips = useChipDistribution()
const entry = computed(() => chips.getEntry(props.target))
const points = computed(() => entry.value.snapshot?.points ?? [])
const signals = computed(() => entry.value.snapshot?.signals ?? [])
const latestDate = computed(() => points.value.at(-1)?.date ?? '')
const hasLimitedHistory = computed(() => points.value.length < 60)
const signalFilter = ref<ChipSignalFilter>('ALL')

watch(() => props.target.securityId, () => load(), { immediate: true })

function load(force = false) {
  if (chips.isSupported(props.target)) void chips.ensure(props.target, force)
}
</script>

<template>
  <div class="flex min-h-[430px] flex-col px-3 py-3 sm:min-h-[540px] sm:px-6 sm:py-5">
    <div
      v-if="entry.status === 'LOADING' && !entry.snapshot"
      class="grid flex-1 place-items-center text-center"
    >
      <div>
        <IconLoader2
          class="mx-auto animate-spin text-indigo-500"
          :size="28"
        />
        <p class="mt-3 text-sm font-semibold text-slate-700">
          正在计算近60日筹码数据
        </p>
        <p class="mt-1 text-xs text-slate-400">
          数据基于日K与换手率估算
        </p>
      </div>
    </div>
    <div
      v-else-if="entry.status === 'ERROR' || entry.status === 'EMPTY'"
      class="grid flex-1 place-items-center text-center"
    >
      <div>
        <IconAlertCircle
          class="mx-auto text-amber-500"
          :size="28"
        />
        <p class="mt-3 text-sm font-semibold text-slate-700">
          {{ entry.status === 'EMPTY' ? '暂无可用筹码数据' : '筹码数据加载失败' }}
        </p>
        <p class="mt-1 max-w-sm text-xs text-slate-400">
          {{ entry.errorMessage || '该股票可能缺少换手率数据，请稍后重试' }}
        </p>
        <button
          type="button"
          class="mt-4 inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          @click="load(true)"
        >
          <IconRefresh :size="14" />重新加载
        </button>
      </div>
    </div>
    <template v-else-if="points.length">
      <div class="mb-3 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 text-xs text-slate-400">
          <IconChartHistogram :size="15" />
          <span>近60个交易日 · 前复权</span>
          <span v-if="latestDate">更新至 {{ latestDate }}</span>
        </div>
        <button
          type="button"
          class="icon-button h-8 w-8 shrink-0"
          :disabled="entry.status === 'LOADING'"
          title="刷新筹码数据"
          aria-label="刷新筹码数据"
          @click="load(true)"
        >
          <IconRefresh
            :size="15"
            :class="entry.status === 'LOADING' && 'animate-spin'"
          />
        </button>
      </div>
      <ChipMetrics :points="points" />
      <div class="mt-3 min-h-0 rounded-xl border border-slate-100 bg-white p-1.5 sm:mt-4 sm:p-3">
        <div class="mb-2 flex flex-col gap-1.5 px-1 sm:flex-row sm:items-center sm:justify-between">
          <ChipSignalFilters
            v-if="signals.length"
            v-model="signalFilter"
            :signals="signals"
          />
          <span
            v-else
            class="text-[11px] text-slate-400"
          >
            近60个交易日暂无技术信号
          </span>
          <div class="flex items-center gap-0.5 self-end sm:self-auto">
            <ChipSignalHelpDialog />
            <span class="text-[10px] text-slate-400">
              {{ hasLimitedHistory ? '历史样本不足60日 · ' : '' }}技术信号仅供参考 · 当日信号收盘前可能变化
            </span>
          </div>
        </div>
        <ChipTrendChart
          :points="points"
          :signals="signals"
          :signal-filter="signalFilter"
        />
      </div>
    </template>
    <div
      v-else
      class="grid flex-1 place-items-center text-center text-xs text-slate-400"
    >
      等待筹码数据
    </div>
  </div>
</template>

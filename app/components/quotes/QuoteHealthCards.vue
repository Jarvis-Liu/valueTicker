<script setup lang="ts">
import type { MonitorStatus } from '~/services/quotes/types'

const props = defineProps<{
  delayedCount: number
  enabledAlertCount: number
  coveredSecurityCount: number
  healthPercent: number | null
  providerLatency: number | null
  monitorStatus: MonitorStatus
}>()

const formattedHealth = computed(() => props.healthPercent === null ? '--' : `${props.healthPercent.toFixed(1)}%`)
const formattedLatency = computed(() => props.providerLatency === null ? '--' : Math.round(props.providerLatency).toString())
const latencyTone = computed(() => {
  if (props.monitorStatus === 'ERROR') return 'text-rose-600'
  if (props.providerLatency === null) return 'text-slate-400'
  if (props.providerLatency > 2500) return 'text-amber-600'
  return 'text-emerald-600'
})
const latencyLabel = computed(() => {
  if (props.monitorStatus === 'ERROR') return '连接异常'
  if (props.monitorStatus === 'MARKET_CLOSED') return '自动轮询停止'
  if (props.providerLatency === null) return '等待测速'
  if (props.providerLatency > 2500) return '响应偏慢'
  return '连接稳定'
})
</script>

<template>
  <div class="grid gap-3 sm:grid-cols-3">
    <div class="surface-card px-4 py-3.5">
      <p class="text-[10px] font-medium text-slate-400">
        行情健康度
      </p>
      <div class="mt-2 flex items-end justify-between">
        <p class="text-xl font-semibold text-slate-900 tabular-number">
          {{ formattedHealth }}
        </p>
        <span class="text-[10px] text-amber-600">{{ delayedCount }} 只延迟</span>
      </div>
    </div>

    <div class="surface-card px-4 py-3.5">
      <p class="text-[10px] font-medium text-slate-400">
        已开启提醒
      </p>
      <div class="mt-2 flex items-end justify-between">
        <p class="text-xl font-semibold text-slate-900 tabular-number">
          {{ enabledAlertCount }}
        </p>
        <span class="text-[10px] text-slate-400">覆盖 {{ coveredSecurityCount }} 只证券</span>
      </div>
    </div>

    <div class="surface-card px-4 py-3.5">
      <p class="text-[10px] font-medium text-slate-400">
        Provider 延迟
      </p>
      <div class="mt-2 flex items-end justify-between">
        <p class="text-xl font-semibold text-slate-900 tabular-number">
          {{ formattedLatency }}<span class="ml-1 text-xs font-medium text-slate-400">ms</span>
        </p>
        <span
          class="text-[10px]"
          :class="latencyTone"
        >{{ latencyLabel }}</span>
      </div>
    </div>
  </div>
</template>
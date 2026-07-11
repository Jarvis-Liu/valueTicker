<script setup lang="ts">
defineProps<{
  delayedCount: number
  enabledAlertCount: number
  coveredSecurityCount: number
  providerLatency: number
}>()
</script>

<template>
  <div class="grid gap-3 sm:grid-cols-3">
    <div class="surface-card px-4 py-3.5">
      <p class="text-[10px] font-medium text-slate-400">
        行情健康度
      </p>
      <div class="mt-2 flex items-end justify-between">
        <p class="text-xl font-semibold text-slate-900 tabular-number">
          87.5%
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
          {{ providerLatency }}<span class="ml-1 text-xs font-medium text-slate-400">ms</span>
        </p>
        <span class="text-[10px] text-emerald-600">连接稳定</span>
      </div>
    </div>
  </div>
</template>

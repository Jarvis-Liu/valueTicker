<script setup lang="ts">
import { IconCalendarEvent } from '@tabler/icons-vue'
import { getMarketSessionState } from '~/utils/market-calendar'

defineProps<{
  lastUpdatedAt: string
}>()

const now = ref(new Date())
const marketSession = computed(() => getMarketSessionState(now.value))
let clockTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  clockTimer = setInterval(() => { now.value = new Date() }, 1000)
})

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer)
})
</script>

<template>
  <div class="flex flex-col gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3.5 py-2.5 text-[11px] text-emerald-900 sm:flex-row sm:items-center sm:justify-between">
    <p class="flex items-center gap-2">
      <IconCalendarEvent
        :size="15"
        class="shrink-0 text-emerald-700"
      />
      交易日历{{ marketSession.isCalendarCalibrated ? '已校准' : '未校准（按工作日判断）' }} · 当前{{ marketSession.label }}
    </p>
    <p class="text-emerald-700/70">
      行情数据 · 最后更新 {{ lastUpdatedAt }}
    </p>
  </div>
</template>

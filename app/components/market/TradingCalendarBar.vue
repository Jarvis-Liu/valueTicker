<script setup lang="ts">
import { IconCalendarEvent } from '@tabler/icons-vue'

defineProps<{
  lastUpdatedAt: string
}>()
</script>

<template>
  <div class="mb-4 flex flex-col gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3.5 py-2.5 text-[11px] text-emerald-900 sm:flex-row sm:items-center sm:justify-between">
    <p class="flex items-center gap-2">
      <IconCalendarEvent
        :size="15"
        class="shrink-0 text-emerald-700"
      />
      交易日历已校准：2026 年 · 当前处于连续竞价时段
    </p>
    <p class="text-emerald-700/70">
      行情数据 · 最后更新 {{ lastUpdatedAt }}
    </p>
  </div>
</template>

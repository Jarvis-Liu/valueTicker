<script setup lang="ts">
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconBellRinging,
  IconChartLine,
  IconClockHour4
} from '@tabler/icons-vue'
import type { AlertNotification } from '~/types/market'

defineProps<{
  notifications: AlertNotification[]
}>()

const indices = [
  { name: '上证指数', value: '3,487.32', change: '+0.62%', up: true },
  { name: '深证成指', value: '10,842.91', change: '+0.38%', up: true },
  { name: '创业板指', value: '2,174.53', change: '-0.21%', up: false }
]
</script>

<template>
  <aside class="space-y-4">
    <section class="surface-card overflow-hidden">
      <div class="flex items-center justify-between border-b border-slate-100 px-4 py-4">
        <div class="flex items-center gap-2">
          <span class="grid h-8 w-8 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
            <IconChartLine :size="17" />
          </span>
          <div>
            <h2 class="text-[13px] font-semibold text-slate-900">
              市场概览
            </h2>
            <p class="mt-0.5 text-[10px] text-slate-400">
              A 股主要指数
            </p>
          </div>
        </div>
        <span class="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700">交易中</span>
      </div>
      <div class="divide-y divide-slate-100 px-4">
        <div
          v-for="item in indices"
          :key="item.name"
          class="flex items-center justify-between py-3.5"
        >
          <div>
            <p class="text-xs text-slate-500">
              {{ item.name }}
            </p>
            <p class="mt-1 text-sm font-semibold text-slate-900 tabular-number">
              {{ item.value }}
            </p>
          </div>
          <span
            class="inline-flex items-center gap-0.5 text-xs font-semibold tabular-number"
            :class="item.up ? 'text-rose-600' : 'text-emerald-600'"
          >
            <IconArrowUpRight
              v-if="item.up"
              :size="15"
            />
            <IconArrowDownRight
              v-else
              :size="15"
            />
            {{ item.change }}
          </span>
        </div>
      </div>
      <div class="mx-4 mb-4 rounded-xl bg-[#f4f8f6] px-3 py-3">
        <div class="flex items-center justify-between text-[10px] text-slate-400">
          <span>自选表现</span>
          <span>上涨 5 · 下跌 2 · 平 1</span>
        </div>
        <div class="mt-2 flex h-1.5 overflow-hidden rounded-full bg-slate-200">
          <span class="w-[62%] bg-rose-400" />
          <span class="w-[25%] bg-emerald-400" />
          <span class="flex-1 bg-slate-300" />
        </div>
      </div>
    </section>

    <section class="surface-card overflow-hidden">
      <div class="flex items-center justify-between border-b border-slate-100 px-4 py-4">
        <div class="flex items-center gap-2">
          <span class="grid h-8 w-8 place-items-center rounded-lg bg-amber-50 text-amber-600">
            <IconBellRinging :size="17" />
          </span>
          <div>
            <h2 class="text-[13px] font-semibold text-slate-900">
              提醒动态
            </h2>
            <p class="mt-0.5 text-[10px] text-slate-400">
              今日已触发 3 次
            </p>
          </div>
        </div>
        <button
          type="button"
          class="text-[11px] font-medium text-emerald-700 hover:text-emerald-900"
        >
          全部
        </button>
      </div>
      <div class="divide-y divide-slate-100 px-4">
        <article
          v-for="notice in notifications"
          :key="notice.id"
          class="py-3.5"
        >
          <div class="flex gap-3">
            <span
              class="mt-1.5 h-2 w-2 shrink-0 rounded-full"
              :class="notice.tone === 'up' ? 'bg-rose-400' : notice.tone === 'down' ? 'bg-emerald-400' : 'bg-indigo-400'"
            />
            <div class="min-w-0 flex-1">
              <p class="truncate text-xs font-semibold text-slate-800">
                {{ notice.title }}
              </p>
              <p class="mt-1 text-[11px] leading-4 text-slate-500">
                {{ notice.detail }}
              </p>
              <p class="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400">
                <IconClockHour4 :size="12" />
                {{ notice.time }}
              </p>
            </div>
          </div>
        </article>
      </div>
    </section>
  </aside>
</template>

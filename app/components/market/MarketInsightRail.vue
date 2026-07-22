<script setup lang="ts">
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconBellRinging,
  IconChartLine,
  IconClockHour4
} from '@tabler/icons-vue'
import { MARKET_INDEX_SECURITIES } from '~/utils/market-indices'
import type { NormalizedQuote } from '~/services/quotes/types'
import type { AlertNotification, SecurityQuote } from '~/types/market'

const props = defineProps<{
  notifications: AlertNotification[]
  indexQuotes: NormalizedQuote[]
  watchlistQuotes: SecurityQuote[]
}>()

const indices = computed(() => {
  const quotesById = new Map(props.indexQuotes.map(quote => [quote.securityId, quote]))
  return MARKET_INDEX_SECURITIES.map((security) => {
    const quote = quotesById.get(security.securityId)
    return {
      securityId: security.securityId,
      name: security.name,
      value: formatIndexValue(quote?.price),
      change: formatSignedPercent(quote?.changePercent),
      up: Number.isFinite(quote?.changePercent) ? quote!.changePercent >= 0 : null,
      updatedAt: quote?.updatedAt ?? '待更新'
    }
  })
})

const hasLiveIndexQuote = computed(() => props.indexQuotes.length > 0)

const watchlistPerformance = computed(() => {
  let up = 0
  let down = 0
  let flat = 0
  let pending = 0

  for (const quote of props.watchlistQuotes) {
    const value = Number.isFinite(quote.changePercent) ? quote.changePercent : quote.change
    if (!Number.isFinite(value)) pending += 1
    else if (value > 0) up += 1
    else if (value < 0) down += 1
    else flat += 1
  }

  const total = up + down + flat + pending
  return {
    up,
    down,
    flat,
    pending,
    total,
    upWidth: percent(up, total),
    downWidth: percent(down, total),
    flatWidth: percent(flat + pending, total)
  }
})

const watchlistPerformanceText = computed(() => {
  const performance = watchlistPerformance.value
  const pendingText = performance.pending > 0 ? ` · 待更新 ${performance.pending}` : ''
  return `上涨 ${performance.up} · 下跌 ${performance.down} · 平 ${performance.flat}${pendingText}`
})

function formatIndexValue(value: number | undefined) {
  return Number.isFinite(value) ? value!.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--'
}

function formatSignedPercent(value: number | undefined) {
  if (!Number.isFinite(value)) return '--'
  return `${value! > 0 ? '+' : ''}${value!.toFixed(2)}%`
}

function percent(value: number, total: number) {
  if (total <= 0) return '0%'
  return `${(value / total) * 100}%`
}
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
        <span
          class="rounded-md px-2 py-1 text-[10px] font-medium"
          :class="hasLiveIndexQuote ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'"
        >{{ hasLiveIndexQuote ? '已接入' : '待更新' }}</span>
      </div>
      <div class="max-h-[480px] divide-y divide-slate-100 overflow-y-auto px-4">
        <div
          v-for="item in indices"
          :key="item.securityId"
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
            :class="item.up === null ? 'text-slate-400' : item.up ? 'text-rose-600' : 'text-emerald-600'"
            :title="`更新时间：${item.updatedAt}`"
          >
            <IconArrowUpRight
              v-if="item.up === true"
              :size="15"
            />
            <IconArrowDownRight
              v-else-if="item.up === false"
              :size="15"
            />
            {{ item.change }}
          </span>
        </div>
      </div>
      <div class="mx-4 mb-4 rounded-xl bg-[#f4f8f6] px-3 py-3">
        <div class="flex items-center justify-between gap-3 text-[10px] text-slate-400">
          <span>自选表现</span>
          <span class="text-right tabular-number">{{ watchlistPerformanceText }}</span>
        </div>
        <div class="mt-2 flex h-1.5 overflow-hidden rounded-full bg-slate-200">
          <span
            class="bg-rose-400"
            :style="{ width: watchlistPerformance.upWidth }"
          />
          <span
            class="bg-emerald-400"
            :style="{ width: watchlistPerformance.downWidth }"
          />
          <span
            class="bg-slate-300"
            :style="{ width: watchlistPerformance.flatWidth }"
          />
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
              今日已触发 {{ notifications.length }} 次
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
        <div
          v-if="notifications.length === 0"
          class="py-8 text-center text-xs text-slate-400"
        >
          暂无触发提醒
        </div>
      </div>
    </section>
  </aside>
</template>
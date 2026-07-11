<script setup lang="ts">
import {
  IconActivityHeartbeat,
  IconBell,
  IconChevronDown,
  IconPlayerPause,
  IconPlayerPlay,
  IconRefresh
} from '@tabler/icons-vue'

defineProps<{
  paused: boolean
  refreshing: boolean
}>()

defineEmits<{
  toggle: []
  refresh: []
}>()
</script>

<template>
  <header class="border-b border-white/10 bg-[#0b2420] text-white">
    <div class="mx-auto flex h-[72px] max-w-[1680px] items-center gap-4 px-4 sm:px-6">
      <div class="flex min-w-0 items-center gap-3 lg:w-[224px]">
        <div class="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-400 text-[#08211d] shadow-lg shadow-emerald-950/20">
          <IconActivityHeartbeat
            :size="23"
            :stroke-width="2.2"
          />
          <span class="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0b2420] bg-emerald-300" />
        </div>
        <div class="min-w-0">
          <p class="truncate text-[15px] font-semibold tracking-wide">
            ValueTicker
          </p>
          <p class="truncate text-[11px] tracking-[0.15em] text-emerald-100/55">
            MARKET MONITOR
          </p>
        </div>
      </div>

      <div class="hidden h-8 w-px bg-white/10 lg:block" />

      <div class="hidden min-w-0 flex-1 items-center gap-6 lg:flex">
        <div class="flex items-center gap-2">
          <span
            class="status-pulse h-2 w-2 rounded-full"
            :class="paused ? 'bg-amber-300' : 'bg-emerald-400'"
          />
          <div>
            <p class="text-xs font-medium">
              {{ paused ? '监测已暂停' : '实时监测中' }}
            </p>
            <p class="mt-0.5 text-[11px] text-slate-400">
              {{ paused ? '行情快照保持不变' : '前台 · 5 秒轮询' }}
            </p>
          </div>
        </div>
        <div class="h-7 w-px bg-white/10" />
        <div>
          <p class="text-[11px] text-slate-400">
            当前数据源
          </p>
          <p class="mt-0.5 flex items-center gap-1 text-xs font-medium">
            腾讯行情
            <IconChevronDown
              :size="14"
              class="text-slate-500"
            />
          </p>
        </div>
        <div>
          <p class="text-[11px] text-slate-400">
            最近更新
          </p>
          <p class="mt-0.5 text-xs font-medium tabular-number">
            10:26:35
          </p>
        </div>
      </div>

      <div class="ml-auto flex items-center gap-2">
        <button
          type="button"
          class="hidden h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-medium text-slate-200 transition hover:bg-white/10 sm:inline-flex"
          :disabled="refreshing"
          @click="$emit('refresh')"
        >
          <IconRefresh
            :size="16"
            :class="refreshing && 'animate-spin'"
          />
          {{ refreshing ? '刷新中' : '手动刷新' }}
        </button>
        <button
          type="button"
          class="inline-flex h-9 items-center gap-2 rounded-xl bg-emerald-400 px-3.5 text-xs font-semibold text-[#08211d] transition hover:bg-emerald-300"
          @click="$emit('toggle')"
        >
          <IconPlayerPlay
            v-if="paused"
            :size="16"
            fill="currentColor"
          />
          <IconPlayerPause
            v-else
            :size="16"
            fill="currentColor"
          />
          {{ paused ? '继续' : '暂停' }}
        </button>
        <button
          type="button"
          class="relative grid h-9 w-9 place-items-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white"
          aria-label="查看通知"
        >
          <IconBell :size="19" />
          <span class="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-[#0b2420] bg-rose-400" />
        </button>
        <button
          type="button"
          class="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-slate-100 to-slate-300 text-xs font-bold text-slate-700"
          aria-label="用户菜单"
        >
          VT
        </button>
      </div>
    </div>
  </header>
</template>

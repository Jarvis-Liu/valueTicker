<script setup lang="ts">
import {
  IconActivityHeartbeat,
  IconBell,
  IconChevronDown,
  IconPlayerPause,
  IconPlayerPlay,
  IconRefresh
} from '@tabler/icons-vue'
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/vue'
import type { MonitorStatus, QuoteProvider } from '~/services/quotes/types'

const props = defineProps<{
  paused: boolean
  refreshing: boolean
  status: MonitorStatus
  provider: QuoteProvider
  pollingIntervalMs: number
  lastUpdatedAt: string
}>()

const emit = defineEmits<{
  toggle: []
  refresh: []
  providerChange: [provider: QuoteProvider]
}>()

const providerOptions: Array<{ label: string, value: QuoteProvider }> = [
  { label: '东财行情', value: 'EASTMONEY' },
  { label: '腾讯行情', value: 'TENCENT' }
]
const selectedProviderLabel = computed(() => {
  return providerOptions.find(option => option.value === props.provider)?.label ?? '行情源'
})

function changeProvider(provider: QuoteProvider) {
  emit('providerChange', provider)
}
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
              {{ paused ? '监测已暂停' : status === 'ERROR' ? '行情请求异常' : status === 'STALE' ? '行情数据延迟' : status === 'RUNNING' ? '实时监测中' : '监测未启动' }}
            </p>
            <p class="mt-0.5 text-[11px] text-slate-400">
              {{ status === 'ERROR' ? '请检查 Worker 或行情源' : paused ? '行情快照保持不变' : status === 'RUNNING' ? `前台 · ${pollingIntervalMs / 1000} 秒轮询` : '等待行情订阅' }}
            </p>
          </div>
        </div>
        <div class="h-7 w-px bg-white/10" />
        <div>
          <p class="text-[11px] text-slate-400">
            当前数据源
          </p>
          <Listbox
            :model-value="provider"
            @update:model-value="changeProvider"
          >
            <div class="relative mt-1">
              <ListboxButton class="group relative flex h-8 w-[128px] items-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.06] pl-6 pr-8 text-left text-xs font-semibold text-white shadow-inner shadow-white/5 outline-none transition hover:border-emerald-300/40 hover:bg-white/[0.09] focus-visible:border-emerald-300/60 focus-visible:ring-2 focus-visible:ring-emerald-300/15">
                <span class="pointer-events-none absolute left-2.5 h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.8)]" />
                <span class="block truncate">{{ selectedProviderLabel }}</span>
                <span class="pointer-events-none absolute right-0 top-0 h-full w-7 bg-gradient-to-l from-[#0b2420] via-[#0b2420]/90 to-transparent" />
                <IconChevronDown
                  :size="14"
                  class="pointer-events-none absolute right-2 text-emerald-100/70 transition group-hover:text-emerald-100"
                />
              </ListboxButton>

              <Transition
                enter-active-class="transition duration-150 ease-out"
                enter-from-class="-translate-y-1 opacity-0"
                enter-to-class="translate-y-0 opacity-100"
                leave-active-class="transition duration-100 ease-in"
                leave-from-class="translate-y-0 opacity-100"
                leave-to-class="-translate-y-1 opacity-0"
              >
                <ListboxOptions class="absolute left-0 top-[calc(100%+8px)] z-[80] w-[148px] overflow-hidden rounded-xl border border-emerald-300/15 bg-[#102f2a] p-1 shadow-2xl shadow-slate-950/30 outline-none ring-1 ring-white/5">
                  <ListboxOption
                    v-for="option in providerOptions"
                    :key="option.value"
                    v-slot="{ active, selected }"
                    :value="option.value"
                    as="template"
                  >
                    <li
                      class="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold transition"
                      :class="[
                        active ? 'bg-emerald-300/12 text-white' : 'text-emerald-50/80',
                        selected && 'text-emerald-200'
                      ]"
                    >
                      <span
                        class="h-1.5 w-1.5 rounded-full"
                        :class="selected ? 'bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.8)]' : 'bg-white/20'"
                      />
                      <span class="min-w-0 flex-1 truncate">{{ option.label }}</span>
                    </li>
                  </ListboxOption>
                </ListboxOptions>
              </Transition>
            </div>
          </Listbox>
        </div>
        <div>
          <p class="text-[11px] text-slate-400">
            最近更新
          </p>
          <p class="mt-0.5 text-xs font-medium tabular-number">
            {{ lastUpdatedAt }}
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

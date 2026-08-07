<script setup lang="ts">
import {
  Dialog,
  DialogDescription,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot
} from '@headlessui/vue'
import { IconHelpCircle, IconInfoCircle, IconX } from '@tabler/icons-vue'
import type { SignalType } from 'stock-sdk'
import { CHIP_SIGNAL_DEFINITIONS } from '~/utils/chip-signals'

const open = ref(false)

const signalGroups: Array<{ title: string, description: string, types: SignalType[] }> = [
  {
    title: '交叉信号',
    description: '比较两条指标线的相对位置变化。',
    types: [
      'ma_golden_cross',
      'ma_death_cross',
      'macd_golden_cross',
      'macd_death_cross',
      'kdj_golden_cross',
      'kdj_death_cross'
    ]
  },
  {
    title: '超买与超卖',
    description: '描述动量指标所处区间，不等同于反转确认。',
    types: ['kdj_overbought', 'kdj_oversold', 'rsi_overbought', 'rsi_oversold']
  },
  {
    title: '突破与反转',
    description: '观察价格突破波动区间或趋势方向发生变化。',
    types: ['boll_break_upper', 'boll_break_lower', 'sar_reversal_up', 'sar_reversal_down']
  }
]
</script>

<template>
  <button
    type="button"
    class="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
    title="查看技术信号说明"
    aria-label="查看技术信号说明"
    @click="open = true"
  >
    <IconHelpCircle :size="15" />
  </button>

  <TransitionRoot
    as="template"
    :show="open"
  >
    <Dialog
      class="relative z-[110]"
      @close="open = false"
    >
      <TransitionChild
        as="template"
        enter="ease-out duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-150"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px]" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-y-auto p-3 sm:p-6">
        <div class="flex min-h-full items-center justify-center">
          <TransitionChild
            as="template"
            enter="ease-out duration-200"
            enter-from="translate-y-2 scale-95 opacity-0"
            enter-to="translate-y-0 scale-100 opacity-100"
            leave="ease-in duration-150"
            leave-from="translate-y-0 scale-100 opacity-100"
            leave-to="translate-y-2 scale-95 opacity-0"
          >
            <DialogPanel class="flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div class="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-5">
                <div class="flex items-start gap-3">
                  <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                    <IconInfoCircle :size="21" />
                  </span>
                  <div>
                    <DialogTitle class="text-sm font-semibold text-slate-900">
                      技术信号说明
                    </DialogTitle>
                    <DialogDescription class="mt-1 text-xs leading-5 text-slate-500">
                      这些标记用于描述指标变化，不代表确定的买入或卖出结论。
                    </DialogDescription>
                  </div>
                </div>
                <button
                  type="button"
                  class="icon-button shrink-0"
                  aria-label="关闭技术信号说明"
                  @click="open = false"
                >
                  <IconX :size="18" />
                </button>
              </div>

              <div class="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
                <section
                  v-for="group in signalGroups"
                  :key="group.title"
                >
                  <div>
                    <h3 class="text-xs font-semibold text-slate-800">
                      {{ group.title }}
                    </h3>
                    <p class="mt-1 text-[11px] leading-4 text-slate-400">
                      {{ group.description }}
                    </p>
                  </div>
                  <div class="mt-2 grid gap-2 sm:grid-cols-2">
                    <div
                      v-for="type in group.types"
                      :key="type"
                      class="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-3"
                    >
                      <div class="flex items-center justify-between gap-3">
                        <span class="text-xs font-semibold text-slate-800">
                          {{ CHIP_SIGNAL_DEFINITIONS[type].label }}
                        </span>
                        <span
                          class="min-w-[4.5rem] shrink-0 rounded-full px-2.5 py-1 text-center text-[11px] font-semibold leading-none sm:text-xs"
                          :class="CHIP_SIGNAL_DEFINITIONS[type].direction === 'BULLISH'
                            ? 'bg-rose-50 text-rose-600'
                            : 'bg-emerald-50 text-emerald-700'"
                        >
                          {{ CHIP_SIGNAL_DEFINITIONS[type].direction === 'BULLISH' ? '偏强观察' : '偏弱观察' }}
                        </span>
                      </div>
                      <p class="mt-1.5 text-[11px] leading-5 text-slate-500">
                        {{ CHIP_SIGNAL_DEFINITIONS[type].description }}
                      </p>
                    </div>
                  </div>
                </section>

                <div class="rounded-xl border border-amber-100 bg-amber-50 px-3 py-3 text-[11px] leading-5 text-amber-800">
                  技术指标可能出现滞后、钝化或假突破。当日信号会随盘中价格变化，收盘后才形成最终日线结果。
                </div>
              </div>

              <div class="border-t border-slate-100 px-4 py-3 sm:px-6">
                <button
                  type="button"
                  class="h-9 w-full rounded-xl bg-slate-900 text-xs font-semibold text-white transition hover:bg-slate-800"
                  @click="open = false"
                >
                  我知道了
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

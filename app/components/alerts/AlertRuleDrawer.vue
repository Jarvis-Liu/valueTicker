<script setup lang="ts">
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot
} from '@headlessui/vue'
import {
  IconBellRinging,
  IconCheck,
  IconInfoCircle,
  IconX
} from '@tabler/icons-vue'
import type { SecurityQuote } from '~/types/market'

const props = defineProps<{
  open: boolean
  quote: SecurityQuote | null
}>()

const emit = defineEmits<{
  close: []
  save: []
}>()

const selectedRule = ref<'PRICE_UPPER' | 'PRICE_LOWER' | 'CHANGE_UPPER' | 'CHANGE_LOWER'>('PRICE_UPPER')
const targetValue = ref(0)
const note = ref('')

const ruleOptions = [
  { id: 'PRICE_UPPER' as const, name: '价格涨至', hint: '向上穿越目标价时提醒' },
  { id: 'PRICE_LOWER' as const, name: '价格跌至', hint: '向下穿越目标价时提醒' },
  { id: 'CHANGE_UPPER' as const, name: '涨幅超过', hint: '日涨幅突破目标时提醒' },
  { id: 'CHANGE_LOWER' as const, name: '跌幅超过', hint: '日跌幅突破目标时提醒' }
]

watch(() => props.quote, (quote) => {
  if (quote) targetValue.value = Number((quote.price * 1.03).toFixed(quote.securityType === 'ETF' ? 3 : 2))
})

function save() {
  emit('save')
  emit('close')
}
</script>

<template>
  <TransitionRoot
    as="template"
    :show="open"
  >
    <Dialog
      class="relative z-50"
      @close="$emit('close')"
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
        <div class="fixed inset-0 bg-slate-950/35 backdrop-blur-[2px]" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-hidden">
        <div class="absolute inset-0 overflow-hidden">
          <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-4 sm:pl-10">
            <TransitionChild
              as="template"
              enter="transform transition ease-out duration-300"
              enter-from="translate-x-full"
              enter-to="translate-x-0"
              leave="transform transition ease-in duration-200"
              leave-from="translate-x-0"
              leave-to="translate-x-full"
            >
              <DialogPanel class="pointer-events-auto w-screen max-w-md">
                <div class="flex h-full flex-col bg-white shadow-2xl">
                  <div class="border-b border-slate-100 px-5 py-5 sm:px-6">
                    <div class="flex items-start justify-between gap-4">
                      <div class="flex items-center gap-3">
                        <span class="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                          <IconBellRinging :size="21" />
                        </span>
                        <div>
                          <DialogTitle class="text-base font-semibold text-slate-950">
                            设置价格提醒
                          </DialogTitle>
                          <p
                            v-if="quote"
                            class="mt-1 text-xs text-slate-500"
                          >
                            {{ quote.name }} · {{ quote.code }}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        class="icon-button"
                        aria-label="关闭"
                        @click="$emit('close')"
                      >
                        <IconX :size="18" />
                      </button>
                    </div>
                  </div>

                  <div class="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                    <div
                      v-if="quote"
                      class="mb-6 flex items-end justify-between rounded-2xl bg-[#0f332c] px-4 py-4 text-white"
                    >
                      <div>
                        <p class="text-[11px] text-emerald-100/60">
                          当前价格
                        </p>
                        <p class="mt-1 text-2xl font-semibold tabular-number">
                          {{ quote.price.toFixed(quote.securityType === 'ETF' ? 3 : 2) }}
                        </p>
                      </div>
                      <p
                        class="text-sm font-semibold tabular-number"
                        :class="quote.change >= 0 ? 'text-rose-300' : 'text-emerald-300'"
                      >
                        {{ quote.change >= 0 ? '+' : '' }}{{ quote.changePercent.toFixed(2) }}%
                      </p>
                    </div>

                    <fieldset>
                      <legend class="mb-3 text-xs font-semibold text-slate-700">
                        提醒条件
                      </legend>
                      <div class="grid grid-cols-2 gap-2.5">
                        <button
                          v-for="option in ruleOptions"
                          :key="option.id"
                          type="button"
                          class="relative rounded-xl border p-3 text-left transition"
                          :class="selectedRule === option.id ? 'border-emerald-400 bg-emerald-50/70' : 'border-slate-200 hover:border-slate-300'"
                          @click="selectedRule = option.id"
                        >
                          <span
                            class="block text-xs font-semibold"
                            :class="selectedRule === option.id ? 'text-emerald-900' : 'text-slate-700'"
                          >{{ option.name }}</span>
                          <span class="mt-1 block text-[10px] leading-4 text-slate-400">{{ option.hint }}</span>
                          <span
                            v-if="selectedRule === option.id"
                            class="absolute right-2 top-2 grid h-4 w-4 place-items-center rounded-full bg-emerald-600 text-white"
                          >
                            <IconCheck
                              :size="11"
                              :stroke-width="3"
                            />
                          </span>
                        </button>
                      </div>
                    </fieldset>

                    <label class="mt-5 block">
                      <span class="text-xs font-semibold text-slate-700">目标值</span>
                      <div class="relative mt-2">
                        <input
                          v-model.number="targetValue"
                          type="number"
                          min="0"
                          step="0.01"
                          class="h-11 w-full rounded-xl border border-slate-200 px-3 pr-12 text-sm font-semibold text-slate-900 tabular-number focus:border-emerald-400 focus:outline-none"
                        >
                        <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{{ selectedRule.startsWith('PRICE') ? '元' : '%' }}</span>
                      </div>
                    </label>

                    <label class="mt-5 block">
                      <span class="text-xs font-semibold text-slate-700">提醒备注 <span class="font-normal text-slate-400">（可选）</span></span>
                      <input
                        v-model="note"
                        type="text"
                        maxlength="50"
                        class="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none"
                        placeholder="例如：突破后观察成交量"
                      >
                      <span class="mt-1.5 block text-right text-[10px] text-slate-400">{{ note.length }}/50</span>
                    </label>

                    <div class="mt-5 grid grid-cols-2 gap-3">
                      <label>
                        <span class="text-xs font-semibold text-slate-700">冷却时间</span>
                        <select class="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:border-emerald-400 focus:outline-none">
                          <option>5 分钟</option>
                          <option>10 分钟</option>
                          <option>30 分钟</option>
                        </select>
                      </label>
                      <label>
                        <span class="text-xs font-semibold text-slate-700">单日最多</span>
                        <select class="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:border-emerald-400 focus:outline-none">
                          <option>3 次</option>
                          <option>1 次</option>
                          <option>5 次</option>
                        </select>
                      </label>
                    </div>

                    <div class="mt-6 flex gap-2 rounded-xl bg-slate-50 px-3 py-3 text-slate-500">
                      <IconInfoCircle
                        :size="17"
                        class="mt-0.5 shrink-0"
                      />
                      <p class="text-[11px] leading-4">
                        只有行情从阈值一侧穿越到另一侧时才会提醒，持续停留不会重复触发。
                      </p>
                    </div>
                  </div>

                  <div class="flex gap-3 border-t border-slate-100 px-5 py-4 sm:px-6">
                    <button
                      type="button"
                      class="h-10 flex-1 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                      @click="$emit('close')"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      class="h-10 flex-1 rounded-xl bg-emerald-600 text-xs font-semibold text-white transition hover:bg-emerald-700"
                      @click="save"
                    >
                      保存并开启
                    </button>
                  </div>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

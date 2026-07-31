<script setup lang="ts">
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue'
import { IconChartLine, IconDatabase, IconX } from '@tabler/icons-vue'
import type { SecurityIntradayTrend } from '~/services/quotes/types'
import type { IntradayTrendTarget } from '~/types/market'
import InteractiveIntradayChart from './InteractiveIntradayChart.vue'

const props = defineProps<{
  open: boolean
  target: IntradayTrendTarget | null
  trend: SecurityIntradayTrend | undefined
}>()
const emit = defineEmits<{ close: [] }>()

const pricePrecision = computed<2 | 3>(() => props.target?.securityType === 'ETF' ? 3 : 2)
const latestPrice = computed(() => {
  for (let index = (props.trend?.points.length ?? 0) - 1; index >= 0; index -= 1) {
    const price = props.trend?.points[index]?.price
    if (Number.isFinite(price)) return price!
  }
  return null
})
const change = computed(() => {
  if (!Number.isFinite(latestPrice.value) || !Number.isFinite(props.trend?.previousClose) || !props.trend?.previousClose) return null
  const value = latestPrice.value! - props.trend.previousClose
  return { value, percent: value / props.trend.previousClose * 100 }
})
/** 高低价以清洗后的有效分钟价格计算，确保不同趋势 Provider 的口径一致。 */
const dailyPriceRange = computed(() => {
  const prices = (props.trend?.points ?? []).map(point => point.price).filter((price): price is number => Number.isFinite(price))
  if (!prices.length) return null
  return { high: Math.max(...prices), low: Math.min(...prices) }
})
const toneClass = computed(() => change.value?.value && change.value.value < 0 ? 'text-emerald-600' : 'text-rose-600')
const providerName = computed(() => props.trend?.provider === 'EASTMONEY' ? '东方财富' : '腾讯')
const hasData = computed(() => props.trend?.status === 'READY' && latestPrice.value !== null)

function formatUpdatedAt(value: string | undefined) {
  if (!value) return '待更新'
  const matched = value.match(/(\d{2}:\d{2})(?::\d{2})?$/)
  return matched?.[1] ?? value
}
</script>

<template>
  <TransitionRoot
    as="template"
    :show="open"
  >
    <Dialog
      class="relative z-[80]"
      @close="emit('close')"
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
      <div class="fixed inset-0 overflow-y-auto sm:grid sm:place-items-center sm:p-5">
        <TransitionChild
          as="template"
          enter="ease-out duration-200"
          enter-from="translate-y-3 opacity-0 sm:scale-95"
          enter-to="translate-y-0 opacity-100 sm:scale-100"
          leave="ease-in duration-150"
          leave-from="translate-y-0 opacity-100 sm:scale-100"
          leave-to="translate-y-3 opacity-0 sm:scale-95"
        >
          <DialogPanel class="flex min-h-full w-full flex-col bg-white shadow-2xl sm:min-h-0 sm:max-w-5xl sm:overflow-hidden sm:rounded-2xl">
            <div class="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-5">
              <div class="flex min-w-0 items-center gap-2.5">
                <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><IconChartLine :size="19" /></span><div class="min-w-0">
                  <DialogTitle class="truncate text-base font-semibold text-slate-950">
                    {{ target?.name ?? '分时详情' }}
                  </DialogTitle><p class="mt-0.5 text-xs text-slate-400 tabular-number">
                    {{ target?.code ?? '--' }} · 当日分时
                  </p>
                </div>
              </div>
              <button
                type="button"
                class="icon-button mt-0.5 shrink-0"
                aria-label="关闭分时详情"
                @click="emit('close')"
              >
                <IconX :size="18" />
              </button>
            </div>
            <div class="grid gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:px-6">
              <div class="flex items-end gap-3">
                <p class="text-2xl font-semibold text-slate-950 tabular-number">
                  {{ latestPrice?.toFixed(pricePrecision) ?? '--' }}
                </p><p
                  class="pb-0.5 text-sm font-semibold tabular-number"
                  :class="toneClass"
                >
                  {{ change ? `${change.value >= 0 ? '+' : ''}${change.value.toFixed(pricePrecision)} · ${change.percent >= 0 ? '+' : ''}${change.percent.toFixed(2)}%` : '--' }}
                </p>
              </div>
              <div class="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                <span>最高 <strong class="ml-1 font-semibold text-rose-600 tabular-number">{{ dailyPriceRange?.high.toFixed(pricePrecision) ?? '--' }}</strong></span><span>最低 <strong class="ml-1 font-semibold text-emerald-600 tabular-number">{{ dailyPriceRange?.low.toFixed(pricePrecision) ?? '--' }}</strong></span><span>昨收 <strong class="ml-1 font-semibold text-slate-700 tabular-number">{{ Number.isFinite(trend?.previousClose) ? trend!.previousClose.toFixed(pricePrecision) : '--' }}</strong></span><span class="inline-flex items-center gap-1"><IconDatabase :size="13" />{{ providerName }} · {{ formatUpdatedAt(trend?.updatedAt) }}</span>
              </div>
            </div>
            <div class="relative flex-1 px-2 py-2 sm:px-4 sm:py-4">
              <InteractiveIntradayChart
                v-if="hasData"
                :trend="trend"
                :price-precision="pricePrecision"
              /><div
                v-else
                class="grid min-h-[360px] place-items-center text-center"
              >
                <div>
                  <p class="text-sm font-semibold text-slate-700">
                    {{ trend?.status === 'ERROR' ? '分时数据暂不可用' : '暂无有效分时数据' }}
                  </p><p class="mt-1 text-xs text-slate-400">
                    可使用顶部手动刷新获取最新分时数据
                  </p>
                </div>
              </div>
            </div>
            <div class="border-t border-slate-100 px-4 py-3 text-[11px] text-slate-400 sm:px-6">
              价格线以昨收为中心对称缩放，并标注当日最高/最低；可拖拽平移、滚轮或双指缩放，并悬停查看分钟数据。
            </div>
          </DialogPanel>
        </TransitionChild>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

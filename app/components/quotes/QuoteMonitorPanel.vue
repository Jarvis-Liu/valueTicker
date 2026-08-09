<script setup lang="ts">
import {
  IconAdjustmentsHorizontal,
  IconArrowsSort,
  IconBellRinging,
  IconDots,
  IconPlus,
  IconSearch,
  IconSortAscending,
  IconSortDescending
} from '@tabler/icons-vue'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
import { VueDraggable } from 'vue-draggable-plus'
import type { SecurityQuote } from '~/types/market'
import type { SecurityIntradayTrend } from '~/services/quotes/types'
import type { FundFlowRankEntry } from '~~/shared/types/fund-flow'
import ChipCostRangeCell from '~/components/chips/ChipCostRangeCell.vue'
import IntradayTrendSparkline from './IntradayTrendSparkline.vue'

const props = defineProps<{
  title: string
  quotes: SecurityQuote[]
  trends: Record<string, SecurityIntradayTrend>
  fundFlowRanks: Record<string, FundFlowRankEntry>
  fundFlowRankTotal: number
  canRemove: boolean
  pollingIntervalMs: number
}>()

const search = defineModel<string>('search', { default: '' })
// 该筛选仅决定表格显示，页面仍将完整证券集发送给 Worker 轮询和提醒。
const onlyAlerted = defineModel<boolean>('onlyAlerted', { default: false })
const menuPositions = reactive<Record<string, { top: string, left: string }>>({})
type ChangePercentSort = 'default' | 'descending' | 'ascending'
const changePercentSort = ref<ChangePercentSort>('default')

const emit = defineEmits<{
  alert: [quote: SecurityQuote]
  add: []
  remove: [quote: SecurityQuote]
  move: [quote: SecurityQuote]
  copy: [quote: SecurityQuote]
  reorder: [securityIds: string[]]
  trendOpen: [quote: SecurityQuote]
}>()

// 筛选或涨跌幅排序后的列表不能用于持久化拖拽，避免把临时展示顺序误写回完整分组。
const sortable = computed(() => props.canRemove && !search.value && !onlyAlerted.value && changePercentSort.value === 'default')
const displayedQuotes = computed(() => {
  if (changePercentSort.value === 'default') return props.quotes

  const direction = changePercentSort.value === 'descending' ? -1 : 1
  return props.quotes
    .map((quote, originalIndex) => ({ quote, originalIndex }))
    .sort((left, right) => {
      const leftValue = left.quote.changePercent
      const rightValue = right.quote.changePercent
      const leftValid = Number.isFinite(leftValue)
      const rightValid = Number.isFinite(rightValue)

      if (!leftValid && !rightValid) return left.originalIndex - right.originalIndex
      if (!leftValid) return 1
      if (!rightValid) return -1
      return (leftValue - rightValue) * direction || left.originalIndex - right.originalIndex
    })
    .map(item => item.quote)
})
const changePercentSortLabel = computed(() => {
  if (changePercentSort.value === 'descending') return '涨幅从高到低；点击切换为从低到高'
  if (changePercentSort.value === 'ascending') return '涨幅从低到高；点击恢复默认顺序'
  return '按涨跌幅排序；点击后涨幅从高到低'
})
const emptyMessage = computed(() => onlyAlerted.value ? '没有已开启提醒的证券' : search.value.trim() ? '没有匹配的证券' : '暂无证券')

function handleQuoteReorder(nextQuotes: SecurityQuote[]) {
  emit('reorder', nextQuotes.map(quote => quote.securityId))
}
function toggleChangePercentSort() {
  changePercentSort.value = changePercentSort.value === 'default'
    ? 'descending'
    : changePercentSort.value === 'descending' ? 'ascending' : 'default'
}
function positionMenu(securityId: string, event: MouseEvent) {
  const button = event.currentTarget as HTMLElement
  const rect = button.getBoundingClientRect()
  menuPositions[securityId] = {
    top: `${rect.bottom + 6}px`,
    left: `${Math.max(8, rect.right - 144)}px`
  }
}

function toneClass(value: number) {
  if (value > 0) return 'text-rose-600'
  if (value < 0) return 'text-emerald-600'
  return 'text-slate-600'
}

function signed(value: number, suffix = '') {
  if (!Number.isFinite(value)) return '--'
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}${suffix}`
}

function formatted(value: number, precision = 2) {
  return Number.isFinite(value) ? value.toFixed(precision) : '--'
}

function compactRank(rank: number) {
  if (rank < 1000) return `#${rank}`
  return `#${(rank / 1000).toFixed(rank < 10_000 ? 1 : 0)}k`
}

function rankTitle(code: string) {
  const entry = props.fundFlowRanks[code]
  if (!entry) return undefined
  const total = props.fundFlowRankTotal > 0 ? ` / 共 ${props.fundFlowRankTotal.toLocaleString('zh-CN')} 只` : ''
  return `主力净流入全市场第 ${entry.rank.toLocaleString('zh-CN')} 名${total}`
}

function formatQuoteTime(value: string) {
  const compactDateTime = value.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/)
  if (compactDateTime) return `${compactDateTime[1]}-${compactDateTime[2]}-${compactDateTime[3]} ${compactDateTime[4]}:${compactDateTime[5]}:${compactDateTime[6]}`

  const parsedDate = new Date(value)
  if (Number.isFinite(parsedDate.getTime())) return formatLocalDateTime(parsedDate)

  return value || '--'
}

function formatLocalDateTime(value: Date) {
  const year = value.getFullYear()
  const month = pad(value.getMonth() + 1)
  const day = pad(value.getDate())
  const hour = pad(value.getHours())
  const minute = pad(value.getMinutes())
  const second = pad(value.getSeconds())
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}
</script>

<template>
  <section class="surface-card min-w-0 overflow-hidden">
    <div class="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div>
        <div class="flex items-center gap-2.5">
          <h1 class="text-base font-semibold text-slate-950">
            {{ title }}
          </h1>
          <span class="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500">{{ quotes.length }} 只</span>
        </div>
        <p class="mt-1 text-xs text-slate-400">
          行情仅供参考，数据每 {{ pollingIntervalMs / 1000 }} 秒自动更新
        </p>
      </div>

      <div class="flex items-center gap-2">
        <label class="relative min-w-0 flex-1 sm:w-52">
          <IconSearch
            :size="17"
            class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            v-model="search"
            type="search"
            class="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus:outline-none"
            placeholder="搜索名称或代码"
          >
        </label>
        <Menu
          as="div"
          class="relative shrink-0"
        >
          <MenuButton
            type="button"
            class="icon-button border transition"
            :class="onlyAlerted ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-transparent'"
            :aria-label="onlyAlerted ? '筛选已启用：只看提醒' : '筛选行情'"
            :aria-pressed="onlyAlerted"
            title="筛选行情"
          >
            <IconAdjustmentsHorizontal :size="18" />
          </MenuButton>
          <MenuItems class="absolute right-0 top-[calc(100%+6px)] z-30 w-40 rounded-xl border border-slate-100 bg-white p-1.5 shadow-xl shadow-slate-900/10 focus:outline-none">
            <MenuItem v-slot="{ active }">
              <button
                type="button"
                class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-700"
                :class="active && 'bg-slate-50'"
                @click="onlyAlerted = !onlyAlerted"
              >
                <span
                  class="grid h-4 w-4 place-items-center rounded border text-[10px]"
                  :class="onlyAlerted ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white text-transparent'"
                >✓</span>
                只看提醒
              </button>
            </MenuItem>
          </MenuItems>
        </Menu>
        <button
          type="button"
          class="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[#123c34] px-3.5 text-xs font-semibold text-white transition hover:bg-[#0b2e28]"
          @click="$emit('add')"
        >
          <IconPlus :size="17" />
          <span class="hidden sm:inline">添加证券</span>
        </button>
      </div>
    </div>

    <div class="max-h-[550px] overflow-auto">
      <table class="w-full min-w-[1200px] border-separate border-spacing-0 text-left">
        <thead class="sticky top-0 z-20 bg-white">
          <tr class="text-[11px] font-medium text-slate-400">
            <th class="sticky left-0 z-10 border-b border-slate-100 bg-white px-5 py-3 font-medium">
              证券
            </th>
            <th class="border-b border-slate-100 px-3 py-3 font-medium">
              当日走势
            </th>
            <th class="border-b border-slate-100 px-3 py-3 text-right font-medium">
              最新价
            </th>
            <th class="border-b border-slate-100 px-3 py-3 text-right font-medium">
              <button
                type="button"
                class="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-1 transition hover:bg-slate-100 hover:text-slate-700"
                :class="changePercentSort !== 'default' && 'bg-emerald-50 text-emerald-700'"
                :title="changePercentSortLabel"
                :aria-label="changePercentSortLabel"
                @click="toggleChangePercentSort"
              >
                涨跌幅
                <IconArrowsSort
                  v-if="changePercentSort === 'default'"
                  :size="14"
                />
                <IconSortDescending
                  v-else-if="changePercentSort === 'descending'"
                  :size="14"
                />
                <IconSortAscending
                  v-else
                  :size="14"
                />
              </button>
            </th>
            <th class="border-b border-slate-100 px-3 py-3 text-right font-medium">
              今开
            </th>
            <th class="border-b border-slate-100 px-3 py-3 text-right font-medium">
              最高
            </th>
            <th class="border-b border-slate-100 px-3 py-3 text-right font-medium">
              最低
            </th>
            <th class="border-b border-slate-100 px-3 py-3 text-right font-medium">
              昨收
            </th>
            <th class="border-b border-slate-100 px-3 py-3 text-right font-medium">
              70%成本区间
            </th>
            <th class="border-b border-slate-100 px-3 py-3 font-medium">
              状态
            </th>
            <th class="border-b border-slate-100 px-5 py-3 text-right font-medium">
              操作
            </th>
          </tr>
        </thead>
        <VueDraggable
          tag="tbody"
          :model-value="displayedQuotes"
          handle=".quote-drag-handle"
          :disabled="!sortable"
          :animation="150"
          ghost-class="bg-emerald-50"
          chosen-class="bg-emerald-50"
          @update:model-value="handleQuoteReorder"
        >
          <tr
            v-for="quote in displayedQuotes"
            :key="quote.securityId"
            class="group transition hover:bg-slate-50/80"
          >
            <td class="sticky left-0 z-10 border-b border-slate-100 bg-white px-5 py-3.5 group-hover:bg-[#f9fbfa]">
              <div class="flex items-center gap-3">
                <div class="relative shrink-0">
                  <div
                    class="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-[11px] font-bold text-slate-500"
                    :class="sortable && 'quote-drag-handle cursor-grab active:cursor-grabbing'"
                    :title="sortable ? '拖动头像调整证券顺序' : undefined"
                  >
                    {{ quote.securityType === 'ETF' ? 'ETF' : quote.name.slice(0, 1) }}
                  </div>
                  <span
                    v-if="quote.securityType === 'STOCK' && fundFlowRanks[quote.code]"
                    class="absolute -right-2 -top-2 inline-flex min-w-6 items-center justify-center rounded-full border-2 border-white bg-indigo-600 px-1 py-0.5 text-[8px] font-bold leading-none text-white shadow-sm tabular-number"
                    :title="rankTitle(quote.code)"
                    :aria-label="rankTitle(quote.code)"
                  >{{ compactRank(fundFlowRanks[quote.code]!.rank) }}</span>
                </div>
                <div>
                  <div class="flex items-center gap-1.5">
                    <span class="text-[13px] font-semibold text-slate-900">{{ quote.name }}</span>
                    <span
                      v-if="quote.boardLabel"
                      class="rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold text-indigo-600"
                    >{{ quote.boardLabel }}</span>
                  </div>
                  <p class="mt-0.5 text-[11px] text-slate-400 tabular-number">
                    {{ quote.code }}
                  </p>
                </div>
              </div>
            </td>
            <td class="border-b border-slate-100 px-3 py-3.5">
              <IntradayTrendSparkline
                :trend="trends[quote.securityId]"
                interactive
                @open="emit('trendOpen', quote)"
              />
            </td>
            <td class="border-b border-slate-100 px-3 py-3.5 text-right">
              <p
                class="text-sm font-semibold tabular-number"
                :class="toneClass(quote.change)"
              >
                {{ formatted(quote.price, quote.securityType === 'ETF' ? 3 : 2) }}
              </p>
              <p class="mt-0.5 text-[10px] text-slate-400 tabular-number">
                {{ formatQuoteTime(quote.updatedAt) }}
              </p>
            </td>
            <td class="border-b border-slate-100 px-3 py-3.5 text-right">
              <p
                class="text-xs font-semibold tabular-number"
                :class="toneClass(quote.change)"
              >
                {{ signed(quote.changePercent, '%') }}
              </p>
              <p
                class="mt-0.5 text-[10px] tabular-number"
                :class="toneClass(quote.change)"
              >
                {{ signed(quote.change) }}
              </p>
            </td>
            <td class="border-b border-slate-100 px-3 py-3.5 text-right text-xs text-slate-600 tabular-number">
              {{ formatted(quote.open) }}
            </td>
            <td class="border-b border-slate-100 px-3 py-3.5 text-right text-xs text-slate-600 tabular-number">
              {{ formatted(quote.high) }}
            </td>
            <td class="border-b border-slate-100 px-3 py-3.5 text-right text-xs text-slate-600 tabular-number">
              {{ formatted(quote.low) }}
            </td>
            <td class="border-b border-slate-100 px-3 py-3.5 text-right text-xs text-slate-600 tabular-number">
              {{ formatted(quote.previousClose) }}
            </td>
            <td class="border-b border-slate-100 px-3 py-3.5 text-right">
              <ChipCostRangeCell :target="quote" />
            </td>
            <td class="border-b border-slate-100 px-3 py-3.5">
              <div
                class="flex items-center gap-2 text-[11px] font-medium"
                :class="quote.status === 'TRADING' ? 'text-emerald-700' : 'text-amber-700'"
              >
                <span
                  class="h-1.5 w-1.5 rounded-full"
                  :class="quote.status === 'TRADING' ? 'bg-emerald-500' : 'bg-amber-400'"
                />
                {{ quote.status === 'TRADING' ? '正常' : quote.status === 'STALE' ? '延迟' : '停牌' }}
              </div>
            </td>
            <td class="border-b border-slate-100 px-5 py-3.5">
              <div class="flex items-center justify-end gap-1">
                <button
                  type="button"
                  class="relative grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-700"
                  title="设置提醒"
                  @click="$emit('alert', quote)"
                >
                  <IconBellRinging :size="17" />
                  <span
                    v-if="quote.alertCount"
                    class="absolute -right-0.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.18)]"
                  >
                    <span class="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-75" />
                  </span>
                </button>
                <Menu
                  as="div"
                  class="relative"
                >
                  <MenuButton
                    class="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    title="更多操作"
                    @click="positionMenu(quote.securityId, $event)"
                  >
                    <IconDots :size="18" />
                  </MenuButton>
                  <Teleport to="body">
                    <MenuItems
                      :style="menuPositions[quote.securityId]"
                      class="fixed z-[70] w-36 overflow-hidden rounded-xl border border-slate-100 bg-white py-1 text-left shadow-xl shadow-slate-900/10 focus:outline-none"
                    >
                      <MenuItem
                        v-if="canRemove"
                        v-slot="{ active }"
                      >
                        <button
                          type="button"
                          class="w-full px-3 py-2 text-xs font-medium text-rose-600"
                          :class="active && 'bg-rose-50 text-rose-700'"
                          @click="$emit('remove', quote)"
                        >
                          从当前分组移除
                        </button>
                      </MenuItem>
                      <MenuItem
                        v-if="canRemove"
                        v-slot="{ active }"
                      >
                        <button
                          type="button"
                          class="w-full px-3 py-2 text-xs font-medium text-slate-600"
                          :class="active && 'bg-slate-50 text-slate-900'"
                          @click="$emit('move', quote)"
                        >
                          移动到其他分组
                        </button>
                      </MenuItem>
                      <MenuItem
                        v-if="canRemove"
                        v-slot="{ active }"
                      >
                        <button
                          type="button"
                          class="w-full px-3 py-2 text-xs font-medium text-slate-600"
                          :class="active && 'bg-slate-50 text-slate-900'"
                          @click="$emit('copy', quote)"
                        >
                          复制到其他分组
                        </button>
                      </MenuItem>
                      <p
                        v-else
                        class="px-3 py-2 text-[11px] text-slate-400"
                      >
                        请先选择具体分组
                      </p>
                    </MenuItems>
                  </Teleport>
                </Menu>
              </div>
            </td>
          </tr>
          <tr v-if="displayedQuotes.length === 0">
            <td
              colspan="11"
              class="px-5 py-16 text-center text-sm text-slate-400"
            >
              {{ emptyMessage }}
            </td>
          </tr>
        </VueDraggable>
      </table>
    </div>
  </section>
</template>

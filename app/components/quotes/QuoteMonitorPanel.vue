<script setup lang="ts">
import {
  IconAdjustmentsHorizontal,
  IconBellRinging,
  IconDots,
  IconPlus,
  IconSearch
} from '@tabler/icons-vue'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
import type { SecurityQuote } from '~/types/market'

defineProps<{
  title: string
  quotes: SecurityQuote[]
  canRemove: boolean
}>()

const search = defineModel<string>('search', { default: '' })
const menuPositions = reactive<Record<string, { top: string, left: string }>>({})

defineEmits<{
  alert: [quote: SecurityQuote]
  add: []
  remove: [quote: SecurityQuote]
  move: [quote: SecurityQuote]
  copy: [quote: SecurityQuote]
}>()

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
          行情仅供参考，数据每 5 秒自动更新
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
        <button
          type="button"
          class="icon-button"
          aria-label="筛选行情"
        >
          <IconAdjustmentsHorizontal :size="18" />
        </button>
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

    <div class="overflow-x-auto">
      <table class="w-full min-w-[940px] border-separate border-spacing-0 text-left">
        <thead>
          <tr class="text-[11px] font-medium text-slate-400">
            <th class="sticky left-0 z-10 border-b border-slate-100 bg-white px-5 py-3 font-medium">
              证券
            </th>
            <th class="border-b border-slate-100 px-3 py-3 text-right font-medium">
              最新价
            </th>
            <th class="border-b border-slate-100 px-3 py-3 text-right font-medium">
              涨跌幅
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
            <th class="border-b border-slate-100 px-3 py-3 font-medium">
              状态
            </th>
            <th class="border-b border-slate-100 px-5 py-3 text-right font-medium">
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="quote in quotes"
            :key="quote.securityId"
            class="group transition hover:bg-slate-50/80"
          >
            <td class="sticky left-0 z-10 border-b border-slate-100 bg-white px-5 py-3.5 group-hover:bg-[#f9fbfa]">
              <div class="flex items-center gap-3">
                <div class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-[11px] font-bold text-slate-500">
                  {{ quote.securityType === 'ETF' ? 'ETF' : quote.name.slice(0, 1) }}
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
            <td class="border-b border-slate-100 px-3 py-3.5 text-right">
              <p
                class="text-sm font-semibold tabular-number"
                :class="toneClass(quote.change)"
              >
                {{ formatted(quote.price, quote.securityType === 'ETF' ? 3 : 2) }}
              </p>
              <p class="mt-0.5 text-[10px] text-slate-400 tabular-number">
                {{ quote.updatedAt }}
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
                    class="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-emerald-600 px-1 text-[9px] font-semibold text-white"
                  >{{ quote.alertCount }}</span>
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
          <tr v-if="quotes.length === 0">
            <td
              colspan="9"
              class="px-5 py-16 text-center text-sm text-slate-400"
            >
              没有匹配的证券
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

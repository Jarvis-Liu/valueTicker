<script setup lang="ts">
import { IconCircleCheck } from '@tabler/icons-vue'
import AlertRuleDrawer from '~/components/alerts/AlertRuleDrawer.vue'
import ConfirmDialog from '~/components/common/ConfirmDialog.vue'
import GroupFormDialog from '~/components/groups/GroupFormDialog.vue'
import GroupSidebar from '~/components/groups/GroupSidebar.vue'
import AppHeader from '~/components/layout/AppHeader.vue'
import MarketInsightRail from '~/components/market/MarketInsightRail.vue'
import TradingCalendarBar from '~/components/market/TradingCalendarBar.vue'
import QuoteHealthCards from '~/components/quotes/QuoteHealthCards.vue'
import QuoteMonitorPanel from '~/components/quotes/QuoteMonitorPanel.vue'
import type { AlertNotification, SecurityQuote, WatchGroup } from '~/types/market'

const userConfigStore = useUserConfigStore()

const quotes: SecurityQuote[] = [
  { securityId: 'SSE:600519', name: '贵州茅台', code: '600519', securityType: 'STOCK', price: 1496.80, change: 18.32, changePercent: 1.24, open: 1481.00, high: 1502.88, low: 1478.20, previousClose: 1478.48, updatedAt: '10:26:35', status: 'TRADING', alertCount: 2, groupIds: ['default', 'core'] },
  { securityId: 'SZSE:000858', name: '五粮液', code: '000858', securityType: 'STOCK', price: 128.64, change: -1.12, changePercent: -0.86, open: 129.80, high: 130.12, low: 128.20, previousClose: 129.76, updatedAt: '10:26:35', status: 'TRADING', alertCount: 1, groupIds: ['core'] },
  { securityId: 'SZSE:300750', name: '宁德时代', code: '300750', boardLabel: '创', securityType: 'STOCK', price: 268.15, change: 4.72, changePercent: 1.79, open: 264.20, high: 270.06, low: 263.58, previousClose: 263.43, updatedAt: '10:26:35', status: 'TRADING', alertCount: 0, groupIds: ['default', 'core', 'tech'] },
  { securityId: 'SSE:688981', name: '中芯国际', code: '688981', boardLabel: '科', securityType: 'STOCK', price: 92.36, change: 2.18, changePercent: 2.42, open: 90.60, high: 93.12, low: 89.88, previousClose: 90.18, updatedAt: '10:26:34', status: 'TRADING', alertCount: 2, groupIds: ['default', 'tech'] },
  { securityId: 'SSE:601318', name: '中国平安', code: '601318', securityType: 'STOCK', price: 52.18, change: -0.23, changePercent: -0.44, open: 52.46, high: 52.62, low: 52.02, previousClose: 52.41, updatedAt: '10:26:35', status: 'TRADING', alertCount: 0, groupIds: ['core'] },
  { securityId: 'SZSE:002594', name: '比亚迪', code: '002594', securityType: 'STOCK', price: 318.72, change: 1.44, changePercent: 0.45, open: 317.50, high: 320.16, low: 315.60, previousClose: 317.28, updatedAt: '10:26:33', status: 'STALE', alertCount: 1, groupIds: ['tech'] },
  { securityId: 'SZSE:159915', name: '创业板 ETF', code: '159915', securityType: 'ETF', price: 2.184, change: -0.006, changePercent: -0.27, open: 2.192, high: 2.201, low: 2.178, previousClose: 2.190, updatedAt: '10:26:35', status: 'TRADING', alertCount: 0, groupIds: ['etf'] },
  { securityId: 'SSE:510300', name: '沪深300 ETF', code: '510300', securityType: 'ETF', price: 4.126, change: 0.018, changePercent: 0.44, open: 4.110, high: 4.132, low: 4.105, previousClose: 4.108, updatedAt: '10:26:35', status: 'TRADING', alertCount: 1, groupIds: ['etf'] }
]

const notifications: AlertNotification[] = [
  { id: 'n1', title: '中芯国际涨幅超过 2%', detail: '当前涨幅 2.42%，目标值 2.00%', time: '10:23', tone: 'up' },
  { id: 'n2', title: '贵州茅台价格涨至 1490', detail: '当前价格 1496.80，已触发提醒', time: '10:08', tone: 'up' },
  { id: 'n3', title: '五粮液价格跌至 129', detail: '当前价格 128.64，目标值 129.00', time: '09:54', tone: 'down' }
]

const selectedGroupId = ref('all')
const search = ref('')
const paused = ref(false)
const refreshing = ref(false)
const alertOpen = ref(false)
const activeQuote = ref<SecurityQuote | null>(null)
const savedToast = ref(false)
const toastMessage = ref('操作已完成')
const groupFormOpen = ref(false)
const groupFormMode = ref<'create' | 'rename'>('create')
const activeGroup = ref<WatchGroup | null>(null)
const deleteConfirmOpen = ref(false)

const groups = computed(() => userConfigStore.watchGroups)
const selectedGroup = computed(() => groups.value.find(group => group.id === selectedGroupId.value) ?? groups.value[0]!)
const editableGroupNames = computed(() => groups.value
  .filter(group => group.id !== 'all' && group.id !== activeGroup.value?.id)
  .map(group => group.name))
const visibleQuotes = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  return quotes.filter((quote) => {
    const inGroup = selectedGroupId.value === 'all' || quote.groupIds.includes(selectedGroupId.value)
    const matches = !keyword || quote.name.toLowerCase().includes(keyword) || quote.code.includes(keyword)
    return inGroup && matches
  })
})
const lastUpdatedAt = computed(() => visibleQuotes.value[0]?.updatedAt ?? '待更新')
const delayedQuoteCount = computed(() => quotes.filter(quote => quote.status === 'STALE').length)
const enabledAlertCount = computed(() => quotes.reduce((total, quote) => total + quote.alertCount, 0))
const coveredAlertSecurityCount = computed(() => quotes.filter(quote => quote.alertCount > 0).length)

onMounted(async () => {
  try {
    await userConfigStore.loadConfig()
  } catch {
    showSavedToast(userConfigStore.errorMessage || '配置加载失败')
  }
})

watch(groups, (nextGroups) => {
  const selectedGroupExists = nextGroups.some(group => group.id === selectedGroupId.value)

  if (!selectedGroupExists) {
    selectedGroupId.value = 'all'
  }
})

function openAlert(quote: SecurityQuote) {
  activeQuote.value = quote
  alertOpen.value = true
}

function refresh() {
  if (refreshing.value) return
  refreshing.value = true
  window.setTimeout(() => {
    refreshing.value = false
  }, 700)
}

function showSavedToast(message = '操作已完成') {
  toastMessage.value = message
  savedToast.value = true
  window.setTimeout(() => {
    savedToast.value = false
  }, 2200)
}

function openGroupForm() {
  groupFormMode.value = 'create'
  activeGroup.value = null
  groupFormOpen.value = true
}

function closeGroupForm() {
  groupFormOpen.value = false
}

function openRenameGroupForm(group: WatchGroup) {
  groupFormMode.value = 'rename'
  activeGroup.value = group
  groupFormOpen.value = true
}

function openDeleteGroupConfirm(group: WatchGroup) {
  activeGroup.value = group
  deleteConfirmOpen.value = true
}

function closeDeleteGroupConfirm() {
  deleteConfirmOpen.value = false
}

async function submitGroupForm(name: string) {
  if (groupFormMode.value === 'rename') {
    await renameGroup(name)
    return
  }

  await createGroup(name)
}

async function createGroup(name: string) {
  try {
    const group = await userConfigStore.createGroup(name)
    selectedGroupId.value = group.id
    closeGroupForm()
    showSavedToast('分组已保存')
  } catch (error) {
    console.error('[ValueTicker] 创建分组失败', error)
    showSavedToast(userConfigStore.errorMessage || '分组保存失败')
  }
}

async function renameGroup(name: string) {
  if (!activeGroup.value) return

  try {
    const group = await userConfigStore.renameGroup(activeGroup.value.id, name)
    selectedGroupId.value = group.id
    closeGroupForm()
    showSavedToast('分组名称已更新')
  } catch (error) {
    console.error('[ValueTicker] 重命名分组失败', error)
    showSavedToast(userConfigStore.errorMessage || '分组重命名失败')
  }
}

async function deleteGroup() {
  if (!activeGroup.value) return

  const groupId = activeGroup.value.id

  try {
    await userConfigStore.deleteGroup(groupId)

    if (selectedGroupId.value === groupId) {
      selectedGroupId.value = 'all'
    }

    closeDeleteGroupConfirm()
    activeGroup.value = null
    showSavedToast('分组已删除')
  } catch (error) {
    console.error('[ValueTicker] 删除分组失败', error)
    showSavedToast(userConfigStore.errorMessage || '分组删除失败')
  }
}
</script>

<template>
  <div class="flex h-screen flex-col overflow-hidden">
    <div class="shrink-0">
      <AppHeader
        :paused="paused"
        :refreshing="refreshing"
        @toggle="paused = !paused"
        @refresh="refresh"
      />
      <div class="border-b border-slate-200/70 bg-[#f3f6f4]/95 shadow-sm backdrop-blur">
        <div class="mx-auto max-w-[1680px] px-3 py-3 sm:px-6">
          <TradingCalendarBar
            class="mb-0"
            :last-updated-at="lastUpdatedAt"
          />
        </div>
      </div>
    </div>

    <main class="min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-4 sm:px-6 sm:pt-6">
      <div class="mx-auto min-h-full max-w-[1680px]">
        <div class="grid min-h-full min-w-0 gap-4 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_280px]">
          <GroupSidebar
            :groups="groups"
            :selected-id="selectedGroupId"
            @select="selectedGroupId = $event"
            @add="openGroupForm"
            @rename="openRenameGroupForm"
            @delete="openDeleteGroupConfirm"
          />

          <div class="min-w-0 space-y-4">
            <QuoteMonitorPanel
              v-model:search="search"
              :title="selectedGroup.name"
              :quotes="visibleQuotes"
              @alert="openAlert"
            />

            <QuoteHealthCards
              :delayed-count="delayedQuoteCount"
              :enabled-alert-count="enabledAlertCount"
              :covered-security-count="coveredAlertSecurityCount"
              :provider-latency="186"
            />
          </div>

          <div class="lg:col-start-2 xl:col-start-auto">
            <MarketInsightRail :notifications="notifications" />
          </div>
        </div>
      </div>
    </main>

    <AlertRuleDrawer
      :open="alertOpen"
      :quote="activeQuote"
      @close="alertOpen = false"
      @save="showSavedToast"
    />

    <GroupFormDialog
      :open="groupFormOpen"
      :mode="groupFormMode"
      :initial-name="activeGroup?.name"
      :existing-names="editableGroupNames"
      @close="closeGroupForm"
      @submit="submitGroupForm"
    />

    <ConfirmDialog
      :open="deleteConfirmOpen"
      title="删除分组"
      :message="`确定要删除「${activeGroup?.name ?? ''}」吗？分组内的证券会从该分组移除，提醒规则不会立即删除。`"
      confirm-text="删除分组"
      @close="closeDeleteGroupConfirm"
      @confirm="deleteGroup"
    />

    <Transition
      enter-active-class="transition duration-200"
      enter-from-class="translate-y-2 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-150"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-2 opacity-0"
    >
      <div
        v-if="savedToast"
        class="fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-medium text-white shadow-xl"
      >
        <IconCircleCheck
          :size="18"
          class="text-emerald-400"
        />
        {{ toastMessage }}
      </div>
    </Transition>
  </div>
</template>

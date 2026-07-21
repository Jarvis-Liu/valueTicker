<script setup lang="ts">
import { IconCircleCheck } from '@tabler/icons-vue'
import AlertRuleDrawer from '~/components/alerts/AlertRuleDrawer.vue'
import ConfirmDialog from '~/components/common/ConfirmDialog.vue'
import GroupFormDialog from '~/components/groups/GroupFormDialog.vue'
import GroupSidebar from '~/components/groups/GroupSidebar.vue'
import MonitorSettingsDialog from '~/components/monitoring/MonitorSettingsDialog.vue'
import AddSecurityDialog from '~/components/securities/AddSecurityDialog.vue'
import TransferSecurityDialog from '~/components/securities/TransferSecurityDialog.vue'
import AppHeader from '~/components/layout/AppHeader.vue'
import MarketInsightRail from '~/components/market/MarketInsightRail.vue'
import TradingCalendarBar from '~/components/market/TradingCalendarBar.vue'
import QuoteHealthCards from '~/components/quotes/QuoteHealthCards.vue'
import QuoteMonitorPanel from '~/components/quotes/QuoteMonitorPanel.vue'
import type { SecurityQuote, WatchGroup } from '~/types/market'
import type { QuoteProvider } from '~/services/quotes/types'
import type { AlertRule, SecurityItem } from '~~/shared/types/stock'

const userConfigStore = useUserConfigStore()
const marketStore = useMarketStore()
const quoteMonitor = useQuoteMonitor()
const browserNotifications = useBrowserNotifications()
let monitorStarted = false
// 页面直连测试已确认可用，恢复 Worker 行情轮询。
const enableQuoteWorker = true

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

const selectedGroupId = ref('all')
const quoteProvider = ref<QuoteProvider>('EASTMONEY')
const pollingIntervalMs = useLocalStorage<number>('value-ticker:polling-interval-ms', 5000)
const search = ref('')
const paused = ref(false)
const refreshing = ref(false)
const alertOpen = ref(false)
const activeQuote = ref<SecurityQuote | null>(null)
const savedToast = ref(false)
const toastMessage = ref('操作已完成')
const groupFormOpen = ref(false)
const monitorSettingsOpen = ref(false)
const groupFormMode = ref<'create' | 'rename'>('create')
const activeGroup = ref<WatchGroup | null>(null)
const deleteConfirmOpen = ref(false)
const addSecurityOpen = ref(false)
const removeSecurityConfirmOpen = ref(false)
const activeSecurity = ref<SecurityQuote | null>(null)
const transferDialogOpen = ref(false)
const transferMode = ref<'MOVE' | 'COPY'>('MOVE')

const groups = computed(() => userConfigStore.watchGroups)
const selectedGroup = computed(() => groups.value.find(group => group.id === selectedGroupId.value) ?? groups.value[0]!)
const addTargetGroup = computed(() => selectedGroupId.value === 'all'
  ? groups.value.find(group => group.isDefault) ?? groups.value[0]
  : selectedGroup.value)
const addTargetSecurityIds = computed(() => {
  const group = userConfigStore.stockGroups.find(group => group.id === addTargetGroup.value?.id)
  return group?.members.map(member => member.securityId) ?? []
})
const editableGroupNames = computed(() => groups.value
  .filter(group => group.id !== 'all' && group.id !== activeGroup.value?.id)
  .map(group => group.name))
const configuredQuotes = computed<SecurityQuote[]>(() => {
  const persistedGroups = userConfigStore.stockGroups
  const members = selectedGroupId.value === 'all'
    ? Array.from(new Map(persistedGroups.flatMap(group => group.members).map(member => [member.securityId, member])).values())
    : persistedGroups.find(group => group.id === selectedGroupId.value)?.members ?? []

  return members.map((member) => {
    const existingQuote = quotes.find(quote => quote.securityId === member.securityId)
    const groupIds = persistedGroups
      .filter(group => group.members.some(item => item.securityId === member.securityId))
      .map(group => group.id)
    const alertCount = userConfigStore.config?.alerts[member.securityId]?.rules.filter(rule => rule.enabled).length ?? 0

    const pendingQuote = createPendingQuote(member, groupIds, alertCount)
    const liveQuote = marketStore.quotes[member.securityId]
    if (liveQuote) return { ...pendingQuote, ...liveQuote, status: liveQuote.status === 'ERROR' ? 'STALE' : liveQuote.status, name: member.name, code: member.code, securityType: member.securityType === 'ETF' ? 'ETF' : 'STOCK', boardLabel: member.boardLabel || undefined, groupIds, alertCount }
    return existingQuote ? { ...existingQuote, groupIds, alertCount } : pendingQuote
  })
})
const visibleQuotes = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  return configuredQuotes.value.filter((quote) => {
    const matches = !keyword || quote.name.toLowerCase().includes(keyword) || quote.code.includes(keyword)
    return matches
  })
})
const lastUpdatedAt = computed(() => visibleQuotes.value[0]?.updatedAt ?? '待更新')
const delayedQuoteCount = computed(() => configuredQuotes.value.filter(quote => quote.status === 'STALE').length)
const enabledAlertCount = computed(() => configuredQuotes.value.reduce((total, quote) => total + quote.alertCount, 0))
const coveredAlertSecurityCount = computed(() => configuredQuotes.value.filter(quote => quote.alertCount > 0).length)
const activeAlertRules = computed(() => activeQuote.value ? userConfigStore.config?.alerts[activeQuote.value.securityId]?.rules ?? [] : [])
const activeAlerts = computed(() => userConfigStore.config?.alerts ?? {})

onMounted(async () => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await userConfigStore.loadConfig()
      if (enableQuoteWorker) {
        quoteMonitor.start(subscriptionSecurities.value, quoteProvider.value, activeAlerts.value, pollingIntervalMs.value)
        monitorStarted = true
      }
      return
    } catch {
      if (attempt < 2) {
        await new Promise(resolve => window.setTimeout(resolve, 500 * (attempt + 1)))
        continue
      }

      marketStore.setStatus('ERROR', userConfigStore.errorMessage || '配置加载失败')
      showSavedToast(userConfigStore.errorMessage || '配置加载失败')
    }
  }
})

const subscriptionSecurities = computed<SecurityItem[]>(() => {
  return getSubscriptionSecurities(selectedGroupId.value)
})

watch(subscriptionSecurities, (nextSecurities) => {
  if (!monitorStarted) return
  quoteMonitor.updateSecurities(nextSecurities, quoteProvider.value)
}, { deep: true })

watch(activeAlerts, (nextAlerts) => {
  if (!monitorStarted) return
  quoteMonitor.updateAlerts(nextAlerts)
}, { deep: true })

onUnmounted(() => quoteMonitor.stop())

watch(groups, (nextGroups) => {
  const selectedGroupExists = nextGroups.some(group => group.id === selectedGroupId.value)

  if (!selectedGroupExists) {
    selectedGroupId.value = 'all'
  }
})

function selectGroup(groupId: string) {
  selectedGroupId.value = groupId
}

function changeQuoteProvider(provider: QuoteProvider) {
  if (quoteProvider.value === provider) return
  quoteProvider.value = provider
  marketStore.setStatus('RUNNING')
  if (monitorStarted) quoteMonitor.updateProvider(provider)
}

function saveMonitorSettings(settings: { provider: QuoteProvider, pollingIntervalMs: number }) {
  const providerChanged = quoteProvider.value !== settings.provider
  quoteProvider.value = settings.provider
  pollingIntervalMs.value = settings.pollingIntervalMs
  marketStore.setStatus('RUNNING')

  if (monitorStarted) {
    if (providerChanged) quoteMonitor.updateProvider(settings.provider)
    quoteMonitor.updatePollingInterval(settings.pollingIntervalMs)
  }

  monitorSettingsOpen.value = false
  showSavedToast(`监测设置已保存：每 ${settings.pollingIntervalMs / 1000} 秒轮询`)
}

function getSubscriptionSecurities(groupId: string) {
  const members = groupId === 'all'
    ? userConfigStore.stockGroups.flatMap(group => group.members)
    : userConfigStore.stockGroups.find(group => group.id === groupId)?.members ?? []
  return Array.from(new Map(members.map(member => [member.securityId, member])).values())
}

function openAlert(quote: SecurityQuote) {
  activeQuote.value = quote
  alertOpen.value = true
}

function refresh() {
  if (refreshing.value) return
  refreshing.value = true
  quoteMonitor.forceRefresh()
  window.setTimeout(() => {
    refreshing.value = false
  }, 700)
}

function toggleMonitor() {
  paused.value = !paused.value
  if (paused.value) quoteMonitor.pause()
  else quoteMonitor.resume()
}

function showSavedToast(message = '操作已完成') {
  toastMessage.value = message
  savedToast.value = true
  window.setTimeout(() => {
    savedToast.value = false
  }, 2200)
}

async function saveAlertRules(rules: AlertRule[]) {
  if (!activeQuote.value) return

  try {
    if (rules.some(rule => rule.enabled)) {
      await browserNotifications.requestPermission()
    }
    await userConfigStore.saveSecurityAlerts(activeQuote.value.securityId, rules)
    quoteMonitor.updateAlerts(activeAlerts.value)
    alertOpen.value = false
    showSavedToast(rules.length > 0 ? '提醒规则已保存' : '提醒规则已清空')
  } catch (error) {
    console.error('[ValueTicker] 保存提醒规则失败', error)
    showSavedToast(userConfigStore.errorMessage || '提醒规则保存失败')
  }
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

function openRemoveSecurityConfirm(quote: SecurityQuote) {
  activeSecurity.value = quote
  removeSecurityConfirmOpen.value = true
}

function closeRemoveSecurityConfirm() {
  removeSecurityConfirmOpen.value = false
  activeSecurity.value = null
}

function openTransferDialog(mode: 'MOVE' | 'COPY', quote: SecurityQuote) {
  activeSecurity.value = quote
  transferMode.value = mode
  transferDialogOpen.value = true
}

function closeTransferDialog() {
  transferDialogOpen.value = false
  activeSecurity.value = null
}

const transferGroups = computed(() => groups.value.filter(group => group.id !== 'all' && group.id !== selectedGroupId.value))

async function transferSecurity(targetGroupId: string) {
  if (!activeSecurity.value || selectedGroupId.value === 'all') return
  try {
    await userConfigStore.transferMember(selectedGroupId.value, activeSecurity.value.securityId, targetGroupId, transferMode.value)
    closeTransferDialog()
    showSavedToast(transferMode.value === 'MOVE' ? '证券已移动' : '证券已复制')
  } catch (error) {
    console.error('[ValueTicker] 转移证券失败', error)
    showSavedToast(userConfigStore.errorMessage || '证券转移失败')
  }
}

function openAddSecurity() {
  addSecurityOpen.value = true
}

async function addSecurity(security: SecurityItem) {
  try {
    if (!addTargetGroup.value) throw new Error('暂无可用分组')
    await userConfigStore.addMember(addTargetGroup.value.id, security)
    addSecurityOpen.value = false
    showSavedToast('证券已添加')
  } catch (error) {
    console.error('[ValueTicker] 添加证券失败', error)
    showSavedToast(userConfigStore.errorMessage || '证券添加失败')
  }
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

async function removeSecurity() {
  if (!activeSecurity.value || selectedGroupId.value === 'all') return

  try {
    await userConfigStore.deleteMember(selectedGroupId.value, activeSecurity.value.securityId)
    closeRemoveSecurityConfirm()
    showSavedToast('证券已从当前分组移除')
  } catch (error) {
    console.error('[ValueTicker] 移除证券失败', error)
    showSavedToast(userConfigStore.errorMessage || '证券移除失败')
  }
}

function createPendingQuote(member: SecurityItem, groupIds: string[], alertCount: number): SecurityQuote {
  return {
    securityId: member.securityId,
    name: member.name,
    code: member.code,
    boardLabel: member.boardLabel || undefined,
    securityType: member.securityType === 'ETF' ? 'ETF' : 'STOCK',
    price: Number.NaN,
    change: Number.NaN,
    changePercent: Number.NaN,
    open: Number.NaN,
    high: Number.NaN,
    low: Number.NaN,
    previousClose: Number.NaN,
    updatedAt: '待更新',
    status: 'STALE',
    alertCount,
    groupIds
  }
}
</script>

<template>
  <div class="flex h-screen flex-col overflow-hidden">
    <div class="shrink-0">
      <AppHeader
        :paused="paused"
        :provider="quoteProvider"
        :polling-interval-ms="pollingIntervalMs"
        :refreshing="refreshing"
        :last-updated-at="lastUpdatedAt"
        :status="marketStore.status"
        @provider-change="changeQuoteProvider"
        @toggle="toggleMonitor"
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
            @select="selectGroup"
            @add="openGroupForm"
            @rename="openRenameGroupForm"
            @delete="openDeleteGroupConfirm"
            @settings="monitorSettingsOpen = true"
          />

          <div class="min-w-0 space-y-4">
            <QuoteMonitorPanel
              v-model:search="search"
              :title="selectedGroup.name"
              :quotes="visibleQuotes"
              :can-remove="selectedGroupId !== 'all'"
              :polling-interval-ms="pollingIntervalMs"
              @alert="openAlert"
              @add="openAddSecurity"
              @remove="openRemoveSecurityConfirm"
              @move="openTransferDialog('MOVE', $event)"
              @copy="openTransferDialog('COPY', $event)"
            />

            <QuoteHealthCards
              :delayed-count="delayedQuoteCount"
              :enabled-alert-count="enabledAlertCount"
              :covered-security-count="coveredAlertSecurityCount"
              :provider-latency="186"
            />
          </div>

          <div class="lg:col-start-2 xl:col-start-auto">
            <MarketInsightRail :notifications="marketStore.alertNotifications" />
          </div>
        </div>
      </div>
    </main>

    <AlertRuleDrawer
      :open="alertOpen"
      :quote="activeQuote"
      :rules="activeAlertRules"
      :saving="userConfigStore.saving"
      @close="alertOpen = false"
      @save="saveAlertRules"
    />

    <MonitorSettingsDialog
      :open="monitorSettingsOpen"
      :provider="quoteProvider"
      :polling-interval-ms="pollingIntervalMs"
      @close="monitorSettingsOpen = false"
      @save="saveMonitorSettings"
    />

    <GroupFormDialog
      :open="groupFormOpen"
      :mode="groupFormMode"
      :initial-name="activeGroup?.name"
      :existing-names="editableGroupNames"
      @close="closeGroupForm"
      @submit="submitGroupForm"
    />

    <AddSecurityDialog
      :open="addSecurityOpen"
      :group-name="addTargetGroup?.name ?? '默认分组'"
      :existing-security-ids="addTargetSecurityIds"
      @close="addSecurityOpen = false"
      @select="addSecurity"
    />

    <ConfirmDialog
      :open="deleteConfirmOpen"
      title="删除分组"
      :message="`确定要删除「${activeGroup?.name ?? ''}」吗？分组内的证券会从该分组移除，提醒规则不会立即删除。`"
      confirm-text="删除分组"
      @close="closeDeleteGroupConfirm"
      @confirm="deleteGroup"
    />

    <TransferSecurityDialog
      :open="transferDialogOpen"
      :mode="transferMode"
      :source-group-name="selectedGroup.name"
      :groups="transferGroups"
      @close="closeTransferDialog"
      @submit="transferSecurity"
    />

    <ConfirmDialog
      :open="removeSecurityConfirmOpen"
      title="移除证券"
      :message="`确定要将「${activeSecurity?.name ?? ''}（${activeSecurity?.code ?? ''}）」从当前分组移除吗？`"
      confirm-text="移除证券"
      @close="closeRemoveSecurityConfirm"
      @confirm="removeSecurity"
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

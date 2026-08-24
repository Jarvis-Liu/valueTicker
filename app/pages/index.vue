<script setup lang="ts">
import { IconCircleCheck } from '@tabler/icons-vue'
import AlertNotificationsDialog from '~/components/alerts/AlertNotificationsDialog.vue'
import AlertRuleDrawer from '~/components/alerts/AlertRuleDrawer.vue'
import ConfirmDialog from '~/components/common/ConfirmDialog.vue'
import DashboardLoadingOverlay from '~/components/common/DashboardLoadingOverlay.vue'
import GroupImportConfirmDialog from '~/components/groups/GroupImportConfirmDialog.vue'
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
import IntradayTrendDialog from '~/components/quotes/IntradayTrendDialog.vue'
import type { IntradayTrendTarget, SecurityQuote, WatchGroup } from '~/types/market'
import type { NormalizedQuote, QuoteProviderMode } from '~/services/quotes/types'
import type { AlertRule, SecurityItem, StockGroupsExportFile } from '~~/shared/types/stock'
import { stockGroupsExportFileSchema } from '~~/shared/schemas/stock-config'
import { getGroupSecurities, getPollingSecurities } from '~/utils/polling-securities'
import { MARKET_INDEX_SECURITIES } from '~/utils/market-indices'
import { fetchMarketTurnoverSnapshots, requestMarketTurnoverSnapshotUpdate } from '~/services/api/market-turnover'
import { fetchTencentMarketTurnover } from '~/services/market-turnover/tencent-market-turnover'
import { getClientMarketTurnoverPhase, getPreviousWeekdayTradeDate, sumMarketTurnover, type MarketTurnoverDisplay } from '~/utils/market-turnover'
import type { MarketTurnoverSnapshot } from '~~/shared/types/market-turnover'

const userConfigStore = useUserConfigStore()
const marketStore = useMarketStore()
const quoteMonitor = useQuoteMonitor()
const browserNotifications = useBrowserNotifications()
const chipDistribution = useChipDistribution()
const fundFlowRanks = useFundFlowRanks()
const supabase = useSupabaseClient()
const supabaseUser = useSupabaseUser()
let monitorStarted = false
let lastReportedWindowActive: boolean | null = null

const selectedGroupId = ref('all')
const groupSidebarCollapsed = useLocalStorage<boolean>('value-ticker:group-sidebar-collapsed', false)
const quoteProviderMode = useLocalStorage<QuoteProviderMode>('value-ticker:provider-mode', 'MIXED')
const pollingIntervalMs = useLocalStorage<number>('value-ticker:polling-interval-ms', 5000)
const search = ref('')
// 仅影响当前表格显示；完整证券集仍参与行情订阅和提醒判断。
const onlyAlerted = ref(false)
const paused = ref(false)
const refreshing = ref(false)
const signingOut = ref(false)
// 只用于首次配置加载与用户手动刷新；自动轮询不会遮挡主体内容。
const contentLoading = ref(true)
const alertOpen = ref(false)
const intradayTrendDialogOpen = ref(false)
const activeTrendTarget = ref<IntradayTrendTarget | null>(null)
const alertNotificationsOpen = ref(false)
const clearAlertNotificationsConfirmOpen = ref(false)
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
const removingSecurity = ref(false)
const activeSecurity = ref<SecurityQuote | null>(null)
const transferDialogOpen = ref(false)
const transferMode = ref<'MOVE' | 'COPY'>('MOVE')
const importedGroupsFile = ref<StockGroupsExportFile | null>(null)
const importGroupsConfirmOpen = ref(false)
const marketTurnover = ref<MarketTurnoverDisplay | null>(null)

const userEmail = computed(() => {
  const email = (supabaseUser.value as { email?: unknown } | null)?.email
  return typeof email === 'string' ? email : ''
})
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
    const groupIds = persistedGroups
      .filter(group => group.members.some(item => item.securityId === member.securityId))
      .map(group => group.id)
    const alertCount = userConfigStore.config?.alerts[member.securityId]?.rules.filter(rule => rule.enabled).length ?? 0

    const pendingQuote = createPendingQuote(member, groupIds, alertCount)
    const liveQuote = marketStore.quotes[member.securityId]
    if (liveQuote) return { ...pendingQuote, ...liveQuote, status: liveQuote.status === 'ERROR' ? 'STALE' : liveQuote.status, name: member.name, code: member.code, securityType: member.securityType === 'ETF' ? 'ETF' : 'STOCK', boardLabel: member.boardLabel || undefined, groupIds, alertCount }
    return pendingQuote
  })
})
const visibleQuotes = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  return configuredQuotes.value.filter((quote) => {
    const matches = !keyword || quote.name.toLowerCase().includes(keyword) || quote.code.includes(keyword)
    return matches && (!onlyAlerted.value || quote.alertCount > 0)
  })
})
// Header 与交易日历使用全局行情批次时间，不受搜索、筛选和当前分组顺序影响。
const lastUpdatedAt = computed(() => marketStore.lastUpdatedAt ?? '待更新')
const healthyQuoteCount = computed(() => configuredQuotes.value.filter(quote => quote.status === 'TRADING' && Number.isFinite(quote.price)).length)
const delayedQuoteCount = computed(() => configuredQuotes.value.filter(quote => quote.status === 'STALE' || !Number.isFinite(quote.price)).length)
const quoteHealthPercent = computed(() => configuredQuotes.value.length ? healthyQuoteCount.value / configuredQuotes.value.length * 100 : null)
const enabledAlertCount = computed(() => configuredQuotes.value.reduce((total, quote) => total + quote.alertCount, 0))
const coveredAlertSecurityCount = computed(() => configuredQuotes.value.filter(quote => quote.alertCount > 0).length)
const activeTrend = computed(() => activeTrendTarget.value ? marketStore.intradayTrends[activeTrendTarget.value.securityId] : undefined)
const activeAlertRules = computed(() => activeQuote.value ? userConfigStore.config?.alerts[activeQuote.value.securityId]?.rules ?? [] : [])
const activeAlerts = computed(() => userConfigStore.config?.alerts ?? {})
const marketIndexQuotes = computed<NormalizedQuote[]>(() =>
  MARKET_INDEX_SECURITIES
    .map(index => marketStore.quotes[index.securityId])
    .filter((quote): quote is NormalizedQuote => Boolean(quote))
)

onMounted(async () => {
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await userConfigStore.loadConfig()
        // 页面进入只请求一次腾讯成交额；它不加入 5 秒行情轮询。
        void refreshMarketTurnover()
        quoteMonitor.start(subscriptionSecurities.value, quoteProviderMode.value, activeAlerts.value, pollingIntervalMs.value)
        monitorStarted = true
        lastReportedWindowActive = isWindowActive()
        quoteMonitor.updateWindowActivity(lastReportedWindowActive)
        quoteMonitor.updateTrendSecurities(trendSecurities.value)
        fundFlowRanks.start(rankStockCodes.value)
        fundFlowRanks.setWindowActive(isWindowActive())
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
  } finally {
    contentLoading.value = false
  }
})

const subscriptionSecurities = computed<SecurityItem[]>(() => getPollingSecurities(userConfigStore.stockGroups, MARKET_INDEX_SECURITIES))
const trendSecurities = computed<SecurityItem[]>(() => getGroupSecurities(userConfigStore.stockGroups, selectedGroupId.value, MARKET_INDEX_SECURITIES))
const rankStockCodes = computed(() => subscriptionSecurities.value
  .filter(security => security.securityType === 'STOCK' && ['SSE:', 'SZSE:', 'BSE:'].some(prefix => security.securityId.startsWith(prefix)))
  .map(security => security.code))

watch(subscriptionSecurities, (nextSecurities) => {
  if (!monitorStarted) return
  quoteMonitor.updateSecurities(nextSecurities, quoteProviderMode.value)
}, { deep: true })

watch(rankStockCodes, nextCodes => fundFlowRanks.updateCodes(nextCodes), { deep: true })

watch(trendSecurities, (nextSecurities) => {
  if (!monitorStarted) return
  quoteMonitor.updateTrendSecurities(nextSecurities)
}, { deep: true })

watch(activeAlerts, (nextAlerts) => {
  if (!monitorStarted) return
  quoteMonitor.updateAlerts(nextAlerts)
}, { deep: true })

onMounted(() => {
  window.addEventListener('focus', syncWindowActivity)
  window.addEventListener('blur', syncWindowActivity)
  document.addEventListener('visibilitychange', syncWindowActivity)
})

onUnmounted(() => {
  window.removeEventListener('focus', syncWindowActivity)
  window.removeEventListener('blur', syncWindowActivity)
  document.removeEventListener('visibilitychange', syncWindowActivity)
  quoteMonitor.stop()
  fundFlowRanks.stop()
})

watch(groups, (nextGroups) => {
  const selectedGroupExists = nextGroups.some(group => group.id === selectedGroupId.value)

  if (!selectedGroupExists) {
    selectedGroupId.value = 'all'
  }
})

function selectGroup(groupId: string) {
  if (selectedGroupId.value === groupId) return
  selectedGroupId.value = groupId
  // 切换视图时仅主动拉取当前分组行情；趋势由 trendSecurities watcher 统一刷新，避免重复请求竞态。
  if (monitorStarted) quoteMonitor.refreshSecurities(getGroupSecurities(userConfigStore.stockGroups, groupId))
}

async function reorderGroups(groupIds: string[]) {
  try {
    await userConfigStore.reorderGroups(groupIds)
    showSavedToast('分组顺序已保存')
  } catch (error) {
    console.error('[ValueTicker] 调整分组顺序失败', error)
    showSavedToast(userConfigStore.errorMessage || '分组排序保存失败')
  }
}
async function reorderGroupMembers(securityIds: string[]) {
  if (selectedGroupId.value === 'all') return

  try {
    await userConfigStore.reorderGroupMembers(selectedGroupId.value, securityIds)
    showSavedToast('证券顺序已保存')
  } catch (error) {
    console.error('[ValueTicker] 调整证券顺序失败', error)
    showSavedToast(userConfigStore.errorMessage || '证券排序保存失败')
  }
}
function isWindowActive() {
  return document.visibilityState === 'visible' && document.hasFocus()
}

function syncWindowActivity() {
  const active = isWindowActive()
  fundFlowRanks.setWindowActive(active)
  if (!monitorStarted || active === lastReportedWindowActive) return

  lastReportedWindowActive = active
  quoteMonitor.updateWindowActivity(active)
}

function changeQuoteProvider(providerMode: QuoteProviderMode) {
  if (quoteProviderMode.value === providerMode) return
  quoteProviderMode.value = providerMode
  marketStore.setStatus('RUNNING')
  if (monitorStarted) quoteMonitor.updateProviderMode(providerMode)
}

function saveMonitorSettings(settings: { provider: QuoteProviderMode, pollingIntervalMs: number }) {
  const providerChanged = quoteProviderMode.value !== settings.provider
  quoteProviderMode.value = settings.provider
  pollingIntervalMs.value = settings.pollingIntervalMs
  marketStore.setStatus('RUNNING')

  if (monitorStarted) {
    if (providerChanged) quoteMonitor.updateProviderMode(settings.provider)
    quoteMonitor.updatePollingInterval(settings.pollingIntervalMs)
  }

  monitorSettingsOpen.value = false
  showSavedToast(`监测设置已保存：每 ${settings.pollingIntervalMs / 1000} 秒轮询`)
}

function openAlert(quote: SecurityQuote) {
  activeQuote.value = quote
  alertOpen.value = true
}

/** 分时详情复用 Worker 趋势快照，并按需补充腾讯主力资金数据。 */
function openIntradayTrend(target: IntradayTrendTarget) {
  activeTrendTarget.value = target
  intradayTrendDialogOpen.value = true
}

function openMarketIndexTrend(securityId: string) {
  const security = MARKET_INDEX_SECURITIES.find(item => item.securityId === securityId)
  if (!security) return
  openIntradayTrend({
    securityId: security.securityId,
    name: security.name,
    code: security.code,
    securityType: security.securityType
  })
}

async function refresh() {
  if (refreshing.value) return
  refreshing.value = true
  contentLoading.value = true
  try {
    await Promise.allSettled([
      quoteMonitor.forceRefresh(),
      // 筹码数据是日线级低频数据；手动刷新时只更新当前表格里已经加载过的证券。
      chipDistribution.refreshLoaded(visibleQuotes.value),
      // 成交额按产品约定仅在页面进入与用户手动刷新时请求。
      refreshMarketTurnover(),
      fundFlowRanks.refresh()
    ])
  } finally {
    refreshing.value = false
    contentLoading.value = false
  }
}

/**
 * 直连腾讯计算当前三市总成交额；仅在午盘/收盘采集窗口内申请服务端保存快照。
 * 实时展示失败不影响主行情表格的手动刷新。
 */
async function refreshMarketTurnover() {
  try {
    const live = await fetchTencentMarketTurnover()
    const phase = getClientMarketTurnoverPhase()
    let reference: MarketTurnoverSnapshot | null = null

    if (phase) {
      const previous = await fetchMarketTurnoverSnapshots(getPreviousWeekdayTradeDate())
      reference = previous.snapshots[phase] ?? null
      // 服务端会复核窗口、交易日和封存状态；此处只避免不必要的请求。
      await requestMarketTurnoverSnapshotUpdate(live.exchanges, live.sourceUpdatedAt)
    }

    marketTurnover.value = { total: sumMarketTurnover(live.exchanges), phase, reference }
  } catch (error) {
    console.warn('[ValueTicker] 获取市场成交额失败', error)
  }
}
function toggleMonitor() {
  paused.value = !paused.value
  fundFlowRanks.setPaused(paused.value)
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

async function signOut() {
  if (signingOut.value) return

  signingOut.value = true
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error

    quoteMonitor.stop()
    fundFlowRanks.stop()
    monitorStarted = false
    userConfigStore.reset()
    marketStore.reset()
    selectedGroupId.value = 'all'
    await navigateTo('/login', { replace: true })
  } catch (error) {
    showSavedToast(error instanceof Error ? error.message : '退出登录失败')
  } finally {
    signingOut.value = false
  }
}
function requestClearAlertNotifications() {
  if (marketStore.alertNotifications.length > 0) clearAlertNotificationsConfirmOpen.value = true
}

function clearAlertNotifications() {
  marketStore.clearAlertNotifications()
  clearAlertNotificationsConfirmOpen.value = false
  showSavedToast('站内提醒已清空')
}

async function saveAlertRules(rules: AlertRule[]) {
  if (!activeQuote.value) return

  try {
    if (rules.some(rule => rule.enabled)) {
      await browserNotifications.requestPermission()
    }
    await userConfigStore.saveSecurityAlerts(activeQuote.value.securityId, rules)
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

function exportGroups() {
  const payload: StockGroupsExportFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    groups: userConfigStore.stockGroups.map(group => ({
      name: group.name,
      isDefault: group.isDefault,
      members: group.members.map(({ addedAt: _addedAt, ...member }) => member)
    }))
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `value-ticker-groups-${formatExportDate(new Date())}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(link.href)
  showSavedToast(`已导出 ${payload.groups.length} 个分组`)
}

async function prepareGroupImport(file: File) {
  try {
    const parsed = stockGroupsExportFileSchema.safeParse(JSON.parse(await file.text()))
    if (!parsed.success) {
      showSavedToast(parsed.error.issues[0]?.message ?? '导入文件格式不合法')
      return
    }
    importedGroupsFile.value = parsed.data
    importGroupsConfirmOpen.value = true
  } catch {
    showSavedToast('无法读取 JSON 导入文件')
  }
}

function closeGroupImportConfirm() {
  if (userConfigStore.saving) return
  importGroupsConfirmOpen.value = false
  importedGroupsFile.value = null
}

async function importGroups() {
  const payload = importedGroupsFile.value
  if (!payload) return
  try {
    await userConfigStore.replaceGroups(payload)
    selectedGroupId.value = 'all'
    closeGroupImportConfirm()
    showSavedToast(`已导入 ${payload.groups.length} 个分组`)
  } catch (error) {
    console.error('[ValueTicker] 导入分组失败', error)
    showSavedToast(userConfigStore.errorMessage || '导入分组失败')
  }
}

function formatExportDate(value: Date) {
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(value.getDate())}`
}

function formatImportedAt(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
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
  if (!activeSecurity.value || selectedGroupId.value === 'all' || removingSecurity.value) return

  const groupId = selectedGroupId.value
  const securityId = activeSecurity.value.securityId
  removingSecurity.value = true
  closeRemoveSecurityConfirm()

  try {
    await userConfigStore.deleteMember(groupId, securityId)
    // 以持久化结果为准，确保当前分组列表与其他页面修改保持同步。
    await userConfigStore.loadConfig()
    const stillInAnyGroup = userConfigStore.stockGroups.some(group =>
      group.members.some(member => member.securityId === securityId)
    )
    // 仅在最后一个分组成员关系被删除后清理公共筹码缓存，避免影响其他分组继续使用。
    if (!stillInAnyGroup) await chipDistribution.removeCache(securityId)
    showSavedToast('证券已从当前分组移除')
  } catch (error) {
    console.error('[ValueTicker] 移除证券失败', error)
    showSavedToast(userConfigStore.errorMessage || '证券移除失败')
  } finally {
    removingSecurity.value = false
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
        :provider="quoteProviderMode"
        :polling-interval-ms="pollingIntervalMs"
        :refreshing="refreshing"
        :last-updated-at="lastUpdatedAt"
        :notification-count="marketStore.alertNotifications.length"
        :user-email="userEmail"
        :signing-out="signingOut"
        :status="marketStore.status"
        @provider-change="changeQuoteProvider"
        @toggle="toggleMonitor"
        @refresh="refresh"
        @settings="monitorSettingsOpen = true"
        @notifications="alertNotificationsOpen = true"
        @sign-out="signOut"
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

    <main class="relative min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-4 sm:px-6 sm:pt-6">
      <DashboardLoadingOverlay
        v-if="contentLoading"
        :refreshing="refreshing"
      />
      <div class="mx-auto min-h-full max-w-[1680px]">
        <div
          class="grid min-h-full min-w-0 gap-4"
          :class="groupSidebarCollapsed
            ? 'lg:grid-cols-[72px_minmax(0,1fr)] xl:grid-cols-[72px_minmax(0,1fr)_280px]'
            : 'lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_280px]'"
        >
          <GroupSidebar
            v-model:collapsed="groupSidebarCollapsed"
            :groups="groups"
            :selected-id="selectedGroupId"
            @select="selectGroup"
            @add="openGroupForm"
            @rename="openRenameGroupForm"
            @delete="openDeleteGroupConfirm"
            @reorder="reorderGroups"
            @settings="monitorSettingsOpen = true"
            @export="exportGroups"
            @import="prepareGroupImport"
          />

          <div class="min-w-0 space-y-4">
            <QuoteMonitorPanel
              v-model:search="search"
              v-model:only-alerted="onlyAlerted"
              :title="selectedGroup.name"
              :quotes="visibleQuotes"
              :trends="marketStore.intradayTrends"
              :fund-flow-ranks="fundFlowRanks.rankByCode.value"
              :fund-flow-rank-total="fundFlowRanks.total.value"
              :can-remove="selectedGroupId !== 'all'"
              :polling-interval-ms="pollingIntervalMs"
              @alert="openAlert"
              @add="openAddSecurity"
              @remove="openRemoveSecurityConfirm"
              @move="openTransferDialog('MOVE', $event)"
              @copy="openTransferDialog('COPY', $event)"
              @reorder="reorderGroupMembers"
              @trend-open="openIntradayTrend"
            />

            <QuoteHealthCards
              :delayed-count="delayedQuoteCount"
              :enabled-alert-count="enabledAlertCount"
              :covered-security-count="coveredAlertSecurityCount"
              :health-percent="quoteHealthPercent"
              :provider-latency="marketStore.providerLatencyMs"
              :monitor-status="marketStore.status"
            />
          </div>

          <div class="lg:col-start-2 xl:col-start-auto">
            <MarketInsightRail
              :notifications="marketStore.alertNotifications"
              :index-quotes="marketIndexQuotes"
              :index-trends="marketStore.intradayTrends"
              :watchlist-quotes="configuredQuotes"
              :market-turnover="marketTurnover"
              @clear-notifications="requestClearAlertNotifications"
              @trend-open="openMarketIndexTrend"
            />
          </div>
        </div>
      </div>
    </main>

    <AlertNotificationsDialog
      :open="alertNotificationsOpen"
      :notifications="marketStore.alertNotifications"
      @close="alertNotificationsOpen = false"
      @clear="requestClearAlertNotifications"
    />

    <IntradayTrendDialog
      :open="intradayTrendDialogOpen"
      :target="activeTrendTarget"
      :trend="activeTrend"
      @close="intradayTrendDialogOpen = false"
    />

    <AlertRuleDrawer
      :open="alertOpen"
      :quote="activeQuote"
      :rules="activeAlertRules"
      :cost-price="activeQuote ? activeAlerts[activeQuote.securityId]?.costPrice : null"
      :saving="userConfigStore.saving"
      @close="alertOpen = false"
      @save="saveAlertRules"
    />

    <MonitorSettingsDialog
      :open="monitorSettingsOpen"
      :provider="quoteProviderMode"
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

    <GroupImportConfirmDialog
      :open="importGroupsConfirmOpen"
      :group-count="importedGroupsFile?.groups.length ?? 0"
      :security-count="new Set(importedGroupsFile?.groups.flatMap(group => group.members.map(member => member.securityId)) ?? []).size"
      :exported-at="importedGroupsFile ? formatImportedAt(importedGroupsFile.exportedAt) : ''"
      :pending="userConfigStore.saving"
      @close="closeGroupImportConfirm"
      @confirm="importGroups"
    />

    <AddSecurityDialog
      :open="addSecurityOpen"
      :group-name="addTargetGroup?.name ?? '默认分组'"
      :existing-security-ids="addTargetSecurityIds"
      @close="addSecurityOpen = false"
      @select="addSecurity"
    />

    <ConfirmDialog
      :open="clearAlertNotificationsConfirmOpen"
      title="清空站内提醒"
      message="确定清空当前页面会话内的提醒记录吗？此操作不会撤回已发送的系统通知。"
      confirm-text="清空提醒"
      @close="clearAlertNotificationsConfirmOpen = false"
      @confirm="clearAlertNotifications"
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
      :pending="removingSecurity"
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

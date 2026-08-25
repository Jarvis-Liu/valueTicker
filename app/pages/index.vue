<script setup lang="ts">
import { IconCircleCheck } from '@tabler/icons-vue'
import { useDashboardQuoteView } from '~/composables/dashboard/useDashboardQuoteView'
import { useDashboardMonitoring, type DashboardMonitorSettings } from '~/composables/dashboard/useDashboardMonitoring'
import { useMarketTurnover } from '~/composables/dashboard/useMarketTurnover'
import { useGroupManagement } from '~/composables/dashboard/groups/useGroupManagement'
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
import type { IntradayTrendTarget, SecurityQuote } from '~/types/market'
import type { AlertRule } from '~~/shared/types/stock'
import { MARKET_INDEX_SECURITIES } from '~/utils/market-indices'

const userConfigStore = useUserConfigStore()
const marketStore = useMarketStore()
const browserNotifications = useBrowserNotifications()
const chipDistribution = useChipDistribution()
const supabase = useSupabaseClient()
const supabaseUser = useSupabaseUser()

const selectedGroupId = ref('all')
// 延迟到客户端挂载后读取，确保 SSR 水合期间父级网格与 GroupSidebar 使用同一个初始状态。
const groupSidebarCollapsed = useLocalStorage<boolean>('value-ticker:group-sidebar-collapsed', false, {
  initOnMounted: true
})
const signingOut = ref(false)
const alertOpen = ref(false)
const intradayTrendDialogOpen = ref(false)
const activeTrendTarget = ref<IntradayTrendTarget | null>(null)
const alertNotificationsOpen = ref(false)
const clearAlertNotificationsConfirmOpen = ref(false)
const activeQuote = ref<SecurityQuote | null>(null)
const savedToast = ref(false)
const toastMessage = ref('操作已完成')
const monitorSettingsOpen = ref(false)

const {
  search,
  onlyAlerted,
  configuredQuotes,
  visibleQuotes,
  lastUpdatedAt,
  delayedQuoteCount,
  quoteHealthPercent,
  enabledAlertCount,
  coveredAlertSecurityCount,
  subscriptionSecurities,
  trendSecurities,
  rankStockCodes,
  marketIndexQuotes
} = useDashboardQuoteView(selectedGroupId)

const userEmail = computed(() => {
  const email = (supabaseUser.value as { email?: unknown } | null)?.email
  return typeof email === 'string' ? email : ''
})
const activeTrend = computed(() => activeTrendTarget.value ? marketStore.intradayTrends[activeTrendTarget.value.securityId] : undefined)
const activeAlertRules = computed(() => activeQuote.value ? userConfigStore.config?.alerts[activeQuote.value.securityId]?.rules ?? [] : [])
const activeAlerts = computed(() => userConfigStore.config?.alerts ?? {})

const {
  marketTurnover,
  refreshMarketTurnover
} = useMarketTurnover()

const {
  quoteProviderMode,
  pollingIntervalMs,
  paused,
  refreshing,
  contentLoading,
  fundFlowRanks,
  startMonitoring,
  stopMonitoring,
  completeInitialLoading,
  refreshGroupSecurities,
  changeQuoteProvider,
  saveMonitoringSettings,
  toggleMonitor,
  refresh
} = useDashboardMonitoring({
  subscriptionSecurities,
  trendSecurities,
  rankStockCodes,
  activeAlerts,
  visibleQuotes,
  refreshAdditionalData: quotes => [
    // 筹码数据是日线级低频数据；手动刷新时只更新当前表格里已经加载过的证券。
    chipDistribution.refreshLoaded(quotes),
    // 成交额按产品约定仅在页面进入与用户手动刷新时请求。
    refreshMarketTurnover()
  ]
})

const {
  groups,
  activeSecurity,
  groupFormOpen,
  groupFormMode,
  activeGroup,
  deleteConfirmOpen,
  addSecurityOpen,
  removeSecurityConfirmOpen,
  removingSecurity,
  selectedGroup,
  addTargetGroup,
  addTargetSecurityIds,
  editableGroupNames,
  selectGroup,
  reorderGroups,
  reorderGroupMembers,
  openGroupForm,
  closeGroupForm,
  openRenameGroupForm,
  submitGroupForm,
  openDeleteGroupConfirm,
  closeDeleteGroupConfirm,
  deleteGroup,
  openAddSecurity,
  addSecurity,
  openRemoveSecurityConfirm,
  closeRemoveSecurityConfirm,
  removeSecurity,
  transferDialogOpen,
  transferMode,
  transferGroups,
  openTransferDialog,
  closeTransferDialog,
  transferSecurity,
  importedGroupsFile,
  importGroupsConfirmOpen,
  exportGroups,
  prepareGroupImport,
  closeGroupImportConfirm,
  importGroups,
  formatImportedAt
} = useGroupManagement({
  selectedGroupId,
  refreshGroupSecurities,
  removeChipCache: chipDistribution.removeCache,
  notify: showSavedToast
})

onMounted(async () => {
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await userConfigStore.loadConfig()
        // 页面进入只请求一次腾讯成交额；它不加入 5 秒行情轮询。
        void refreshMarketTurnover()
        startMonitoring()
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
    completeInitialLoading()
  }
})

function saveMonitorSettings(settings: DashboardMonitorSettings) {
  saveMonitoringSettings(settings)
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

    stopMonitoring()
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

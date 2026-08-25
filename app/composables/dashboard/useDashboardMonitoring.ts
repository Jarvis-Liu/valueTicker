import { onMounted, onUnmounted, readonly, ref, watch, type Ref } from 'vue'
import type { QuoteProviderMode } from '~/services/quotes/types'
import type { SecurityQuote } from '~/types/market'
import { getGroupSecurities } from '~/utils/polling-securities'
import type { SecurityAlerts, SecurityItem } from '~~/shared/types/stock'

/** Dashboard 监测设置表单提交的数据。 */
export interface DashboardMonitorSettings {
  /** 行情数据源策略。 */
  provider: QuoteProviderMode
  /** 自动行情轮询间隔，单位为毫秒。 */
  pollingIntervalMs: number
}

/** useDashboardMonitoring 依赖的 Dashboard 派生状态和扩展刷新任务。 */
interface DashboardMonitoringOptions {
  /** 自动轮询使用的全分组证券及市场指数。 */
  subscriptionSecurities: Readonly<Ref<SecurityItem[]>>
  /** 当前分组分时图使用的证券及市场指数。 */
  trendSecurities: Readonly<Ref<SecurityItem[]>>
  /** 资金排名接口需要关注的股票代码。 */
  rankStockCodes: Readonly<Ref<string[]>>
  /** 当前用户全部证券提醒配置。 */
  activeAlerts: Readonly<Ref<Record<string, SecurityAlerts>>>
  /** 当前主表格实际展示的行情行，供低频扩展数据刷新使用。 */
  visibleQuotes: Readonly<Ref<SecurityQuote[]>>
  /** 页面手动刷新时一并执行的低频任务，例如筹码和市场成交额。 */
  refreshAdditionalData?: (quotes: SecurityQuote[]) => Array<Promise<unknown>>
}

/**
 * 负责 Dashboard 行情监测的页面级编排：
 * 1. 启动和停止行情 Worker、资金排名轮询；
 * 2. 同步证券、分时趋势、提醒规则和页面前后台状态；
 * 3. 管理数据源、轮询间隔及暂停/继续状态；
 * 4. 编排用户手动刷新，并向页面提供真实请求周期的 Loading 状态。
 *
 * 该 composable 不负责用户配置加载、分组 CRUD、成交额计算或弹框状态，
 * 页面可以通过 refreshAdditionalData 将低频刷新任务加入手动刷新流程。
 */
export function useDashboardMonitoring(options: DashboardMonitoringOptions) {
  /** 用户配置 Store，用于切换分组时构造该分组的一次性行情请求。 */
  const userConfigStore = useUserConfigStore()

  /** 市场 Store，用于在数据源设置变化时同步 Header 的运行状态。 */
  const marketStore = useMarketStore()

  /** 行情 Worker 控制器，承载实时行情、分时图和提醒计算。 */
  const quoteMonitor = useQuoteMonitor()

  /** 全市场资金排名控制器，与行情监测共享前后台和暂停状态。 */
  const fundFlowRanks = useFundFlowRanks()

  /** 用户选择的行情数据源模式，持久化在当前浏览器。 */
  const quoteProviderMode = useLocalStorage<QuoteProviderMode>('value-ticker:provider-mode', 'MIXED')

  /** 用户选择的自动行情轮询间隔，持久化在当前浏览器。 */
  const pollingIntervalMs = useLocalStorage<number>('value-ticker:polling-interval-ms', 5000)

  /** Header 暂停按钮状态；暂停只停止自动任务，仍允许手动刷新。 */
  const paused = ref(false)

  /** 是否正在执行用户手动刷新，用于按钮防重和 Loading 展示。 */
  const refreshing = ref(false)

  /** 主体 Loading 状态，只覆盖初始配置加载和用户手动刷新。 */
  const contentLoading = ref(true)

  /** 行情监测是否已经成功启动，避免配置加载前向 Worker 发送更新消息。 */
  let monitorStarted = false

  /** 最近一次上报给 Worker 的窗口活动状态，用于过滤重复事件。 */
  let lastReportedWindowActive: boolean | null = null

  /**
   * 在用户配置加载成功后启动行情 Worker与资金排名轮询，
   * 同时同步当前分时证券和浏览器窗口活动状态。
   */
  function startMonitoring() {
    if (monitorStarted) return

    quoteMonitor.start(
      options.subscriptionSecurities.value,
      quoteProviderMode.value,
      options.activeAlerts.value,
      pollingIntervalMs.value
    )
    monitorStarted = true
    lastReportedWindowActive = isWindowActive()
    quoteMonitor.updateWindowActivity(lastReportedWindowActive)
    quoteMonitor.updateTrendSecurities(options.trendSecurities.value)
    fundFlowRanks.start(options.rankStockCodes.value)
    fundFlowRanks.setWindowActive(lastReportedWindowActive)
  }

  /** 停止并销毁 Dashboard 的行情 Worker 和资金排名轮询。 */
  function stopMonitoring() {
    quoteMonitor.stop()
    fundFlowRanks.stop()
    monitorStarted = false
    lastReportedWindowActive = null
  }

  /** 初始配置加载完成后关闭主体 Loading，成功和失败场景均应调用。 */
  function completeInitialLoading() {
    contentLoading.value = false
  }

  /**
   * 切换分组时只请求目标分组证券的一次行情快照；
   * 不改变自动轮询使用的全量证券订阅。
   */
  function refreshGroupSecurities(groupId: string) {
    if (!monitorStarted) return
    quoteMonitor.refreshSecurities(getGroupSecurities(userConfigStore.stockGroups, groupId))
  }

  /** 立即切换行情数据源模式，并通知已启动的 Worker 重建数据源策略。 */
  function changeQuoteProvider(providerMode: QuoteProviderMode) {
    if (quoteProviderMode.value === providerMode) return
    quoteProviderMode.value = providerMode
    marketStore.setStatus('RUNNING')
    if (monitorStarted) quoteMonitor.updateProviderMode(providerMode)
  }

  /** 保存数据源和轮询间隔设置，并同步至正在运行的 Worker。 */
  function saveMonitoringSettings(settings: DashboardMonitorSettings) {
    const providerChanged = quoteProviderMode.value !== settings.provider
    quoteProviderMode.value = settings.provider
    pollingIntervalMs.value = settings.pollingIntervalMs
    marketStore.setStatus('RUNNING')

    if (!monitorStarted) return
    if (providerChanged) quoteMonitor.updateProviderMode(settings.provider)
    quoteMonitor.updatePollingInterval(settings.pollingIntervalMs)
  }

  /** 暂停或恢复行情与资金排名的自动轮询。 */
  function toggleMonitor() {
    paused.value = !paused.value
    fundFlowRanks.setPaused(paused.value)
    if (paused.value) quoteMonitor.pause()
    else quoteMonitor.resume()
  }

  /**
   * 执行一次用户手动刷新；Loading 严格覆盖真实请求生命周期，
   * 任一扩展任务失败不会阻断其他行情数据更新。
   */
  async function refresh() {
    if (refreshing.value) return
    refreshing.value = true
    contentLoading.value = true

    try {
      const additionalTasks = options.refreshAdditionalData?.(options.visibleQuotes.value) ?? []
      await Promise.allSettled([
        quoteMonitor.forceRefresh(),
        fundFlowRanks.refresh(),
        ...additionalTasks
      ])
    } finally {
      refreshing.value = false
      contentLoading.value = false
    }
  }

  /** 判断页面当前是否可见且拥有焦点。 */
  function isWindowActive() {
    return document.visibilityState === 'visible' && document.hasFocus()
  }

  /** 将窗口焦点和可见性变化同步给行情与资金排名控制器。 */
  function syncWindowActivity() {
    const active = isWindowActive()
    fundFlowRanks.setWindowActive(active)
    if (!monitorStarted || active === lastReportedWindowActive) return

    lastReportedWindowActive = active
    quoteMonitor.updateWindowActivity(active)
  }

  /** 全量证券变化时更新 Worker 的自动轮询订阅。 */
  watch(options.subscriptionSecurities, (nextSecurities) => {
    if (!monitorStarted) return
    quoteMonitor.updateSecurities(nextSecurities, quoteProviderMode.value)
  }, { deep: true })

  /** 股票代码变化时同步资金排名关注范围。 */
  watch(options.rankStockCodes, nextCodes => fundFlowRanks.updateCodes(nextCodes), { deep: true })

  /** 当前分组变化时同步 Worker 的分时趋势订阅。 */
  watch(options.trendSecurities, (nextSecurities) => {
    if (!monitorStarted) return
    quoteMonitor.updateTrendSecurities(nextSecurities)
  }, { deep: true })

  /** 提醒规则变化时同步 Worker 的阈值判断配置。 */
  watch(options.activeAlerts, (nextAlerts) => {
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
    stopMonitoring()
  })

  return {
    /** 当前行情数据源模式。 */
    quoteProviderMode,
    /** 当前自动行情轮询间隔。 */
    pollingIntervalMs,
    /** 自动监测是否已由用户暂停。 */
    paused: readonly(paused),
    /** 用户手动刷新是否仍在执行。 */
    refreshing: readonly(refreshing),
    /** Dashboard 主体是否应展示 Loading。 */
    contentLoading: readonly(contentLoading),
    /** 资金排名数据及其加载状态，供行情表格展示。 */
    fundFlowRanks,
    /** 配置加载成功后启动监测。 */
    startMonitoring,
    /** 登出或页面销毁前停止监测。 */
    stopMonitoring,
    /** 结束页面初始 Loading。 */
    completeInitialLoading,
    /** 切换分组时请求该组的一次性行情。 */
    refreshGroupSecurities,
    /** 从 Header 快捷切换行情数据源。 */
    changeQuoteProvider,
    /** 保存监测设置。 */
    saveMonitoringSettings,
    /** 暂停或恢复自动监测。 */
    toggleMonitor,
    /** 执行用户手动刷新。 */
    refresh
  }
}

import { computed, ref, type Ref } from 'vue'
import { useMarketStore } from '~/stores/market'
import { useUserConfigStore } from '~/stores/user-config'
import type { NormalizedQuote } from '~/services/quotes/types'
import type { SecurityQuote } from '~/types/market'
import { MARKET_INDEX_SECURITIES } from '~/utils/market-indices'
import { getGroupSecurities, getPollingSecurities } from '~/utils/polling-securities'
import type { SecurityItem } from '~~/shared/types/stock'

/**
 * 负责 Dashboard 行情视图的状态与派生数据：
 * 1. 管理主表格搜索和“只看提醒”筛选；
 * 2. 将用户分组配置与实时行情 Store 合成为可渲染行；
 * 3. 计算行情健康度、提醒覆盖数和 Header 最后更新时间；
 * 4. 生成 Worker 全量报价订阅、当前分组趋势订阅和资金排名代码；
 * 5. 提供市场概览使用的主要指数行情。
 *
 * 该 composable 不负责分组选择、配置 CRUD、Worker 生命周期或网络请求，
 * 这些跨领域操作仍由页面入口和对应 Store/composable 编排。
 *
 * @param selectedGroupId 页面当前选择的分组 ID；`all` 表示合并全部分组并按证券 ID 去重。
 */
export function useDashboardQuoteView(selectedGroupId: Ref<string>) {
  /** 用户配置 Store，提供分组成员及每只证券的提醒规则。 */
  const userConfigStore = useUserConfigStore()

  /** 实时市场 Store，提供 Worker 最近写入的行情和指数快照。 */
  const marketStore = useMarketStore()

  /** 主表格名称/代码搜索关键字，仅影响当前视图展示。 */
  const search = ref('')

  /** 是否只展示已启用至少一条提醒规则的证券，不影响行情订阅和提醒判断。 */
  const onlyAlerted = ref(false)

  /**
   * 当前分组的完整行情行集合；全部分组视图按 securityId 去重，
   * 尚无实时行情的证券使用待更新占位行。
   */
  const configuredQuotes = computed<SecurityQuote[]>(() => {
    /** 按 Store 顺序排列的持久化用户分组。 */
    const persistedGroups = userConfigStore.stockGroups

    /** 当前视图需要展示的分组成员；全部视图保留证券首次出现时的顺序。 */
    const members = selectedGroupId.value === 'all'
      ? Array.from(new Map(persistedGroups.flatMap(group => group.members).map(member => [member.securityId, member])).values())
      : persistedGroups.find(group => group.id === selectedGroupId.value)?.members ?? []

    return members.map((member) => {
      /** 当前证券所属的全部用户分组 ID，供表格操作和上下文展示使用。 */
      const groupIds = persistedGroups
        .filter(group => group.members.some(item => item.securityId === member.securityId))
        .map(group => group.id)

      /** 当前证券已启用的提醒规则数量。 */
      const alertCount = userConfigStore.config?.alerts[member.securityId]?.rules.filter(rule => rule.enabled).length ?? 0

      /** 实时行情返回前使用的统一待更新占位行。 */
      const pendingQuote = createPendingQuote(member, groupIds, alertCount)

      /** Worker 最近写入的标准化行情；不存在时继续展示占位行。 */
      const liveQuote = marketStore.quotes[member.securityId]
      if (!liveQuote) return pendingQuote

      return {
        ...pendingQuote,
        ...liveQuote,
        status: liveQuote.status === 'ERROR' ? 'STALE' : liveQuote.status,
        name: member.name,
        code: member.code,
        securityType: member.securityType === 'ETF' ? 'ETF' : 'STOCK',
        boardLabel: member.boardLabel || undefined,
        groupIds,
        alertCount
      }
    })
  })

  /** 应用搜索与提醒筛选后交给主表格渲染的行情行。 */
  const visibleQuotes = computed(() => {
    /** 用于不区分英文大小写匹配名称和代码的规范化关键字。 */
    const keyword = search.value.trim().toLowerCase()

    return configuredQuotes.value.filter((quote) => {
      /** 当前证券是否命中空搜索、名称搜索或代码搜索。 */
      const matchesSearch = !keyword || quote.name.toLowerCase().includes(keyword) || quote.code.includes(keyword)
      return matchesSearch && (!onlyAlerted.value || quote.alertCount > 0)
    })
  })

  /** Header 与交易日历展示的全局最新行情时间，不受当前表格筛选和排序影响。 */
  const lastUpdatedAt = computed(() => marketStore.lastUpdatedAt ?? '待更新')

  /** 当前分组中状态正常且价格有效的证券数量。 */
  const healthyQuoteCount = computed(() => configuredQuotes.value.filter(quote => quote.status === 'TRADING' && Number.isFinite(quote.price)).length)

  /** 当前分组中行情延迟或尚无有效价格的证券数量。 */
  const delayedQuoteCount = computed(() => configuredQuotes.value.filter(quote => quote.status === 'STALE' || !Number.isFinite(quote.price)).length)

  /** 当前分组健康证券占比；空分组返回 null，避免展示伪造的 0%。 */
  const quoteHealthPercent = computed(() => configuredQuotes.value.length ? healthyQuoteCount.value / configuredQuotes.value.length * 100 : null)

  /** 当前分组所有证券已启用提醒规则的总数。 */
  const enabledAlertCount = computed(() => configuredQuotes.value.reduce((total, quote) => total + quote.alertCount, 0))

  /** 当前分组至少启用一条提醒规则的证券数量。 */
  const coveredAlertSecurityCount = computed(() => configuredQuotes.value.filter(quote => quote.alertCount > 0).length)

  /** Worker 主行情自动轮询使用的全分组去重证券集合，并附带市场指数。 */
  const subscriptionSecurities = computed<SecurityItem[]>(() => getPollingSecurities(userConfigStore.stockGroups, MARKET_INDEX_SECURITIES))

  /** 当前分组分时趋势请求使用的证券集合，并附带市场指数。 */
  const trendSecurities = computed<SecurityItem[]>(() => getGroupSecurities(userConfigStore.stockGroups, selectedGroupId.value, MARKET_INDEX_SECURITIES))

  /** 全市场资金净流入排名需要匹配的沪深北股票代码，不包含 ETF 和指数。 */
  const rankStockCodes = computed(() => subscriptionSecurities.value
    .filter(security => security.securityType === 'STOCK' && ['SSE:', 'SZSE:', 'BSE:'].some(prefix => security.securityId.startsWith(prefix)))
    .map(security => security.code))

  /** 市场概览组件使用的已返回主要指数行情，缺失指数不会生成占位记录。 */
  const marketIndexQuotes = computed<NormalizedQuote[]>(() => MARKET_INDEX_SECURITIES
    .map(index => marketStore.quotes[index.securityId])
    .filter((quote): quote is NormalizedQuote => Boolean(quote)))

  return {
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
  }
}

/**
 * 为尚未取得实时行情的分组成员构造稳定的表格占位行。
 * 数值字段使用 NaN，让各展示组件统一渲染为 `--`，避免误用静态 Demo 行情。
 *
 * @param member 用户分组中的证券配置。
 * @param groupIds 该证券所属的全部分组 ID。
 * @param alertCount 该证券已启用的提醒规则数量。
 */
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

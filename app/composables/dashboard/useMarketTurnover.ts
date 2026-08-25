import { ref } from 'vue'
import { fetchMarketTurnoverSnapshots, requestMarketTurnoverSnapshotUpdate } from '~/services/api/market-turnover'
import { fetchTencentMarketTurnover } from '~/services/market-turnover/tencent-market-turnover'
import { getClientMarketTurnoverPhase, getPreviousWeekdayTradeDate, sumMarketTurnover, type MarketTurnoverDisplay } from '~/utils/market-turnover'
import type { MarketTurnoverSnapshot } from '~~/shared/types/market-turnover'

/**
 * 负责 Dashboard 三市成交额的低频查询与对比：
 * 1. 浏览器直连腾讯接口取得沪、深、北三市实时成交额；
 * 2. 在午盘或收盘窗口查询上一交易日同阶段快照；
 * 3. 向服务端申请保存当前阶段快照，由服务端复核时间与封存状态；
 * 4. 只输出前端展示需要的总额、阶段和对比基准。
 *
 * 该 composable 不加入实时行情自动轮询，由页面初始加载和用户手动刷新显式调用。
 */
export function useMarketTurnover() {
  /** 当前页面展示的三市成交总额、所处阶段及上一交易日对比快照。 */
  const marketTurnover = ref<MarketTurnoverDisplay | null>(null)

  /**
   * 刷新三市成交额，并在允许的采集窗口申请保存服务端快照。
   * 请求失败时保留上一份可用展示数据，不影响主行情表格。
   */
  async function refreshMarketTurnover() {
    try {
      const live = await fetchTencentMarketTurnover()
      const phase = getClientMarketTurnoverPhase()
      let reference: MarketTurnoverSnapshot | null = null

      if (phase) {
        const previous = await fetchMarketTurnoverSnapshots(getPreviousWeekdayTradeDate())
        reference = previous.snapshots[phase] ?? null
        // 服务端会复核采集窗口、交易日和封存状态；前端只负责申请更新。
        await requestMarketTurnoverSnapshotUpdate(live.exchanges, live.sourceUpdatedAt)
      }

      marketTurnover.value = {
        total: sumMarketTurnover(live.exchanges),
        phase,
        reference
      }
    } catch (error) {
      console.warn('[ValueTicker] 获取市场成交额失败', error)
    }
  }

  return {
    /** 三市成交额展示数据。 */
    marketTurnover,
    /** 页面进入或手动刷新时更新三市成交额。 */
    refreshMarketTurnover
  }
}

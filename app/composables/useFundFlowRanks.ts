import { fetchFundFlowRanks } from '~/services/api/fund-flow-ranks'
import { getNextAutomaticRefreshAt, isContinuousAuction } from '~/utils/market-calendar'
import type { FundFlowRankEntry } from '~~/shared/types/fund-flow'

/** 维护页面级的一分钟排名订阅；窗口非活动、暂停或非连续竞价时不发请求。 */
export function useFundFlowRanks() {
  const rankByCode = useState<Record<string, FundFlowRankEntry>>('fund-flow-rank-by-code', () => ({}))
  const total = useState<number>('fund-flow-rank-total', () => 0)
  const updatedAt = useState<string>('fund-flow-rank-updated-at', () => '')
  const loading = useState<boolean>('fund-flow-rank-loading', () => false)
  const errorMessage = useState<string>('fund-flow-rank-error', () => '')
  let codes: string[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  let started = false
  let active = false
  let paused = false
  let pendingRequest: Promise<void> | null = null

  function start(nextCodes: string[]) {
    codes = normalizeCodes(nextCodes)
    started = true
    if (active) {
      void refresh()
      schedule()
    }
  }

  function stop() {
    started = false
    clearTimeout(timer)
    timer = undefined
  }

  function updateCodes(nextCodes: string[]) {
    const normalized = normalizeCodes(nextCodes)
    if (normalized.join(',') === codes.join(',')) return
    codes = normalized
    if (!codes.length) rankByCode.value = {}
    else if (started && active && !paused) void refresh()
  }

  function setWindowActive(value: boolean) {
    if (active === value) return
    active = value
    if (!active) {
      clearTimeout(timer)
      timer = undefined
      return
    }
    if (started && !paused) {
      void refresh()
      schedule()
    }
  }

  function setPaused(value: boolean) {
    paused = value
    if (paused) {
      clearTimeout(timer)
      timer = undefined
    } else if (started && active) {
      void refresh()
      schedule()
    }
  }

  async function refresh() {
    if (!codes.length) return
    if (pendingRequest) return pendingRequest

    pendingRequest = (async () => {
      loading.value = true
      errorMessage.value = ''
      try {
        const snapshot = await fetchFundFlowRanks(codes)
        total.value = snapshot.total
        updatedAt.value = snapshot.updatedAt
        rankByCode.value = Object.fromEntries(snapshot.entries.map(entry => [entry.code, entry]))
      } catch (error) {
        errorMessage.value = error instanceof Error ? error.message : '全市场资金流排名请求失败'
      } finally {
        loading.value = false
        pendingRequest = null
      }
    })()
    return pendingRequest
  }

  function schedule() {
    clearTimeout(timer)
    if (!started || !active || paused) return
    const nextRunAt = getNextAutomaticRefreshAt(new Date(), 60_000)
    timer = setTimeout(async () => {
      if (isContinuousAuction()) await refresh()
      schedule()
    }, Math.max(1000, nextRunAt.getTime() - Date.now()))
  }

  function normalizeCodes(values: string[]) {
    return [...new Set(values.filter(code => /^\d{6}$/.test(code)))].sort()
  }

  return { rankByCode, total, updatedAt, loading, errorMessage, start, stop, updateCodes, setWindowActive, setPaused, refresh }
}

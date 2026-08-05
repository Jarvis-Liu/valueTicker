import { fetchEastmoneyQuotes } from '../services/quotes/eastmoney.adapter'
import { fetchTencentQuotes } from '../services/quotes/tencent.adapter'
import { fetchEastmoneyIntradayTrend } from '../services/quotes/eastmoney-trends.adapter'
import { fetchTencentIntradayTrend } from '../services/quotes/tencent-trends.adapter'
import { evaluateQuoteAlerts } from '../utils/alert-engine'
import { getMarketSessionState, getNextAutomaticRefreshAt, isContinuousAuction } from '../utils/market-calendar'
import type { QuoteProvider, QuoteWorkerRequest, QuoteWorkerResponse, SecurityIntradayTrend } from '../services/quotes/types'
import type { SecurityAlerts, SecurityItem } from '~~/shared/types/stock'

let securities: SecurityItem[] = []
let trendSecurities: SecurityItem[] = []
let alertConfigs: Record<string, SecurityAlerts> = {}
let quoteTimer: ReturnType<typeof setTimeout> | undefined
let trendTimer: ReturnType<typeof setTimeout> | undefined
let running = false
let paused = false
let windowActive = false
let suppressNextAlerts = false
let trendRefreshInFlight = false
let trendRefreshPending = false
let trendRefreshPendingForce = false
let trendRequestVersion = 0
let provider: QuoteProvider = 'EASTMONEY'
let pollingIntervalMs = 5000

self.onmessage = async (event: MessageEvent<QuoteWorkerRequest>) => {
  const message = event.data

  if (message.type === 'START' || message.type === 'UPDATE_SECURITIES') {
    securities = message.securities
    if (message.provider) provider = message.provider
    if (message.type === 'START' && message.alerts) alertConfigs = message.alerts
    if (message.type === 'START') pollingIntervalMs = normalizePollingInterval(message.pollingIntervalMs)
    suppressNextAlerts = true
    if (message.type === 'START') {
      running = true
      paused = false
    }
    if (running) await refreshQuotes()
    scheduleQuotes()
    return
  }

  if (message.type === 'UPDATE_PROVIDER') {
    provider = message.provider
    suppressNextAlerts = true
    trendRequestVersion += 1
    await refreshQuotes()
    if (windowActive && isContinuousAuction()) await refreshTrends()
    scheduleQuotes()
    scheduleTrends()
    return
  }

  if (message.type === 'UPDATE_POLLING_INTERVAL') {
    pollingIntervalMs = normalizePollingInterval(message.pollingIntervalMs)
    scheduleQuotes()
    return
  }

  if (message.type === 'UPDATE_ALERTS') {
    alertConfigs = message.alerts
    return
  }

  if (message.type === 'UPDATE_TREND_SECURITIES') {
    const securitiesChanged = !hasSameSecurityIds(trendSecurities, message.securities)
    trendSecurities = message.securities
    if (securitiesChanged) trendRequestVersion += 1
    // 首次进入或切换分组属于主动请求：休市也拉取一次当日分时；后续自动刷新仍只在连续竞价时段执行。
    if (running && windowActive) await refreshTrends(true)
    scheduleTrends()
    return
  }

  if (message.type === 'UPDATE_WINDOW_ACTIVITY') {
    windowActive = message.active
    // 活跃状态仅影响自动轮询；不能废弃进入页面时已发出的强制趋势请求。
    if (windowActive && isContinuousAuction()) await refreshTrends()
    scheduleTrends()
    return
  }

  if (message.type === 'STOP') {
    running = false
    trendRequestVersion += 1
    trendRefreshPending = false
    trendRefreshPendingForce = false
    clearQuoteTimer()
    clearTrendTimer()
    post({ type: 'STATUS', status: 'IDLE' })
    return
  }

  if (message.type === 'PAUSE') {
    paused = true
    clearQuoteTimer()
    clearTrendTimer()
    post({ type: 'STATUS', status: 'PAUSED' })
    return
  }

  if (message.type === 'RESUME') {
    paused = false
    suppressNextAlerts = true
    if (isContinuousAuction()) await refreshQuotes()
    else postMarketStatus()
    scheduleQuotes()
    scheduleTrends()
    return
  }

  if (message.type === 'REFRESH_SECURITIES') {
    // 分组切换的行情快照与趋势订阅分离；趋势统一由 UPDATE_TREND_SECURITIES 驱动，避免双请求竞态。
    await refreshQuotes(message.securities)
    return
  }

  if (message.type === 'FORCE_REFRESH') {
    await refreshQuotes()
    await refreshTrends(true)
    scheduleQuotes()
    scheduleTrends()
  }
}

async function refreshQuotes(nextSecurities = securities) {
  if (!running || !nextSecurities.length) {
    postMarketStatus()
    return
  }

  try {
    const startedAt = Date.now()
    const quotes = await fetchQuotes(nextSecurities)
    post({ type: 'METRICS', providerLatencyMs: Date.now() - startedAt })
    post({ type: 'QUOTE_SNAPSHOT', quotes, securityIds: nextSecurities.map(item => item.securityId) })

    if (!isContinuousAuction()) {
      suppressNextAlerts = true
    } else if (suppressNextAlerts) {
      suppressNextAlerts = false
    } else {
      const securitiesById = new Map(nextSecurities.map(security => [security.securityId, security]))
      for (const quote of quotes) {
        const events = evaluateQuoteAlerts(quote, securitiesById.get(quote.securityId), alertConfigs[quote.securityId])
        for (const alertEvent of events) post({ type: 'ALERT_TRIGGERED', event: alertEvent })
      }
    }

    post({ type: 'STATUS', status: quotes.length ? currentMonitorStatus() : 'STALE' })
  } catch (error) {
    post({ type: 'METRICS', providerLatencyMs: null })
    post({ type: 'ERROR', message: error instanceof Error ? error.message : '行情请求失败' })
    post({ type: 'STATUS', status: 'ERROR' })
  }
}

async function refreshTrends(force = false) {
  const canAutomaticallyRefresh = !paused && windowActive && isContinuousAuction()
  if (!running || !trendSecurities.length || (!force && !canAutomaticallyRefresh)) return
  if (trendRefreshInFlight) {
    // 不丢弃请求期间到达的新分组/Provider 任务；当前请求结束后只补发一次最新快照。
    trendRefreshPending = true
    trendRefreshPendingForce ||= force
    return
  }

  trendRefreshInFlight = true
  const requestVersion = trendRequestVersion
  const requestedSecurities = [...trendSecurities]

  try {
    const trends = await fetchIntradayTrends(requestedSecurities)
    if (requestVersion !== trendRequestVersion || (!force && (!windowActive || !isContinuousAuction()))) return
    post({ type: 'TREND_SNAPSHOT', trends, securityIds: requestedSecurities.map(item => item.securityId) })
  } finally {
    trendRefreshInFlight = false
    if (trendRefreshPending) {
      const pendingForce = trendRefreshPendingForce
      trendRefreshPending = false
      trendRefreshPendingForce = false
      void refreshTrends(pendingForce)
    }
  }
}

async function fetchIntradayTrends(nextSecurities: SecurityItem[]) {
  const results: SecurityIntradayTrend[] = []
  let index = 0

  async function consume() {
    while (index < nextSecurities.length) {
      const security = nextSecurities[index++]!
      try {
        results.push(await fetchIntradayTrend(security))
      } catch {
        results.push({
          securityId: security.securityId,
          previousClose: Number.NaN,
          openingPrice: Number.NaN,
          points: [],
          updatedAt: '',
          provider,
          status: 'ERROR'
        })
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(4, nextSecurities.length) }, consume))
  return results
}

function fetchQuotes(nextSecurities: SecurityItem[]) {
  return provider === 'TENCENT' ? fetchTencentQuotes(nextSecurities) : fetchEastmoneyQuotes(nextSecurities)
}

function fetchIntradayTrend(security: SecurityItem) {
  // 趋势图按证券路由：北交所和韩国 KOSPI 需要东财覆盖，其余证券优先腾讯，降低东财请求量与封禁风险。
  // 主行情 Provider 的切换不影响这一独立趋势源策略。
  if (security.exchange === 'BSE' || security.providerSymbols.eastmoney?.startsWith('100.') === true) {
    return fetchEastmoneyIntradayTrend(security)
  }
  return fetchTencentIntradayTrend(security)
}

function hasSameSecurityIds(left: SecurityItem[], right: SecurityItem[]) {
  return left.length === right.length && left.every((security, index) => security.securityId === right[index]?.securityId)
}

function scheduleQuotes() {
  clearQuoteTimer()
  if (!running || paused) return

  const nextRunAt = getNextAutomaticRefreshAt(new Date(), pollingIntervalMs)
  quoteTimer = setTimeout(async () => {
    if (!running || paused) return
    await refreshQuotes()
    scheduleQuotes()
  }, Math.max(0, nextRunAt.getTime() - Date.now()))
  postMarketStatus()
}

function scheduleTrends() {
  clearTrendTimer()
  if (!running || paused || !windowActive || !trendSecurities.length) return

  const nextRunAt = getNextAutomaticRefreshAt(new Date(), 60_000)
  trendTimer = setTimeout(async () => {
    if (running && !paused && windowActive && isContinuousAuction()) await refreshTrends()
    scheduleTrends()
  }, Math.max(0, nextRunAt.getTime() - Date.now()))
}

function currentMonitorStatus() {
  return isContinuousAuction() ? 'RUNNING' : 'MARKET_CLOSED'
}

function postMarketStatus() {
  if (!paused && running) post({ type: 'STATUS', status: currentMonitorStatus(), message: getMarketSessionState().label })
}

function clearQuoteTimer() {
  if (quoteTimer) clearTimeout(quoteTimer)
  quoteTimer = undefined
}

function clearTrendTimer() {
  if (trendTimer) clearTimeout(trendTimer)
  trendTimer = undefined
}

function normalizePollingInterval(value?: number) {
  if (!Number.isFinite(value)) return 5000
  return Math.max(5000, Math.floor(value as number))
}

function post(message: QuoteWorkerResponse) {
  self.postMessage(message)
}

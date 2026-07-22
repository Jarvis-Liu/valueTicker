import { fetchEastmoneyQuotes } from '../services/quotes/eastmoney.adapter'
import { fetchTencentQuotes } from '../services/quotes/tencent.adapter'
import { evaluateQuoteAlerts } from '../utils/alert-engine'
import { getMarketSessionState, getNextAutomaticRefreshAt, isContinuousAuction } from '../utils/market-calendar'
import type { QuoteProvider, QuoteWorkerRequest, QuoteWorkerResponse } from '../services/quotes/types'
import type { SecurityAlerts, SecurityItem } from '~~/shared/types/stock'

let securities: SecurityItem[] = []
let alertConfigs: Record<string, SecurityAlerts> = {}
let timer: ReturnType<typeof setTimeout> | undefined
let running = false
let paused = false
let suppressNextAlerts = false
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
    // 首次进入与切换分组属于用户发起的请求，闭市时仍允许执行一次。
    if (running) await refresh()
    schedule()
  } else if (message.type === 'UPDATE_PROVIDER') {
    provider = message.provider
    suppressNextAlerts = true
    await refresh()
    schedule()
  } else if (message.type === 'UPDATE_POLLING_INTERVAL') {
    pollingIntervalMs = normalizePollingInterval(message.pollingIntervalMs)
    schedule()
  } else if (message.type === 'UPDATE_ALERTS') {
    alertConfigs = message.alerts
  } else if (message.type === 'STOP') {
    running = false
    clearTimer()
    post({ type: 'STATUS', status: 'IDLE' })
  } else if (message.type === 'PAUSE') {
    paused = true
    clearTimer()
    post({ type: 'STATUS', status: 'PAUSED' })
  } else if (message.type === 'RESUME') {
    paused = false
    suppressNextAlerts = true
    if (isContinuousAuction()) await refresh()
    else postMarketStatus()
    schedule()
  } else if (message.type === 'REFRESH_SECURITIES') {
    // 仅刷新当前视图；不覆盖自动轮询使用的全量证券订阅。
    await refresh(message.securities)
  } else if (message.type === 'FORCE_REFRESH') {
    await refresh()
    schedule()
  }
}

async function refresh(nextSecurities = securities) {
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
      // 非交易时段的快照只用于下一个交易时段建立提醒基准。
      suppressNextAlerts = true
    } else if (suppressNextAlerts) suppressNextAlerts = false
    else {
      const securitiesById = new Map(nextSecurities.map(security => [security.securityId, security]))
      for (const quote of quotes) {
        const events = evaluateQuoteAlerts(quote, securitiesById.get(quote.securityId), alertConfigs[quote.securityId])
        for (const event of events) post({ type: 'ALERT_TRIGGERED', event })
      }
    }
    post({ type: 'STATUS', status: quotes.length ? currentMonitorStatus() : 'STALE' })
  } catch (error) {
    post({ type: 'METRICS', providerLatencyMs: null })
    post({ type: 'ERROR', message: error instanceof Error ? error.message : '行情请求失败' })
    post({ type: 'STATUS', status: 'ERROR' })
  }
}

function fetchQuotes(nextSecurities: SecurityItem[]) {
  return provider === 'TENCENT' ? fetchTencentQuotes(nextSecurities) : fetchEastmoneyQuotes(nextSecurities)
}

function schedule() {
  clearTimer()
  if (!running || paused) return
  const nextRunAt = getNextAutomaticRefreshAt(new Date(), pollingIntervalMs)
  timer = setTimeout(async () => {
    if (!running || paused) return
    await refresh()
    schedule()
  }, Math.max(0, nextRunAt.getTime() - Date.now()))
  postMarketStatus()
}

function currentMonitorStatus() {
  return isContinuousAuction() ? 'RUNNING' : 'MARKET_CLOSED'
}

function postMarketStatus() {
  if (!paused && running) post({ type: 'STATUS', status: currentMonitorStatus(), message: getMarketSessionState().label })
}

function clearTimer() {
  if (timer) clearTimeout(timer)
  timer = undefined
}

function normalizePollingInterval(value?: number) {
  if (!Number.isFinite(value)) return 5000
  return Math.max(5000, Math.floor(value as number))
}

function post(message: QuoteWorkerResponse) {
  self.postMessage(message)
}

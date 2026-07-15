import { fetchEastmoneyQuotes } from '../services/quotes/eastmoney.adapter'
import { fetchTencentQuotes } from '../services/quotes/tencent.adapter'
import { evaluateQuoteAlerts } from '../utils/alert-engine'
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
      post({ type: 'STATUS', status: 'RUNNING' })
      await refresh(true)
    } else if (running && !paused) {
      await refresh(true)
    }
    schedule()
  } else if (message.type === 'UPDATE_PROVIDER') {
    provider = message.provider
    suppressNextAlerts = true
    await refresh(true)
    if (running && !paused) schedule()
  } else if (message.type === 'UPDATE_POLLING_INTERVAL') {
    pollingIntervalMs = normalizePollingInterval(message.pollingIntervalMs)
    if (running && !paused) schedule()
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
    post({ type: 'STATUS', status: 'RUNNING' })
    await refresh(true)
    schedule()
  } else if (message.type === 'FORCE_REFRESH') {
    await refresh(true)
    if (running && !paused) schedule()
  }
}

async function refresh(force: boolean) {
  if ((!running && !force) || !securities.length) return
  try {
    const quotes = await fetchQuotes(securities)
    post({ type: 'QUOTE_SNAPSHOT', quotes, securityIds: securities.map(item => item.securityId) })
    if (suppressNextAlerts) {
      suppressNextAlerts = false
    } else {
      const securitiesById = new Map(securities.map(security => [security.securityId, security]))
      for (const quote of quotes) {
        const events = evaluateQuoteAlerts(quote, securitiesById.get(quote.securityId), alertConfigs[quote.securityId])
        for (const event of events) post({ type: 'ALERT_TRIGGERED', event })
      }
    }
    post({ type: 'STATUS', status: quotes.length ? 'RUNNING' : 'STALE' })
  } catch (error) {
    post({ type: 'ERROR', message: error instanceof Error ? error.message : '行情请求失败' })
    post({ type: 'STATUS', status: 'ERROR' })
  }
}

function fetchQuotes(nextSecurities: SecurityItem[]) {
  return provider === 'TENCENT'
    ? fetchTencentQuotes(nextSecurities)
    : fetchEastmoneyQuotes(nextSecurities)
}

function schedule() {
  clearTimer()
  if (!running || paused) return
  const delay = pollingIntervalMs - (Date.now() % pollingIntervalMs)
  timer = setTimeout(async () => {
    await refresh(false)
    schedule()
  }, delay)
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

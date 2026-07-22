import type { SecurityAlerts, SecurityItem } from '~~/shared/types/stock'
import type { QuoteProvider, QuoteWorkerRequest, QuoteWorkerResponse } from '~/services/quotes/types'

export function useQuoteMonitor() {
  const marketStore = useMarketStore()
  const browserNotifications = useBrowserNotifications()
  const worker = shallowRef<Worker | null>(null)

  function ensureWorker() {
    if (!worker.value) {
      worker.value = new Worker(new URL('../workers/quote-monitor.worker.ts', import.meta.url), { type: 'module' })
      worker.value.onmessage = (event: MessageEvent<QuoteWorkerResponse>) => {
        const message = event.data
        if (message.type === 'QUOTE_SNAPSHOT') marketStore.updateQuotes(message.quotes, message.securityIds)
        if (message.type === 'TREND_SNAPSHOT') marketStore.updateTrends(message.trends, message.securityIds)
        if (message.type === 'ALERT_TRIGGERED') {
          marketStore.addAlertEvent(message.event)
          browserNotifications.notifyAlert(message.event)
        }
        if (message.type === 'STATUS') marketStore.setStatus(message.status, message.message)
        if (message.type === 'METRICS') marketStore.setProviderLatency(message.providerLatencyMs)
        if (message.type === 'ERROR') marketStore.setStatus('ERROR', message.message)
      }
      worker.value.onerror = (event) => {
        console.error('[ValueTicker] quote worker error', event)
        marketStore.setStatus('ERROR', event.message || '行情 Worker 启动失败')
      }
      worker.value.onmessageerror = () => {
        marketStore.setStatus('ERROR', '行情 Worker 消息通信失败')
      }
    }
    return worker.value
  }

  function send(message: QuoteWorkerRequest) {
    const payload = toWorkerPayload(message)
    try {
      ensureWorker().postMessage(payload)
    } catch (error) {
      console.error('[ValueTicker] quote worker postMessage failed', error)
      marketStore.setStatus('ERROR', error instanceof Error ? error.message : '行情 Worker 消息发送失败')
    }
  }

  function start(securities: SecurityItem[], provider: QuoteProvider, alerts?: Record<string, SecurityAlerts>, pollingIntervalMs = 5000) {
    send({ type: 'START', securities, provider, alerts, pollingIntervalMs })
  }
  function updateSecurities(securities: SecurityItem[], provider?: QuoteProvider) {
    send({ type: 'UPDATE_SECURITIES', securities, provider })
  }
  function updateAlerts(alerts: Record<string, SecurityAlerts>) {
    send({ type: 'UPDATE_ALERTS', alerts })
  }
  function updateProvider(provider: QuoteProvider) {
    send({ type: 'UPDATE_PROVIDER', provider })
  }
  function updatePollingInterval(pollingIntervalMs: number) {
    send({ type: 'UPDATE_POLLING_INTERVAL', pollingIntervalMs })
  }
  function pause() {
    send({ type: 'PAUSE' })
  }
  function resume() {
    send({ type: 'RESUME' })
  }
  function forceRefresh() {
    send({ type: 'FORCE_REFRESH' })
  }
  function refreshSecurities(securities: SecurityItem[]) {
    send({ type: 'REFRESH_SECURITIES', securities })
  }
  function updateTrendSecurities(securities: SecurityItem[]) {
    send({ type: 'UPDATE_TREND_SECURITIES', securities })
  }
  function updateWindowActivity(active: boolean) {
    send({ type: 'UPDATE_WINDOW_ACTIVITY', active })
  }
  function stop() {
    if (!worker.value) return
    worker.value.postMessage({ type: 'STOP' } satisfies QuoteWorkerRequest)
    worker.value.terminate()
    worker.value = null
  }

  return { start, updateSecurities, updateAlerts, updateProvider, updatePollingInterval, pause, resume, forceRefresh, refreshSecurities, updateTrendSecurities, updateWindowActivity, stop }
}

function toWorkerPayload(message: QuoteWorkerRequest): QuoteWorkerRequest {
  if (message.type === 'START') {
    return {
      type: 'START',
      securities: message.securities.map(toPlainSecurity),
      provider: message.provider,
      alerts: cloneAlerts(message.alerts),
      pollingIntervalMs: message.pollingIntervalMs
    }
  }

  if (message.type === 'REFRESH_SECURITIES') {
    return { type: 'REFRESH_SECURITIES', securities: message.securities.map(toPlainSecurity) }
  }

  if (message.type === 'UPDATE_TREND_SECURITIES') {
    return { type: 'UPDATE_TREND_SECURITIES', securities: message.securities.map(toPlainSecurity) }
  }

  if (message.type === 'UPDATE_SECURITIES') {
    return {
      type: 'UPDATE_SECURITIES',
      securities: message.securities.map(toPlainSecurity),
      provider: message.provider
    }
  }

  if (message.type === 'UPDATE_ALERTS') {
    return {
      type: 'UPDATE_ALERTS',
      alerts: cloneAlerts(message.alerts) ?? {}
    }
  }

  return message
}

function cloneAlerts(alerts?: Record<string, SecurityAlerts>) {
  if (!alerts) return undefined

  return Object.fromEntries(Object.entries(alerts).map(([securityId, config]) => [
    securityId,
    {
      securityId: config.securityId,
      updatedAt: config.updatedAt,
      rules: config.rules.map(rule => ({ ...rule }))
    }
  ]))
}

function toPlainSecurity(security: SecurityItem): SecurityItem {
  return {
    securityId: security.securityId,
    exchange: security.exchange,
    code: security.code,
    name: security.name,
    securityType: security.securityType,
    board: security.board,
    boardLabel: security.boardLabel,
    pricePrecision: security.pricePrecision,
    providerSymbols: {
      ...security.providerSymbols
    }
  }
}

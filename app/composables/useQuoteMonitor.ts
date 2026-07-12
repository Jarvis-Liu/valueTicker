import type { SecurityItem } from '~~/shared/types/stock'
import type { QuoteProvider, QuoteWorkerRequest, QuoteWorkerResponse } from '~/services/quotes/types'

export function useQuoteMonitor() {
  const marketStore = useMarketStore()
  const worker = shallowRef<Worker | null>(null)

  function ensureWorker() {
    if (!worker.value) {
      worker.value = new Worker(new URL('../workers/quote-monitor.worker.ts', import.meta.url), { type: 'module' })
      worker.value.onmessage = (event: MessageEvent<QuoteWorkerResponse>) => {
        const message = event.data
        if (message.type === 'QUOTE_SNAPSHOT') marketStore.updateQuotes(message.quotes, message.securityIds)
        if (message.type === 'STATUS') marketStore.setStatus(message.status, message.message)
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

  function start(securities: SecurityItem[], provider: QuoteProvider) {
    send({ type: 'START', securities, provider })
  }
  function updateSecurities(securities: SecurityItem[], provider?: QuoteProvider) {
    send({ type: 'UPDATE_SECURITIES', securities, provider })
  }
  function updateProvider(provider: QuoteProvider) {
    send({ type: 'UPDATE_PROVIDER', provider })
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
  function stop() {
    if (!worker.value) return
    worker.value.postMessage({ type: 'STOP' } satisfies QuoteWorkerRequest)
    worker.value.terminate()
    worker.value = null
  }

  return { start, updateSecurities, updateProvider, pause, resume, forceRefresh, stop }
}

function toWorkerPayload(message: QuoteWorkerRequest): QuoteWorkerRequest {
  if (message.type === 'START') {
    return {
      type: 'START',
      securities: message.securities.map(toPlainSecurity),
      provider: message.provider
    }
  }

  if (message.type === 'UPDATE_SECURITIES') {
    return {
      type: 'UPDATE_SECURITIES',
      securities: message.securities.map(toPlainSecurity),
      provider: message.provider
    }
  }

  return message
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

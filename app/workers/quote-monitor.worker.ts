import { fetchEastmoneyQuotes } from '../services/quotes/eastmoney.adapter'
import { fetchTencentQuotes } from '../services/quotes/tencent.adapter'
import type { QuoteProvider, QuoteWorkerRequest, QuoteWorkerResponse } from '../services/quotes/types'
import type { SecurityItem } from '~~/shared/types/stock'

let securities: SecurityItem[] = []
let timer: ReturnType<typeof setTimeout> | undefined
let running = false
let paused = false
let provider: QuoteProvider = 'EASTMONEY'

self.onmessage = async (event: MessageEvent<QuoteWorkerRequest>) => {
  const message = event.data
  if (message.type === 'START' || message.type === 'UPDATE_SECURITIES') {
    securities = message.securities
    if (message.provider) provider = message.provider
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
    await refresh(true)
    if (running && !paused) schedule()
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
  const delay = 5000 - (Date.now() % 5000)
  timer = setTimeout(async () => {
    await refresh(false)
    schedule()
  }, delay)
}

function clearTimer() {
  if (timer) clearTimeout(timer)
  timer = undefined
}

function post(message: QuoteWorkerResponse) {
  self.postMessage(message)
}

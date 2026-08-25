import type { NormalizedQuote, MonitorStatus, QuoteAlertEvent, SecurityIntradayTrend } from '~/services/quotes/types'
import type { AlertNotification } from '~/types/market'

export const useMarketStore = defineStore('market', () => {
  const quotes = ref<Record<string, NormalizedQuote>>({})
  const intradayTrends = ref<Record<string, SecurityIntradayTrend>>({})
  const alertNotifications = ref<AlertNotification[]>([])
  const status = ref<MonitorStatus>('IDLE')
  const errorMessage = ref('')
  const lastUpdatedAt = ref<string | null>(null)
  const providerLatencyMs = ref<number | null>(null)

  function updateQuotes(nextQuotes: NormalizedQuote[], requestedSecurityIds?: string[]) {
    if (requestedSecurityIds) {
      const requested = new Set(requestedSecurityIds)
      const returned = new Set(nextQuotes.map(quote => quote.securityId))
      quotes.value = Object.fromEntries(Object.entries(quotes.value).filter(([securityId]) => {
        return !requested.has(securityId) || returned.has(securityId)
      }))
    }

    for (const quote of nextQuotes) quotes.value[quote.securityId] = quote
    const latestBatchUpdatedAt = nextQuotes
      .map(quote => quote.updatedAt)
      .filter(Boolean)
      .sort()
      .at(-1)
    if (latestBatchUpdatedAt && (!lastUpdatedAt.value || latestBatchUpdatedAt > lastUpdatedAt.value)) {
      lastUpdatedAt.value = latestBatchUpdatedAt
    }
  }

  function updateTrends(nextTrends: SecurityIntradayTrend[], requestedSecurityIds?: string[]) {
    if (requestedSecurityIds) {
      const requested = new Set(requestedSecurityIds)
      const returned = new Set(nextTrends.map(trend => trend.securityId))
      intradayTrends.value = Object.fromEntries(Object.entries(intradayTrends.value).filter(([securityId]) => {
        return !requested.has(securityId) || returned.has(securityId)
      }))
    }

    for (const trend of nextTrends) intradayTrends.value[trend.securityId] = trend
  }

  function setStatus(nextStatus: MonitorStatus, message = '') {
    status.value = nextStatus
    errorMessage.value = message
  }

  function setProviderLatency(nextLatencyMs: number | null) {
    providerLatencyMs.value = nextLatencyMs
  }

  function clearQuotes(securityIds: string[]) {
    const removed = new Set(securityIds)
    quotes.value = Object.fromEntries(Object.entries(quotes.value).filter(([securityId]) => !removed.has(securityId)))
  }

  function addAlertEvent(event: QuoteAlertEvent) {
    alertNotifications.value = [
      toAlertNotification(event),
      ...alertNotifications.value
    ].slice(0, 20)
  }

  function clearAlertNotifications() {
    alertNotifications.value = []
  }

  function reset() {
    quotes.value = {}
    intradayTrends.value = {}
    alertNotifications.value = []
    status.value = 'IDLE'
    errorMessage.value = ''
    lastUpdatedAt.value = null
    providerLatencyMs.value = null
  }

  return { quotes, intradayTrends, alertNotifications, status, errorMessage, lastUpdatedAt, providerLatencyMs, updateQuotes, updateTrends, setStatus, setProviderLatency, clearQuotes, addAlertEvent, clearAlertNotifications, reset }
})

function toAlertNotification(event: QuoteAlertEvent): AlertNotification {
  const ruleName = getRuleName(event.rule.type)
  const unit = event.rule.type.startsWith('PRICE') ? '元' : '%'
  const tone = event.rule.type.endsWith('UPPER') ? 'up' : 'down'

  return {
    id: event.id,
    title: `${event.securityName}（${event.code}）${ruleName} ${formatRuleValue(event)}${unit}`,
    detail: `当前价格 ${formatPrice(event.price, event.pricePrecision)}，涨跌幅 ${formatSigned(event.changePercent)}%${event.rule.note ? `｜${event.rule.note}` : ''}`,
    time: formatTime(event.triggeredAt),
    tone
  }
}

function getRuleName(type: QuoteAlertEvent['rule']['type']) {
  if (type === 'PRICE_UPPER') return '价格涨至'
  if (type === 'PRICE_LOWER') return '价格跌至'
  if (type === 'CHANGE_UPPER') return '涨幅超过'
  return '跌幅超过'
}

/** 站内提醒与系统通知共用证券精度：普通证券两位，ETF 等三位。 */
function formatPrice(value: number, precision: QuoteAlertEvent['pricePrecision']) {
  return Number.isFinite(value) ? value.toFixed(precision) : '--'
}

function formatRuleValue(event: QuoteAlertEvent) {
  return event.rule.type.startsWith('PRICE') ? formatPrice(event.rule.value, event.pricePrecision) : event.rule.value
}
function formatSigned(value: number) {
  if (!Number.isFinite(value)) return '--'
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`
}

function formatTime(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '--'
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
}

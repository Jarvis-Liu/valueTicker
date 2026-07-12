import type { NormalizedQuote, MonitorStatus, QuoteAlertEvent } from '~/services/quotes/types'
import type { AlertNotification } from '~/types/market'

export const useMarketStore = defineStore('market', () => {
  const quotes = ref<Record<string, NormalizedQuote>>({})
  const alertNotifications = ref<AlertNotification[]>([])
  const status = ref<MonitorStatus>('IDLE')
  const errorMessage = ref('')
  const lastUpdatedAt = ref<string | null>(null)

  function updateQuotes(nextQuotes: NormalizedQuote[], requestedSecurityIds?: string[]) {
    if (requestedSecurityIds) {
      const requested = new Set(requestedSecurityIds)
      const returned = new Set(nextQuotes.map(quote => quote.securityId))
      quotes.value = Object.fromEntries(Object.entries(quotes.value).filter(([securityId]) => {
        return !requested.has(securityId) || returned.has(securityId)
      }))
    }

    for (const quote of nextQuotes) quotes.value[quote.securityId] = quote
    lastUpdatedAt.value = nextQuotes.at(-1)?.updatedAt ?? lastUpdatedAt.value
  }

  function setStatus(nextStatus: MonitorStatus, message = '') {
    status.value = nextStatus
    errorMessage.value = message
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

  return { quotes, alertNotifications, status, errorMessage, lastUpdatedAt, updateQuotes, setStatus, clearQuotes, addAlertEvent }
})

function toAlertNotification(event: QuoteAlertEvent): AlertNotification {
  const ruleName = getRuleName(event.rule.type)
  const unit = event.rule.type.startsWith('PRICE') ? '元' : '%'
  const tone = event.rule.type.endsWith('UPPER') ? 'up' : 'down'

  return {
    id: event.id,
    title: `${event.securityName}（${event.code}）${ruleName} ${event.rule.value}${unit}`,
    detail: `当前价格 ${formatNumber(event.price)}，涨跌幅 ${formatSigned(event.changePercent)}%${event.rule.note ? `｜${event.rule.note}` : ''}`,
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

function formatNumber(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : '--'
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

import type { NormalizedQuote, MonitorStatus } from '~/services/quotes/types'

export const useMarketStore = defineStore('market', () => {
  const quotes = ref<Record<string, NormalizedQuote>>({})
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

  return { quotes, status, errorMessage, lastUpdatedAt, updateQuotes, setStatus, clearQuotes }
})

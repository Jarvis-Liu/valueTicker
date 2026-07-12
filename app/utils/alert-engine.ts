import type { NormalizedQuote, QuoteAlertEvent } from '../services/quotes/types'
import type { SecurityAlerts, SecurityItem } from '~~/shared/types/stock'

export function evaluateQuoteAlerts(
  quote: NormalizedQuote,
  security: SecurityItem | undefined,
  alerts: SecurityAlerts | undefined
): QuoteAlertEvent[] {
  if (!security || !alerts) return []

  const enabledRules = alerts.rules.filter(rule => rule.enabled)
  if (enabledRules.length === 0) return []

  const triggeredAt = new Date().toISOString()

  return enabledRules
    .filter(rule => isRuleMatched(rule.type, rule.value, quote))
    .map((rule, index) => ({
      id: `${quote.securityId}:${rule.type}:${rule.value}:${triggeredAt}:${index}`,
      securityId: quote.securityId,
      securityName: security.name,
      code: security.code,
      rule,
      price: quote.price,
      changePercent: quote.changePercent,
      triggeredAt,
      provider: quote.provider
    }))
}

function isRuleMatched(type: SecurityAlerts['rules'][number]['type'], value: number, quote: NormalizedQuote) {
  if (!Number.isFinite(value) || value <= 0) return false

  if (type === 'PRICE_UPPER') return Number.isFinite(quote.price) && quote.price >= value
  if (type === 'PRICE_LOWER') return Number.isFinite(quote.price) && quote.price <= value
  if (type === 'CHANGE_UPPER') return Number.isFinite(quote.changePercent) && quote.changePercent >= value
  if (type === 'CHANGE_LOWER') return Number.isFinite(quote.changePercent) && quote.changePercent <= value

  return false
}

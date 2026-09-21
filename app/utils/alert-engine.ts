import type { NormalizedQuote, QuoteAlertEvent } from '../services/quotes/types'
import type { SecurityAlerts, SecurityItem } from '~~/shared/types/stock'

export function evaluateQuoteAlerts(
  quote: NormalizedQuote,
  previousQuote: NormalizedQuote | undefined,
  security: SecurityItem | undefined,
  alerts: SecurityAlerts | undefined
): QuoteAlertEvent[] {
  // 首次取得行情只用于建立比较基准，不能把进入页面前已经满足的条件误报为新触发。
  if (!previousQuote || !security || !alerts) return []

  const enabledRules = alerts.rules.filter(rule => rule.enabled)
  if (enabledRules.length === 0) return []

  const triggeredAt = new Date().toISOString()

  return enabledRules
    .filter(rule => isRuleCrossed(rule.type, rule.value, previousQuote, quote))
    .map((rule, index) => ({
      id: `${quote.securityId}:${rule.type}:${rule.value}:${triggeredAt}:${index}`,
      securityId: quote.securityId,
      securityName: security.name,
      code: security.code,
      pricePrecision: security.pricePrecision,
      rule,
      price: quote.price,
      changePercent: quote.changePercent,
      triggeredAt,
      provider: quote.provider
    }))
}

function isRuleCrossed(
  type: SecurityAlerts['rules'][number]['type'],
  value: number,
  previousQuote: NormalizedQuote,
  quote: NormalizedQuote
) {
  if (!Number.isFinite(value) || value <= 0) return false

  if (type === 'PRICE_UPPER') {
    return Number.isFinite(previousQuote.price) && Number.isFinite(quote.price)
      && previousQuote.price < value && quote.price >= value
  }
  if (type === 'PRICE_LOWER') {
    return Number.isFinite(previousQuote.price) && Number.isFinite(quote.price)
      && previousQuote.price > value && quote.price <= value
  }
  if (type === 'CHANGE_UPPER') {
    return Number.isFinite(previousQuote.changePercent) && Number.isFinite(quote.changePercent)
      && previousQuote.changePercent < value && quote.changePercent >= value
  }
  if (type === 'CHANGE_LOWER') {
    const lowerThreshold = -value
    return Number.isFinite(previousQuote.changePercent) && Number.isFinite(quote.changePercent)
      && previousQuote.changePercent > lowerThreshold && quote.changePercent <= lowerThreshold
  }

  return false
}

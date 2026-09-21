import { describe, expect, it } from 'vitest'
import type { NormalizedQuote } from '../services/quotes/types'
import type { AlertRule, SecurityAlerts, SecurityItem } from '~~/shared/types/stock'
import { evaluateQuoteAlerts } from './alert-engine'

const security: SecurityItem = {
  securityId: 'SSE:600865',
  exchange: 'SSE',
  code: '600865',
  name: '百大集团',
  securityType: 'STOCK',
  board: 'MAIN',
  boardLabel: '',
  pricePrecision: 2,
  providerSymbols: { tencent: 'sh600865', eastmoney: '1.600865' }
}

function quote(price: number, changePercent: number): NormalizedQuote {
  return {
    securityId: security.securityId,
    price,
    change: 0,
    changePercent,
    volume: 0,
    amount: 0,
    turnoverRate: 0,
    open: price,
    high: price,
    low: price,
    previousClose: 10,
    totalMarketValue: 0,
    peTtm: 0,
    providerCode: security.code,
    providerMarket: 1,
    providerName: security.name,
    updatedAt: '2026-09-21T01:30:00.000Z',
    status: 'TRADING',
    provider: 'TENCENT'
  }
}

function alerts(rule: AlertRule): SecurityAlerts {
  return {
    securityId: security.securityId,
    rules: [rule],
    updatedAt: '2026-09-21T01:30:00.000Z'
  }
}

function events(type: AlertRule['type'], value: number, previous: NormalizedQuote | undefined, current: NormalizedQuote) {
  return evaluateQuoteAlerts(current, previous, security, alerts({ type, value, enabled: true, note: '' }))
}

describe('alert engine threshold crossing', () => {
  it('does not trigger a decline alert while the quote is rising', () => {
    expect(events('CHANGE_LOWER', 1, quote(10.01, 0.1), quote(10.02, 0.2))).toHaveLength(0)
  })

  it('triggers a decline alert only when crossing the negative threshold', () => {
    expect(events('CHANGE_LOWER', 1, quote(9.95, -0.5), quote(9.9, -1))).toHaveLength(1)
    expect(events('CHANGE_LOWER', 1, quote(9.9, -1), quote(9.8, -2))).toHaveLength(0)
  })

  it('triggers a gain alert only on an upward crossing', () => {
    expect(events('CHANGE_UPPER', 1, quote(10.05, 0.5), quote(10.1, 1))).toHaveLength(1)
    expect(events('CHANGE_UPPER', 1, quote(10.1, 1), quote(10.2, 2))).toHaveLength(0)
  })

  it('applies the same crossing semantics to upper and lower price rules', () => {
    expect(events('PRICE_UPPER', 11, quote(10.9, 9), quote(11, 10))).toHaveLength(1)
    expect(events('PRICE_LOWER', 9, quote(9.1, -9), quote(9, -10))).toHaveLength(1)
    expect(events('PRICE_LOWER', 9, quote(9, -10), quote(8.9, -11))).toHaveLength(0)
  })

  it('uses the first quote as a baseline without triggering', () => {
    expect(events('CHANGE_LOWER', 1, undefined, quote(9.8, -2))).toHaveLength(0)
  })

  it('ignores disabled and invalid rules', () => {
    const current = quote(9.8, -2)
    const previous = quote(9.95, -0.5)
    const disabled = alerts({ type: 'CHANGE_LOWER', value: 1, enabled: false, note: '' })
    expect(evaluateQuoteAlerts(current, previous, security, disabled)).toHaveLength(0)
    expect(events('CHANGE_LOWER', 0, previous, current)).toHaveLength(0)
  })
})

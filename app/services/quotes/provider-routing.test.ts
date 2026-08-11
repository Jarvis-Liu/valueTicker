import { describe, expect, it } from 'vitest'
import type { SecurityItem } from '~~/shared/types/stock'
import { resolveQuoteProvider } from './provider-routing'

describe('quote provider routing', () => {
  it('routes regular A shares to Tencent in mixed mode', () => {
    expect(resolveQuoteProvider(security('SSE', '600000'), 'MIXED')).toBe('TENCENT')
  })

  it('routes BSE and KOSPI securities to Eastmoney in mixed mode', () => {
    expect(resolveQuoteProvider(security('BSE', '920001'), 'MIXED')).toBe('EASTMONEY')
    expect(resolveQuoteProvider(security('SSE', 'KS11', { eastmoney: '100.KS11' }), 'MIXED')).toBe('EASTMONEY')
  })

  it('honors a forced single-provider mode', () => {
    expect(resolveQuoteProvider(security('BSE', '920001'), 'TENCENT')).toBe('TENCENT')
    expect(resolveQuoteProvider(security('SSE', '600000'), 'EASTMONEY')).toBe('EASTMONEY')
  })
})

function security(exchange: SecurityItem['exchange'], code: string, providerSymbols: SecurityItem['providerSymbols'] = {}): SecurityItem {
  return {
    securityId: `${exchange}:${code}`,
    exchange,
    code,
    name: code,
    securityType: 'STOCK',
    board: 'MAIN',
    boardLabel: '',
    pricePrecision: 2,
    providerSymbols
  }
}

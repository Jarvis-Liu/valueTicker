import type { SecurityItem } from '~~/shared/types/stock'

export const MARKET_INDEX_SECURITIES = [
  createMarketIndex('SSE:000001', '上证指数', 'SSE', '000001', 'sh000001'),
  createMarketIndex('SZSE:399001', '深证成指', 'SZSE', '399001', 'sz399001'),
  createMarketIndex('SZSE:399006', '创业板指', 'SZSE', '399006', 'sz399006'),
  createMarketIndex('SSE:000688', '科创50', 'SSE', '000688', 'sh000688')
] satisfies SecurityItem[]

function createMarketIndex(
  securityId: string,
  name: string,
  exchange: SecurityItem['exchange'],
  code: string,
  tencent: string
): SecurityItem {
  return {
    securityId,
    exchange,
    code,
    name,
    securityType: 'UNKNOWN',
    board: 'UNKNOWN',
    boardLabel: '',
    pricePrecision: 2,
    providerSymbols: {
      tencent,
      eastmoney: `${exchange === 'SSE' ? '1' : '0'}.${code}`
    }
  }
}
import type { SecurityItem } from '~~/shared/types/stock'

export const MARKET_INDEX_SECURITIES = [
  createMarketIndex('SSE:000001', '上证指数', 'SSE', '000001', { tencent: 'sh000001' }),
  createMarketIndex('SZSE:399001', '深证成指', 'SZSE', '399001', { tencent: 'sz399001' }),
  createMarketIndex('SZSE:399006', '创业板指', 'SZSE', '399006', { tencent: 'sz399006' }),
  createMarketIndex('SSE:000688', '科创50', 'SSE', '000688', { tencent: 'sh000688' }),
  createMarketIndex('KOSPI:KS11', '韩国KOSPI', 'SSE', 'KS11', { eastmoney: '100.KS11' })
] satisfies SecurityItem[]

function createMarketIndex(
  securityId: string,
  name: string,
  exchange: SecurityItem['exchange'],
  code: string,
  providerSymbols: { tencent?: string, eastmoney?: string }
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
      ...providerSymbols,
      eastmoney: providerSymbols.eastmoney ?? `${exchange === 'SSE' ? '1' : '0'}.${code}`
    }
  }
}
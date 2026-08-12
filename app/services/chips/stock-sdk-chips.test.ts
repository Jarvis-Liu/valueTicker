import { describe, expect, it } from 'vitest'
import { isChipDistributionSupported, toEastmoneySecid, toStockSdkChipSymbol } from './stock-sdk-chips'

describe('stock-sdk chips adapter', () => {
  it('maps A-share exchanges to explicit stock-sdk symbols', () => {
    expect(toStockSdkChipSymbol({ securityId: 'SSE:600519', code: '600519', securityType: 'STOCK' })).toBe('sh600519')
    expect(toStockSdkChipSymbol({ securityId: 'SZSE:300750', code: '300750', securityType: 'STOCK' })).toBe('sz300750')
    expect(toStockSdkChipSymbol({ securityId: 'BSE:920819', code: '920819', securityType: 'STOCK' })).toBe('bj920819')
  })

  it('maps A-share exchanges to Eastmoney secids', () => {
    expect(toEastmoneySecid({ securityId: 'SSE:600519', code: '600519', securityType: 'STOCK' })).toBe('1.600519')
    expect(toEastmoneySecid({ securityId: 'SZSE:300750', code: '300750', securityType: 'STOCK' })).toBe('0.300750')
    expect(toEastmoneySecid({ securityId: 'BSE:920819', code: '920819', securityType: 'STOCK' })).toBe('0.920819')
  })

  it('rejects ETFs, indices and malformed securities before requesting data', () => {
    expect(isChipDistributionSupported({ securityId: 'SSE:510300', code: '510300', securityType: 'ETF' })).toBe(false)
    expect(isChipDistributionSupported({ securityId: 'INDEX:000001', code: '000001', securityType: 'UNKNOWN' })).toBe(false)
    expect(isChipDistributionSupported({ securityId: 'SSE:600519', code: '600519', securityType: 'STOCK' })).toBe(true)
  })
})

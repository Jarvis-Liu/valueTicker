import { describe, expect, it } from 'vitest'
import { getGroupSecurities, getPollingSecurities } from './polling-securities'
import type { StockGroupMember } from '~~/shared/types/stock'

const createSecurity = (securityId: string): StockGroupMember => ({
  securityId,
  exchange: securityId.startsWith('SSE') ? 'SSE' : 'SZSE',
  code: securityId.slice(-6), name: securityId, securityType: 'STOCK', board: 'MAIN', boardLabel: '', pricePrecision: 2,
  providerSymbols: {}, addedAt: '2026-07-22T00:00:00.000Z'
})

describe('polling securities', () => {
  it('includes and de-duplicates members from every group', () => {
    const result = getPollingSecurities([
      { id: 'current', name: '当前分组', sortOrder: 0, members: [createSecurity('SSE:600519')] },
      { id: 'alerts', name: '提醒分组', sortOrder: 1, members: [createSecurity('SZSE:000001'), createSecurity('SSE:600519')] }
    ])

    expect(result.map(item => item.securityId)).toEqual(['SSE:600519', 'SZSE:000001'])
  })
  it('builds a view refresh request from only the selected group', () => {
    const groups = [
      { id: 'current', name: '当前分组', sortOrder: 0, members: [createSecurity('SSE:600519')] },
      { id: 'alerts', name: '提醒分组', sortOrder: 1, members: [createSecurity('SZSE:000001')] }
    ]

    expect(getGroupSecurities(groups, 'current').map(item => item.securityId)).toEqual(['SSE:600519'])
    expect(getGroupSecurities(groups, 'all').map(item => item.securityId)).toEqual(['SSE:600519', 'SZSE:000001'])
  })
})

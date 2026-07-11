import { describe, expect, it } from 'vitest'
import { DEFAULT_GROUP_ID, STOCK_CONFIG_SCHEMA_VERSION } from '../constants/stock'
import { createStockGroupPayloadSchema, userStockConfigSchema } from './stock-config'

describe('stock config schema', () => {
  it('accepts a valid default config', () => {
    const now = new Date().toISOString()
    const result = userStockConfigSchema.safeParse({
      schemaVersion: STOCK_CONFIG_SCHEMA_VERSION,
      configVersion: 1,
      userId: 'local-dev-user',
      updatedAt: now,
      groups: [
        {
          id: DEFAULT_GROUP_ID,
          name: '默认分组',
          sortOrder: 0,
          isDefault: true,
          members: []
        }
      ],
      alerts: {}
    })

    expect(result.success).toBe(true)
  })

  it('rejects duplicated group names', () => {
    const now = new Date().toISOString()
    const result = userStockConfigSchema.safeParse({
      schemaVersion: STOCK_CONFIG_SCHEMA_VERSION,
      configVersion: 1,
      userId: 'local-dev-user',
      updatedAt: now,
      groups: [
        {
          id: DEFAULT_GROUP_ID,
          name: '默认分组',
          sortOrder: 0,
          isDefault: true,
          members: []
        },
        {
          id: 'group_1',
          name: ' 默认分组 ',
          sortOrder: 1,
          members: []
        }
      ],
      alerts: {}
    })

    expect(result.success).toBe(false)
  })

  it('validates create group payload length', () => {
    expect(createStockGroupPayloadSchema.safeParse({ name: '核心资产' }).success).toBe(true)
    expect(createStockGroupPayloadSchema.safeParse({ name: '' }).success).toBe(false)
    expect(createStockGroupPayloadSchema.safeParse({ name: '一二三四五六七八九十一二三四五六七八九十一' }).success).toBe(false)
  })
})

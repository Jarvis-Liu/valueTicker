import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_GROUP_ID, STOCK_CONFIG_SCHEMA_VERSION } from '~~/shared/constants/stock'
import {
  addStockGroupMember,
  createStockGroup,
  deleteStockGroup,
  deleteStockGroupMember,
  getUserStockConfig,
  renameStockGroup,
  transferStockGroupMember,
  updateStockAlerts
} from './user-stock-storage'

const redis = vi.hoisted(() => ({ eval: vi.fn() }))

vi.mock('~~/server/utils/redis', () => ({
  getRedisClient: () => redis
}))

vi.mock('~~/server/utils/api-response', () => ({
  ApiResponseError: class ApiResponseError extends Error {
    constructor(public statusCode: number, public code: string, message: string, public details?: unknown) {
      super(message)
    }
  }
}))

const now = '2026-01-01T00:00:00.000Z'
const member = {
  securityId: 'SSE:600000',
  exchange: 'SSE' as const,
  code: '600000',
  name: '浦发银行',
  securityType: 'STOCK' as const,
  board: 'MAIN' as const,
  boardLabel: '' as const,
  pricePrecision: 2 as const,
  providerSymbols: { tencent: 'sh600000' }
}

function config() {
  return {
    schemaVersion: STOCK_CONFIG_SCHEMA_VERSION,
    configVersion: 1,
    userId: 'local-dev-user',
    updatedAt: now,
    groups: [{ id: DEFAULT_GROUP_ID, name: '默认分组', sortOrder: 0, isDefault: true, members: [] }],
    alerts: {}
  }
}

function scriptOk(result: Record<string, unknown> = {}) {
  return JSON.stringify({ status: 'OK', configJson: JSON.stringify(config()), resultJson: JSON.stringify(result) })
}

describe('user stock KV storage', () => {
  beforeEach(() => redis.eval.mockReset())

  it('initializes and reads a config through one Redis script command', async () => {
    redis.eval.mockResolvedValueOnce(scriptOk())

    await expect(getUserStockConfig('local-dev-user')).resolves.toMatchObject({ configVersion: 1 })
    expect(redis.eval).toHaveBeenCalledTimes(1)
    expect(redis.eval.mock.calls[0]?.[1]).toEqual(['value-ticker:user-stock-config:local-dev-user'])
    expect(redis.eval.mock.calls[0]?.[2]?.[1]).toBe('READ')
  })

  it('routes every mutation through the atomic script with the supplied version', async () => {
    redis.eval.mockResolvedValue(scriptOk({ group: config().groups[0], member: { ...member, addedAt: now }, sourceGroup: config().groups[0], targetGroup: config().groups[0], alerts: null }))

    await createStockGroup('local-dev-user', { name: '科技' }, 1)
    await renameStockGroup('local-dev-user', DEFAULT_GROUP_ID, { name: '自选' }, 1)
    await deleteStockGroup('local-dev-user', DEFAULT_GROUP_ID, 1).catch(() => undefined)
    await addStockGroupMember('local-dev-user', DEFAULT_GROUP_ID, member, 1)
    await deleteStockGroupMember('local-dev-user', DEFAULT_GROUP_ID, member.securityId, 1)
    await transferStockGroupMember('local-dev-user', DEFAULT_GROUP_ID, member.securityId, { targetGroupId: 'group_other', mode: 'COPY' }, 1)
    await updateStockAlerts('local-dev-user', member.securityId, { rules: [] }, 1)

    const calls = redis.eval.mock.calls as [string, string[], string[]][]
    expect(calls.map(call => call[2][1])).toEqual([
      'CREATE_GROUP', 'RENAME_GROUP', 'DELETE_GROUP', 'ADD_MEMBER', 'DELETE_MEMBER', 'TRANSFER_MEMBER', 'UPDATE_ALERTS'
    ])
    for (const call of calls) expect(call[2][3]).toBe('1')
  })

  it('preserves version-conflict and storage-corruption error mappings', async () => {
    redis.eval.mockResolvedValueOnce(JSON.stringify({ status: 'ERROR', code: 'CONFIG_VERSION_CONFLICT' }))
    await expect(createStockGroup('local-dev-user', { name: '科技' }, 1)).rejects.toMatchObject({ statusCode: 409, code: 'CONFIG_VERSION_CONFLICT' })

    redis.eval.mockResolvedValueOnce(JSON.stringify({ status: 'OK', config: { invalid: true } }))
    await expect(getUserStockConfig('local-dev-user')).rejects.toMatchObject({ statusCode: 500, code: 'STORAGE_WRITE_FAILED' })
  })
})

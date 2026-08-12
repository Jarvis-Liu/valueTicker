import type { EastmoneyKlineCacheDocument, EastmoneyKlineResponse } from '~~/shared/types/eastmoney-kline'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getEastmoneyKlineCacheKey, getEastmoneyKlineLockKey, getSharedEastmoneyKline, parseCacheDocument } from './eastmoney-kline-cache'

const redis = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  eval: vi.fn()
}))
const fetchCloudflareMarketJson = vi.hoisted(() => vi.fn())

vi.mock('~~/server/utils/redis', () => ({ getRedisClient: () => redis }))
vi.mock('~~/server/services/cloudflare-market-proxy', () => ({ fetchCloudflareMarketJson }))
vi.mock('~~/server/utils/api-response', () => ({
  ApiResponseError: class ApiResponseError extends Error {
    /**
     * 创建测试环境使用的项目 API 错误替身。
     * @param statusCode HTTP 状态码。
     * @param code 项目错误代码。
     * @param message 可读错误信息。
     */
    constructor(public statusCode: number, public code: string, message: string) {
      super(message)
    }
  }
}))

const SECID = '1.603259'
const NOW = new Date('2026-08-12T02:00:00.000Z')

/**
 * 创建一份服务端认为有效的东财原始响应测试数据。
 * @returns 包含一根合法日 K 的原始响应。
 */
function payload(): EastmoneyKlineResponse {
  return {
    rc: 0,
    data: {
      code: '603259',
      klines: ['2026-08-11,10,10.5,10.8,9.9,1,2,3,4,5,6']
    }
  }
}

/**
 * 按指定过期时间创建当前 schema 的 Redis 缓存文档。
 * @param expiresAt 业务过期时间 ISO 字符串。
 * @returns 可供 Redis mock 返回的共享缓存文档。
 */
function document(expiresAt: string): EastmoneyKlineCacheDocument {
  return {
    schemaVersion: 1,
    secid: SECID,
    symbol: '603259',
    period: 'daily',
    adjust: 'qfq',
    beginDate: '20250817',
    endDate: '20500101',
    source: 'EASTMONEY',
    payload: payload(),
    sourceUpdatedAt: '2026-08-11',
    fetchedAt: '2026-08-12T01:30:00.000Z',
    expiresAt
  }
}

describe('eastmoney shared kline cache', () => {
  beforeEach(() => {
    redis.get.mockReset()
    redis.set.mockReset()
    redis.eval.mockReset().mockResolvedValue(1)
    fetchCloudflareMarketJson.mockReset()
  })

  it('returns HIT without acquiring a lock or requesting upstream', async () => {
    redis.get.mockResolvedValue(document('2026-08-12T02:10:00.000Z'))
    const result = await getSharedEastmoneyKline({} as never, SECID, NOW)
    expect(result.cacheStatus).toBe('HIT')
    expect(result.expiresAt).toBe('2026-08-12T02:10:00.000Z')
    expect(redis.set).not.toHaveBeenCalled()
    expect(fetchCloudflareMarketJson).not.toHaveBeenCalled()
  })

  it('returns MISS and stores a globally shared document on first load', async () => {
    redis.get.mockResolvedValue(null)
    redis.set.mockResolvedValueOnce('OK').mockResolvedValueOnce('OK')
    fetchCloudflareMarketJson.mockResolvedValue(payload())
    const result = await getSharedEastmoneyKline({} as never, SECID, NOW)
    expect(result.cacheStatus).toBe('MISS')
    expect(result.expiresAt).toBe('2026-08-12T02:30:00.000Z')
    expect(fetchCloudflareMarketJson).toHaveBeenCalledTimes(1)
    expect(redis.set).toHaveBeenNthCalledWith(1, getEastmoneyKlineLockKey(SECID), expect.any(String), { nx: true, ex: 15 })
    expect(redis.set).toHaveBeenNthCalledWith(2, getEastmoneyKlineCacheKey(SECID), expect.objectContaining({ secid: SECID }), { ex: 1209600 })
    expect(redis.eval).toHaveBeenCalledTimes(1)
  })

  it('returns REFRESHED when an expired document is replaced', async () => {
    const expired = document('2026-08-12T01:59:00.000Z')
    redis.get.mockResolvedValue(expired)
    redis.set.mockResolvedValueOnce('OK').mockResolvedValueOnce('OK')
    fetchCloudflareMarketJson.mockResolvedValue(payload())
    const result = await getSharedEastmoneyKline({} as never, SECID, NOW)
    expect(result.cacheStatus).toBe('REFRESHED')
    expect(result.stale).toBe(false)
  })

  it('returns STALE without overwriting old data when upstream fails', async () => {
    const expired = document('2026-08-12T01:59:00.000Z')
    redis.get.mockResolvedValue(expired)
    redis.set.mockResolvedValueOnce('OK')
    fetchCloudflareMarketJson.mockRejectedValue(new Error('gateway blocked'))
    const result = await getSharedEastmoneyKline({} as never, SECID, NOW)
    expect(result.cacheStatus).toBe('STALE')
    expect(result.stale).toBe(true)
    expect(result.payload).toEqual(expired.payload)
    expect(redis.set).toHaveBeenCalledTimes(1)
  })

  it('rejects damaged or mismatched Redis documents', () => {
    expect(parseCacheDocument({ ...document('2026-08-12T02:10:00.000Z'), schemaVersion: 2 }, SECID)).toBeNull()
    expect(parseCacheDocument({ ...document('2026-08-12T02:10:00.000Z'), secid: '0.301217' }, SECID)).toBeNull()
    expect(parseCacheDocument({ ...document('2026-08-12T02:10:00.000Z'), payload: { rc: 0, data: { klines: [] } } }, SECID)).toBeNull()
  })
})

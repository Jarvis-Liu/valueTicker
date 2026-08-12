import type { H3Event } from 'h3'
import type { EastmoneyKlineApiResult, EastmoneyKlineCacheDocument, EastmoneyKlineResponse } from '~~/shared/types/eastmoney-kline'
import { fetchCloudflareMarketJson } from '~~/server/services/cloudflare-market-proxy'
import { ApiResponseError } from '~~/server/utils/api-response'
import { getRedisClient } from '~~/server/utils/redis'

type RedisLockClient = ReturnType<typeof getRedisClient> & {
  eval: (script: string, keys: string[], args: string[]) => Promise<unknown>
}

const SCHEMA_VERSION = 1
const BUSINESS_TTL_MS = 30 * 60 * 1000
const REDIS_TTL_SECONDS = 14 * 24 * 60 * 60
const LOCK_TTL_SECONDS = 15
const INITIAL_WAIT_MS = 250
const INITIAL_WAIT_ATTEMPTS = 2
const DEFAULT_LOOKBACK_DAYS = 360
const END_DATE = '20500101'
const RELEASE_LOCK_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`

/**
 * 读取全局共享的东财前复权日 K；缓存过期时以证券级锁限制为单次回源。
 * @param event 当前 H3 请求，用于读取 Cloudflare Worker 私有配置。
 * @param secid 东财市场标识与六位证券代码，例如 `1.603259`。
 * @param now 注入的当前时间，主要供缓存边界测试使用。
 * @returns 携带统一缓存状态、原始上游响应及原始有效期的 API 结果。
 */
export async function getSharedEastmoneyKline(event: H3Event, secid: string, now = new Date()): Promise<EastmoneyKlineApiResult> {
  const redis = getRedisClient()
  const cacheKey = getEastmoneyKlineCacheKey(secid)
  const lockKey = getEastmoneyKlineLockKey(secid)
  const existing = parseCacheDocument(await redis.get<unknown>(cacheKey), secid)
  if (existing && isFresh(existing, now)) return toApiResult(existing, 'HIT')

  const requestId = crypto.randomUUID()
  const acquired = await redis.set(lockKey, requestId, { nx: true, ex: LOCK_TTL_SECONDS })
  if (!acquired) {
    if (existing) return toApiResult(existing, 'STALE', '共享缓存正在更新，暂时返回最近一次数据')
    const initialized = await waitForInitializedCache(redis, cacheKey, secid)
    if (initialized) return toApiResult(initialized, isFresh(initialized, new Date()) ? 'HIT' : 'STALE', isFresh(initialized, new Date()) ? undefined : '共享缓存初始化完成，但数据已过业务有效期')
    throw new ApiResponseError(502, 'UPSTREAM_UNAVAILABLE', '历史 K 线共享缓存正在初始化，请稍后重试')
  }

  try {
    const latest = parseCacheDocument(await redis.get<unknown>(cacheKey), secid)
    if (latest && isFresh(latest, new Date())) return toApiResult(latest, 'HIT')
    const staleDocument = latest ?? existing

    try {
      const beginDate = createBeginDate(now)
      const payload = await fetchEastmoneyKline(event, secid, beginDate, END_DATE)
      const document = createCacheDocument(secid, beginDate, END_DATE, payload, now)
      await redis.set(cacheKey, document, { ex: REDIS_TTL_SECONDS })
      return toApiResult(document, staleDocument ? 'REFRESHED' : 'MISS')
    } catch (error) {
      if (staleDocument) return toApiResult(staleDocument, 'STALE', '历史 K 线上游暂时不可用，当前展示最近一次有效数据')
      throw error
    }
  } finally {
    await safelyReleaseLock(redis as RedisLockClient, lockKey, requestId)
  }
}

/**
 * 生成不含用户标识的东财日 K 全局共享缓存键。
 * @param secid 东财证券标识。
 * @returns 带版本、周期与复权口径的 Redis 键。
 */
export function getEastmoneyKlineCacheKey(secid: string) {
  return `value-ticker:kline:eastmoney:v${SCHEMA_VERSION}:${secid}:daily:qfq`
}

/**
 * 生成与共享缓存键一一对应的证券级更新锁键。
 * @param secid 东财证券标识。
 * @returns Redis 更新锁键。
 */
export function getEastmoneyKlineLockKey(secid: string) {
  return `value-ticker:kline-lock:eastmoney:v${SCHEMA_VERSION}:${secid}:daily:qfq`
}

/**
 * 校验 Redis 中的未知值是否为当前版本且属于目标证券的缓存文档。
 * @param value Redis 返回的未知数据。
 * @param expectedSecid 当前请求的证券标识。
 * @returns 有效文档；结构损坏或版本不符时返回 null。
 */
export function parseCacheDocument(value: unknown, expectedSecid: string): EastmoneyKlineCacheDocument | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Partial<EastmoneyKlineCacheDocument>
  if (item.schemaVersion !== SCHEMA_VERSION || item.secid !== expectedSecid || item.period !== 'daily' || item.adjust !== 'qfq' || item.source !== 'EASTMONEY') return null
  if (!item.payload || item.payload.rc !== 0 || !Array.isArray(item.payload.data?.klines) || !item.payload.data.klines.length) return null
  if (!item.fetchedAt || !item.expiresAt || !Number.isFinite(Date.parse(item.expiresAt))) return null
  return item as EastmoneyKlineCacheDocument
}

/**
 * 判断缓存文档是否仍处于服务端下发的业务有效期内。
 * @param document 已通过结构校验的缓存文档。
 * @param now 用于比较的当前时间。
 * @returns 当前时间早于 expiresAt 时为 true。
 */
export function isFresh(document: EastmoneyKlineCacheDocument, now: Date) {
  return now.getTime() < Date.parse(document.expiresAt)
}

/**
 * 通过 Cloudflare Worker 获取固定口径的东财 A 股前复权日 K。
 * @param event 当前 H3 请求。
 * @param secid 东财证券标识。
 * @param beginDate 服务端生成的起始日期 YYYYMMDD。
 * @param endDate 服务端固定的结束日期 YYYYMMDD。
 * @returns 通过响应状态和 K 线数组校验的东财原始响应。
 */
async function fetchEastmoneyKline(event: H3Event, secid: string, beginDate: string, endDate: string) {
  const payload = await fetchCloudflareMarketJson<EastmoneyKlineResponse>(event, '/eastmoney/kline', {
    fields1: 'f1,f2,f3,f4,f5,f6',
    fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f116',
    ut: '7eea3edcaed734bea9cbfc24409ed989',
    klt: '101',
    fqt: '1',
    secid,
    beg: beginDate,
    end: endDate
  })
  if (payload.rc !== 0 || !Array.isArray(payload.data?.klines) || !payload.data.klines.length) {
    throw new ApiResponseError(502, 'UPSTREAM_UNAVAILABLE', '东财历史 K 线接口未返回有效数据')
  }
  return payload
}

/**
 * 创建准备写入 Redis 的共享缓存文档，业务有效期固定为真实回源后的 30 分钟。
 * @param secid 东财证券标识。
 * @param beginDate 本次请求起始日期。
 * @param endDate 本次请求结束日期。
 * @param payload 已校验的东财原始响应。
 * @param now 本次真实回源完成时间。
 * @returns 可直接写入 Redis 的版本化文档。
 */
function createCacheDocument(secid: string, beginDate: string, endDate: string, payload: EastmoneyKlineResponse, now: Date): EastmoneyKlineCacheDocument {
  const fetchedAt = now.toISOString()
  return {
    schemaVersion: SCHEMA_VERSION,
    secid,
    symbol: payload.data?.code ?? secid.split('.')[1] ?? '',
    period: 'daily',
    adjust: 'qfq',
    beginDate,
    endDate,
    source: 'EASTMONEY',
    payload,
    sourceUpdatedAt: payload.data?.klines?.at(-1)?.split(',')[0] ?? null,
    fetchedAt,
    expiresAt: new Date(now.getTime() + BUSINESS_TTL_MS).toISOString()
  }
}

/**
 * 将内部 Redis 文档转换为不暴露缓存实现细节的正式 API 结果。
 * @param document 缓存文档。
 * @param cacheStatus 本次读取的缓存状态。
 * @param warning 可选的旧数据降级提示。
 * @returns 前端可消费的共享结果。
 */
function toApiResult(document: EastmoneyKlineCacheDocument, cacheStatus: EastmoneyKlineApiResult['cacheStatus'], warning?: string): EastmoneyKlineApiResult {
  return {
    secid: document.secid,
    payload: document.payload,
    fetchedAt: document.fetchedAt,
    expiresAt: document.expiresAt,
    cacheStatus,
    stale: cacheStatus === 'STALE',
    ...(warning ? { warning } : {})
  }
}

/**
 * 未取得首次更新锁时进行两次短等待，只读取 Redis 而不穿透至上游。
 * @param redis Upstash Redis 客户端。
 * @param cacheKey 目标缓存键。
 * @param secid 目标证券标识。
 * @returns 其他请求写入的新文档，等待结束仍无数据时返回 null。
 */
async function waitForInitializedCache(redis: ReturnType<typeof getRedisClient>, cacheKey: string, secid: string) {
  for (let attempt = 0; attempt < INITIAL_WAIT_ATTEMPTS; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, INITIAL_WAIT_MS))
    const document = parseCacheDocument(await redis.get<unknown>(cacheKey), secid)
    if (document) return document
  }
  return null
}

/**
 * 仅当锁值仍属于当前请求时原子释放，避免误删后续请求的新锁。
 * @param redis 支持 Lua eval 的 Redis 客户端。
 * @param lockKey 更新锁键。
 * @param requestId 当前锁的唯一持有者 ID。
 * @returns 无返回值；释放失败只记录非敏感日志，不覆盖主请求结果。
 */
async function safelyReleaseLock(redis: RedisLockClient, lockKey: string, requestId: string) {
  try {
    await redis.eval(RELEASE_LOCK_SCRIPT, [lockKey], [requestId])
  } catch (error) {
    console.error('[eastmoney-kline-cache] release lock failed', error instanceof Error ? error.message : String(error))
  }
}

/**
 * 根据当前日期生成约 360 个自然日前的 YYYYMMDD 起始日期。
 * @param now 当前服务端时间。
 * @returns 东财接口接受的紧凑日期字符串。
 */
function createBeginDate(now: Date) {
  const start = new Date(now)
  start.setUTCDate(start.getUTCDate() - DEFAULT_LOOKBACK_DAYS)
  return start.toISOString().slice(0, 10).replaceAll('-', '')
}

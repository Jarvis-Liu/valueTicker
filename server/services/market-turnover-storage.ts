import { marketTurnoverTradeDateSchema } from '~~/shared/schemas/market-turnover'
import type { MarketTurnoverDaySnapshots, MarketTurnoverPhase, MarketTurnoverSnapshot } from '~~/shared/types/market-turnover'
import { getRedisClient } from '~~/server/utils/redis'

type RedisEvaluator = { eval: (script: string, keys: string[], args: string[]) => Promise<unknown> }

const KEY_PREFIX = 'value-ticker:market-turnover:'

/**
 * 原子保存快照：采集窗口内允许覆盖；首次跨过封存阈值的写入会设置 sealedAt。
 * 后续并发请求看到 sealedAt 后仅返回既有值，避免多标签页覆盖比较基准。
 */
const UPDATE_SNAPSHOT_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
local document = raw and cjson.decode(raw) or {tradeDate = ARGV[1], snapshots = {}}
local phase = ARGV[2]
local incoming = cjson.decode(ARGV[3])
local existing = document.snapshots[phase]
if existing and existing.sealedAt and existing.sealedAt ~= cjson.null then
  return cjson.encode({outcome = 'SNAPSHOT_SEALED', snapshot = existing})
end
document.snapshots[phase] = incoming
redis.call('SET', KEYS[1], cjson.encode(document))
return cjson.encode({outcome = 'UPDATED', snapshot = incoming})
`

/** 读取某交易日已保存的午盘和收盘快照；不存在时返回空集合。 */
export async function getMarketTurnoverDaySnapshots(tradeDate: string): Promise<MarketTurnoverDaySnapshots> {
  const date = marketTurnoverTradeDateSchema.parse(tradeDate)
  const raw = await getRedisClient().get<MarketTurnoverDaySnapshots>(getMarketTurnoverKey(date))
  return raw ?? { tradeDate: date, snapshots: {} }
}

/**
 * 写入一个时段快照。调用方已经使用服务端上海时间判断写入窗口和封存状态，
 * 此函数只负责用 Redis Lua 保证“检查已封存 + 写入”不可被并发请求打断。
 */
export async function upsertMarketTurnoverSnapshot(snapshot: MarketTurnoverSnapshot): Promise<{ outcome: 'UPDATED' | 'SNAPSHOT_SEALED', snapshot: MarketTurnoverSnapshot }> {
  const raw = await (getRedisClient() as RedisEvaluator).eval(
    UPDATE_SNAPSHOT_SCRIPT,
    [getMarketTurnoverKey(snapshot.tradeDate)],
    [snapshot.tradeDate, snapshot.phase, JSON.stringify(snapshot)]
  )
  const result = typeof raw === 'string' ? JSON.parse(raw) : raw
  if (!result || typeof result !== 'object' || !('outcome' in result) || !('snapshot' in result)) throw new Error('Invalid market turnover snapshot response')
  return result as { outcome: 'UPDATED' | 'SNAPSHOT_SEALED', snapshot: MarketTurnoverSnapshot }
}

/** 为交易日快照生成固定 Redis 键；行情统计是全局数据，不按用户隔离。 */
export function getMarketTurnoverKey(tradeDate: string) {
  return `${KEY_PREFIX}${tradeDate}`
}

export function createMarketTurnoverSnapshot(tradeDate: string, phase: MarketTurnoverPhase, exchanges: MarketTurnoverSnapshot['exchanges'], sourceUpdatedAt: string | null, now: Date, shouldSeal: boolean): MarketTurnoverSnapshot {
  const capturedAt = now.toISOString()
  return { tradeDate, phase, exchanges, sourceUpdatedAt, capturedAt, sealedAt: shouldSeal ? capturedAt : null }
}

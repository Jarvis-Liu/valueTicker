import { timingSafeEqual } from 'node:crypto'
import { getHeader, type H3Event } from 'h3'
import { createMarketTurnoverSnapshot, upsertMarketTurnoverSnapshot } from '~~/server/services/market-turnover-storage'
import { fetchServerTencentMarketTurnover } from '~~/server/services/tencent-market-turnover'
import { apiFailure, apiSuccess, ApiResponseError } from '~~/server/utils/api-response'
import { MarketTurnoverSourceError, validateMarketTurnoverSourceTimes } from '~~/server/utils/market-turnover-source'
import { getMarketTurnoverWindow } from '~~/server/utils/market-turnover-window'

/**
 * 供 Supabase Cron 调用的三市成交额定时采集接口。
 * 接口不依赖用户会话，只接受服务端私有 Bearer 密钥，并与浏览器兜底采集共用 Redis 封存规则。
 */
export default defineEventHandler(async (event) => {
  try {
    authorizeCronRequest(event)
    const now = new Date()
    const window = getMarketTurnoverWindow(now)
    if (!window) {
      return apiSuccess({ outcome: 'OUTSIDE_WINDOW', message: '当前不在成交额快照采集窗口', snapshot: null })
    }

    const live = await fetchServerTencentMarketTurnover()
    validateMarketTurnoverSourceTimes(window.tradeDate, window.phase, live.sourceUpdatedAtByExchange)
    const snapshot = createMarketTurnoverSnapshot(
      window.tradeDate,
      window.phase,
      live.exchanges,
      live.sourceUpdatedAt,
      now,
      window.shouldSeal
    )
    const result = await upsertMarketTurnoverSnapshot(snapshot)
    console.info('[market-turnover-cron] capture completed', {
      tradeDate: window.tradeDate,
      phase: window.phase,
      outcome: result.outcome,
      sourceUpdatedAt: live.sourceUpdatedAt
    })
    return apiSuccess({
      outcome: result.outcome,
      message: result.outcome === 'SNAPSHOT_SEALED' ? '时间快照已存在，已返回封存数据' : window.shouldSeal ? '成交额时间快照已封存' : '成交额时间快照已更新',
      snapshot: result.snapshot
    })
  } catch (error) {
    const responseError = error instanceof ApiResponseError
      ? error
      : error instanceof MarketTurnoverSourceError
        ? new ApiResponseError(409, 'UPSTREAM_UNAVAILABLE', error.message)
        : new ApiResponseError(500, 'STORAGE_WRITE_FAILED', '定时采集成交额快照失败')
    console.error('[market-turnover-cron] capture failed', responseError.message)
    return apiFailure(event, responseError)
  }
})

function authorizeCronRequest(event: H3Event) {
  const configuredSecret = String(useRuntimeConfig(event).marketTurnoverCronSecret ?? '').trim()
  if (!configuredSecret) {
    throw new ApiResponseError(500, 'STORAGE_WRITE_FAILED', 'MARKET_TURNOVER_CRON_SECRET 未配置')
  }
  const authorization = getHeader(event, 'authorization') ?? ''
  const suppliedSecret = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!safeEqual(suppliedSecret, configuredSecret)) {
    throw new ApiResponseError(401, 'UNAUTHORIZED', '定时采集密钥无效')
  }
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

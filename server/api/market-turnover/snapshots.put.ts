import { updateMarketTurnoverSnapshotPayloadSchema } from '~~/shared/schemas/market-turnover'
import { createMarketTurnoverSnapshot, upsertMarketTurnoverSnapshot } from '~~/server/services/market-turnover-storage'
import { getMarketTurnoverWindow } from '~~/server/utils/market-turnover-window'
import { apiFailure, apiSuccess, ApiResponseError } from '~~/server/utils/api-response'
import { requireUserId } from '~~/server/utils/require-user'

/**
 * 申请更新市场成交额时段快照。
 * 浏览器先直连腾讯取得三家交易所成交额，再调用本接口；接口仅在午间/收盘窗口写入，
 * 并由服务端时间决定何时封存，防止客户端时钟、多标签页或重复请求改写历史基准。
 */
export default defineEventHandler(async (event) => {
  try {
    // 保持与其余配置接口一致：仅已登录页面可读取或申请写入公共市场快照。
    requireUserId()
    const payload = updateMarketTurnoverSnapshotPayloadSchema.parse(await readBody(event))
    const now = new Date()
    const window = getMarketTurnoverWindow(now)
    if (!window) {
      return apiSuccess({ outcome: 'OUTSIDE_WINDOW', message: '当前不在成交额快照采集窗口', snapshot: null })
    }

    const snapshot = createMarketTurnoverSnapshot(window.tradeDate, window.phase, payload.exchanges, payload.sourceUpdatedAt, now, window.shouldSeal)
    const result = await upsertMarketTurnoverSnapshot(snapshot)
    return apiSuccess({
      outcome: result.outcome,
      message: result.outcome === 'SNAPSHOT_SEALED' ? '时间快照已存在，已返回封存数据' : window.shouldSeal ? '成交额时间快照已封存' : '成交额时间快照已更新',
      snapshot: result.snapshot
    })
  } catch (error) {
    if (error instanceof ApiResponseError) return apiFailure(event, error)
    if (error && typeof error === 'object' && 'issues' in error) return apiFailure(event, new ApiResponseError(422, 'INVALID_PAYLOAD', '成交额快照参数不合法', error))
    return apiFailure(event, new ApiResponseError(500, 'STORAGE_WRITE_FAILED', '更新成交额快照失败'))
  }
})

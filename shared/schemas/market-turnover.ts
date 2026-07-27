import { z } from 'zod'

const amountSchema = z.number().finite().nonnegative().max(100_000_000_000_000)

/** 校验浏览器从腾讯接口解析出的三家交易所成交额，金额单位为元。 */
export const updateMarketTurnoverSnapshotPayloadSchema = z.object({
  exchanges: z.object({
    sse: amountSchema,
    szse: amountSchema,
    bse: amountSchema
  }),
  sourceUpdatedAt: z.string().datetime().nullable()
})

/** 校验按交易日读取历史快照时使用的 YYYY-MM-DD 参数。 */
export const marketTurnoverTradeDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export type UpdateMarketTurnoverSnapshotPayload = z.infer<typeof updateMarketTurnoverSnapshotPayloadSchema>

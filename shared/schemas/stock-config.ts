import { z } from 'zod'
import {
  MAX_GROUP_MEMBERS,
  MAX_GROUP_NAME_LENGTH,
  MAX_GROUPS_PER_USER,
  MAX_SECURITIES_PER_USER,
  STOCK_CONFIG_SCHEMA_VERSION
} from '../constants/stock'

export const providerSymbolsSchema = z.object({
  tencent: z.string().optional(),
  sina: z.string().optional(),
  eastmoney: z.string().optional()
})

export const securityItemSchema = z.object({
  securityId: z.string().min(1),
  exchange: z.enum(['SSE', 'SZSE', 'BSE']),
  code: z.string().regex(/^\d{6}$/),
  name: z.string().min(1).max(40),
  securityType: z.enum(['STOCK', 'ETF', 'UNKNOWN']),
  board: z.enum(['MAIN', 'GEM', 'STAR', 'BSE', 'ETF', 'UNKNOWN']),
  boardLabel: z.enum(['', '创', '科', '北']),
  pricePrecision: z.union([z.literal(2), z.literal(3)]),
  providerSymbols: providerSymbolsSchema
})

export const stockGroupMemberSchema = securityItemSchema.extend({
  addedAt: z.string().datetime()
})

export const stockGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(MAX_GROUP_NAME_LENGTH),
  sortOrder: z.number().int().min(0),
  isDefault: z.boolean().optional(),
  members: z.array(stockGroupMemberSchema).max(MAX_GROUP_MEMBERS)
})

export const alertRuleSchema = z.object({
  type: z.enum(['CHANGE_UPPER', 'CHANGE_LOWER', 'PRICE_UPPER', 'PRICE_LOWER']),
  enabled: z.boolean(),
  value: z.number().positive(),
  note: z.string().max(50)
})

export const securityAlertsSchema = z.object({
  securityId: z.string().min(1),
  rules: z.array(alertRuleSchema),
  updatedAt: z.string().datetime()
})

export const userStockConfigSchema = z.object({
  schemaVersion: z.literal(STOCK_CONFIG_SCHEMA_VERSION),
  configVersion: z.number().int().min(1),
  userId: z.string().min(1),
  updatedAt: z.string().datetime(),
  groups: z.array(stockGroupSchema).min(1).max(MAX_GROUPS_PER_USER),
  alerts: z.record(z.string(), securityAlertsSchema)
}).superRefine((config, ctx) => {
  const defaultGroups = config.groups.filter(group => group.isDefault)
  if (defaultGroups.length !== 1) {
    ctx.addIssue({
      code: 'custom',
      path: ['groups'],
      message: '配置必须且只能包含一个默认分组'
    })
  }

  const groupNames = new Set<string>()
  for (const [index, group] of config.groups.entries()) {
    const normalizedName = group.name.trim().toLocaleLowerCase()
    if (groupNames.has(normalizedName)) {
      ctx.addIssue({
        code: 'custom',
        path: ['groups', index, 'name'],
        message: '分组名称不能重复'
      })
    }
    groupNames.add(normalizedName)
  }

  const securityIds = new Set<string>()
  for (const group of config.groups) {
    for (const member of group.members) {
      securityIds.add(member.securityId)
    }
  }

  if (securityIds.size > MAX_SECURITIES_PER_USER) {
    ctx.addIssue({
      code: 'custom',
      path: ['groups'],
      message: '用户证券数量超过上限'
    })
  }
})

export const createStockGroupPayloadSchema = z.object({
  name: z.string().trim().min(1, '请输入分组名称').max(MAX_GROUP_NAME_LENGTH, `分组名称不能超过 ${MAX_GROUP_NAME_LENGTH} 个字符`)
})

export const updateStockGroupPayloadSchema = createStockGroupPayloadSchema

export const addStockMemberPayloadSchema = securityItemSchema
export const transferStockMemberPayloadSchema = z.object({
  targetGroupId: z.string().min(1),
  mode: z.enum(['MOVE', 'COPY'])
})
export const updateStockAlertsPayloadSchema = z.object({
  rules: z.array(alertRuleSchema).max(8)
})

export type CreateStockGroupPayload = z.infer<typeof createStockGroupPayloadSchema>
export type UpdateStockGroupPayload = z.infer<typeof updateStockGroupPayloadSchema>
export type AddStockMemberPayload = z.infer<typeof addStockMemberPayloadSchema>
export type TransferStockMemberPayload = z.infer<typeof transferStockMemberPayloadSchema>
export type UpdateStockAlertsPayload = z.infer<typeof updateStockAlertsPayloadSchema>

export type StockExchange = 'SSE' | 'SZSE' | 'BSE'
export type SecurityType = 'STOCK' | 'ETF' | 'UNKNOWN'
export type SecurityBoard = 'MAIN' | 'GEM' | 'STAR' | 'BSE' | 'ETF' | 'UNKNOWN'
export type BoardLabel = '' | '创' | '科' | '北'
export type AlertRuleType = 'CHANGE_UPPER' | 'CHANGE_LOWER' | 'PRICE_UPPER' | 'PRICE_LOWER'

export interface SecurityItem {
  securityId: string
  exchange: StockExchange
  code: string
  name: string
  securityType: SecurityType
  board: SecurityBoard
  boardLabel: BoardLabel
  pricePrecision: 2 | 3
  providerSymbols: {
    tencent?: string
    sina?: string
    eastmoney?: string
  }
}

export interface StockGroupMember extends SecurityItem {
  addedAt: string
}

export interface StockGroup {
  id: string
  name: string
  sortOrder: number
  isDefault?: boolean
  members: StockGroupMember[]
}

/** 可跨设备导入、导出的自选分组文件格式（不包含本地 ID、版本与提醒设置）。 */
export interface StockGroupsExportFile {
  version: 1
  exportedAt: string
  groups: Array<{
    name: string
    isDefault?: boolean
    members: SecurityItem[]
  }>
}

export interface AlertRule {
  type: AlertRuleType
  enabled: boolean
  value: number
  note: string
}

export interface SecurityAlerts {
  securityId: string
  rules: AlertRule[]
  costPrice?: number
  updatedAt: string
}

export interface UserStockConfig {
  schemaVersion: number
  configVersion: number
  userId: string
  updatedAt: string
  groups: StockGroup[]
  alerts: Record<string, SecurityAlerts>
}

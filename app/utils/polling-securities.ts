import type { SecurityItem, StockGroup } from '~~/shared/types/stock'

export function getPollingSecurities(groups: StockGroup[], extraSecurities: SecurityItem[] = []): SecurityItem[] {
  return uniqueSecurities([...groups.flatMap(group => group.members), ...extraSecurities])
}

/** 当前视图的临时刷新参数；不会影响 Worker 的全量自动订阅。 */
export function getGroupSecurities(groups: StockGroup[], groupId: string): SecurityItem[] {
  const members = groupId === 'all'
    ? groups.flatMap(group => group.members)
    : groups.find(group => group.id === groupId)?.members ?? []
  return uniqueSecurities(members)
}

function uniqueSecurities(securities: SecurityItem[]): SecurityItem[] {
  return Array.from(new Map(securities.map(security => [security.securityId, security] as const)).values())
}
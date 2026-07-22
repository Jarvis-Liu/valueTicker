import type { SecurityItem, StockGroup } from '~~/shared/types/stock'

/** Worker 订阅必须覆盖全部分组，不能随当前 UI 视图切换而缩窄。 */
export function getPollingSecurities(groups: StockGroup[]): SecurityItem[] {
  return Array.from(new Map(
    groups.flatMap(group => group.members).map(member => [member.securityId, member] as const)
  ).values())
}
/** 当前视图的临时刷新参数；不会影响 Worker 的全量自动订阅。 */
export function getGroupSecurities(groups: StockGroup[], groupId: string): SecurityItem[] {
  const members = groupId === 'all'
    ? groups.flatMap(group => group.members)
    : groups.find(group => group.id === groupId)?.members ?? []
  return Array.from(new Map(members.map(member => [member.securityId, member] as const)).values())
}
/**
 * 判断市场概览的分时曲线是否来自当前市场日期之前的交易日。
 * 韩国指数使用首尔日期，其余当前市场指数使用上海日期；只影响概览提示，不改变趋势状态或主表格行情。
 */
export function isHistoricalMarketTrend(securityId: string, tradeDate: string | null | undefined, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tradeDate ?? '')) return false
  return tradeDate! < getMarketLocalDate(securityId, now)
}

/** 返回指数所属市场在指定时刻的 YYYY-MM-DD 日期。 */
export function getMarketLocalDate(securityId: string, now = new Date()) {
  const timeZone = securityId.startsWith('KOSPI:') ? 'Asia/Seoul' : 'Asia/Shanghai'
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

/** 生成市场概览历史曲线图标的悬浮说明。 */
export function getHistoricalMarketTrendHint(tradeDate: string) {
  return `当前曲线为 ${tradeDate} 数据，可能因该市场休市或行情尚未更新`
}

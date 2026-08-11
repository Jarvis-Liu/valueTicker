export const TREND_RESUME_STALE_MS = 10_000

/** 仅在页面确实从非活跃恢复，且趋势快照已经过期时补拉一次。 */
export function shouldRefreshTrendAfterActivation(
  wasActive: boolean,
  active: boolean,
  lastRefreshedAt: number,
  now = Date.now()
) {
  return !wasActive
    && active
    && now - lastRefreshedAt >= TREND_RESUME_STALE_MS
}

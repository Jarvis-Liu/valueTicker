import type { ChipDistributionEntry, ChipDistributionSnapshot, ChipDistributionTarget } from '~/types/chip-distribution'
import { fetchChipDistribution, isChipDistributionSupported } from '~/services/chips/stock-sdk-chips'
import { deleteChipCache, readChipCache, writeChipCache } from '~/services/chips/chip-cache.client'

const MAX_CONCURRENT_REQUESTS = 3
const pendingRequests = new Map<string, Promise<ChipDistributionEntry>>()
const requestWaiters: Array<() => void> = []
let activeRequestCount = 0

const idleEntry = (): ChipDistributionEntry => ({ status: 'IDLE', snapshot: null, errorMessage: '' })

/**
 * 提供筹码快照的页面状态、同证券请求合并、并发限制和本地 LRU 缓存。
 * @returns 查询、确保加载、刷新已加载证券及支持范围判断方法。
 */
export function useChipDistribution() {
  const entries = useState<Record<string, ChipDistributionEntry>>('chip-distribution-entries', () => ({}))

  /**
   * 返回目标证券当前页面状态，不支持的证券直接返回 UNSUPPORTED。
   * @param target 证券目标或空值。
   * @returns 当前筹码加载状态。
   */
  function getEntry(target: ChipDistributionTarget | null | undefined) {
    if (!target) return idleEntry()
    if (!isChipDistributionSupported(target)) {
      return { status: 'UNSUPPORTED', snapshot: null, errorMessage: 'ETF、指数等品种暂不支持筹码分布' } satisfies ChipDistributionEntry
    }
    return entries.value[target.securityId] ?? idleEntry()
  }

  /**
   * 确保证券具有未过期筹码快照，同一证券的并发调用共享同一个 Promise。
   * @param target 需要加载的证券。
   * @param force 是否跳过浏览器缓存并重新请求服务端。
   * @returns 最终筹码条目状态。
   */
  async function ensure(target: ChipDistributionTarget, force = false) {
    if (!isChipDistributionSupported(target)) return getEntry(target)

    const current = entries.value[target.securityId]
    if (!force && current?.status === 'READY' && isSnapshotFresh(current.snapshot)) return current
    const pending = pendingRequests.get(target.securityId)
    if (pending) return pending

    // IndexedDB 读取也是异步操作，必须将读取和回源放入同一个共享 Promise，避免并发穿透。
    const request = resolveEntry(target, force).finally(() => pendingRequests.delete(target.securityId))
    pendingRequests.set(target.securityId, request)
    return request
  }

  async function resolveEntry(target: ChipDistributionTarget, force: boolean) {
    if (!force) {
      try {
        const cached = await readChipCache(target.securityId)
        if (cached) {
          const ready = { status: 'READY', snapshot: cached, errorMessage: '' } satisfies ChipDistributionEntry
          entries.value[target.securityId] = ready
          return ready
        }
      } catch {
        // IndexedDB 不可用时直接回源，页面内状态仍可正常工作。
      }
    }
    return runRequest(target)
  }

  /**
   * 在全局并发槽内执行一次筹码请求并同步页面状态和本地缓存。
   * @param target 当前证券目标。
   * @returns READY、EMPTY 或 ERROR 条目。
   */
  async function runRequest(target: ChipDistributionTarget) {
    entries.value[target.securityId] = {
      status: 'LOADING',
      snapshot: entries.value[target.securityId]?.snapshot ?? null,
      errorMessage: ''
    }
    await acquireRequestSlot()
    try {
      const snapshot = await fetchChipDistribution(target)
      if (snapshot.stale) console.warn('[ValueTicker][历史 K 线降级]', target.securityId, snapshot.warning ?? '当前使用共享缓存旧数据')
      const entry: ChipDistributionEntry = snapshot.points.length
        ? { status: 'READY', snapshot, errorMessage: '' }
        : { status: 'EMPTY', snapshot, errorMessage: '暂无可用筹码数据' }
      entries.value[target.securityId] = entry
      if (entry.status === 'READY') {
        try {
          await writeChipCache(snapshot)
        } catch {
          // IndexedDB 不可用时退化为页面内缓存，不影响数据展示。
        }
      }
      return entry
    } catch (error) {
      const entry: ChipDistributionEntry = {
        status: 'ERROR',
        snapshot: entries.value[target.securityId]?.snapshot ?? null,
        errorMessage: error instanceof Error ? error.message : '筹码数据加载失败'
      }
      entries.value[target.securityId] = entry
      return entry
    } finally {
      releaseRequestSlot()
    }
  }

  /**
   * 强制刷新当前页面已经加载过快照的证券，不预热从未访问的股票。
   * @param targets 当前页面可见证券集合。
   * @returns 所有已加载证券的刷新任务完成后结束。
   */
  async function refreshLoaded(targets: ChipDistributionTarget[]) {
    const loadedTargets = targets.filter(target => entries.value[target.securityId]?.snapshot)
    await Promise.all(loadedTargets.map(target => ensure(target, true)))
  }

  /**
   * 清除孤立证券的持久化缓存与当前页面快照。
   * @param securityId 已不属于任何分组的证券 ID。
   */
  async function removeCache(securityId: string) {
    entries.value = Object.fromEntries(
      Object.entries(entries.value).filter(([entrySecurityId]) => entrySecurityId !== securityId)
    )
    try {
      await deleteChipCache(securityId)
    } catch {
      // 缓存清理失败不应回滚已经成功的分组成员删除操作。
    }
  }

  return { entries, getEntry, ensure, refreshLoaded, removeCache, isSupported: isChipDistributionSupported }
}

/**
 * 获取最多三个并行任务中的一个执行槽，满载时按先进先出等待。
 * @returns 获得槽位后结束。
 */
async function acquireRequestSlot() {
  if (activeRequestCount < MAX_CONCURRENT_REQUESTS) {
    activeRequestCount += 1
    return
  }
  await new Promise<void>(resolve => requestWaiters.push(resolve))
  activeRequestCount += 1
}

/**
 * 释放一个请求槽并唤醒最早等待者。
 * @returns 无返回值。
 */
function releaseRequestSlot() {
  activeRequestCount = Math.max(0, activeRequestCount - 1)
  requestWaiters.shift()?.()
}

/**
 * 判断筹码快照是否仍处于后端原始 expiresAt 之前。
 * @param snapshot 可能为空的筹码快照。
 * @returns 有合法未来过期时间时为 true。
 */
function isSnapshotFresh(snapshot: ChipDistributionSnapshot | null | undefined) {
  if (!snapshot) return false
  const expiresAt = Date.parse(snapshot.expiresAt)
  return Number.isFinite(expiresAt) && Date.now() < expiresAt
}

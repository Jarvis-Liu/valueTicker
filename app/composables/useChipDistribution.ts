import type { ChipDistributionEntry, ChipDistributionSnapshot, ChipDistributionTarget } from '~/types/chip-distribution'
import { fetchChipDistribution, isChipDistributionSupported } from '~/services/chips/stock-sdk-chips'

// v3 增加近 60 日技术信号，避免读取缺少 signals 字段的旧版缓存。
const CACHE_PREFIX = 'value-ticker:chips:v3:'
const CACHE_TTL_MS = 30 * 60 * 1000
const MAX_CONCURRENT_REQUESTS = 3
const pendingRequests = new Map<string, Promise<ChipDistributionEntry>>()
const requestWaiters: Array<() => void> = []
let activeRequestCount = 0

const idleEntry = (): ChipDistributionEntry => ({ status: 'IDLE', snapshot: null, errorMessage: '' })

export function useChipDistribution() {
  const entries = useState<Record<string, ChipDistributionEntry>>('chip-distribution-entries', () => ({}))

  function getEntry(target: ChipDistributionTarget | null | undefined) {
    if (!target) return idleEntry()
    if (!isChipDistributionSupported(target)) {
      return { status: 'UNSUPPORTED', snapshot: null, errorMessage: 'ETF、指数等品种暂不支持筹码分布' } satisfies ChipDistributionEntry
    }
    return entries.value[target.securityId] ?? idleEntry()
  }

  async function ensure(target: ChipDistributionTarget, force = false) {
    if (!isChipDistributionSupported(target)) return getEntry(target)

    const current = entries.value[target.securityId]
    if (!force && current?.status === 'READY') return current
    if (!force) {
      const cached = readCache(target.securityId)
      if (cached) {
        const ready = { status: 'READY', snapshot: cached, errorMessage: '' } satisfies ChipDistributionEntry
        entries.value[target.securityId] = ready
        return ready
      }
    }

    const pending = pendingRequests.get(target.securityId)
    if (pending) return pending

    const request = runRequest(target).finally(() => pendingRequests.delete(target.securityId))
    pendingRequests.set(target.securityId, request)
    return request
  }

  async function runRequest(target: ChipDistributionTarget) {
    entries.value[target.securityId] = {
      status: 'LOADING',
      snapshot: entries.value[target.securityId]?.snapshot ?? null,
      errorMessage: ''
    }
    await acquireRequestSlot()
    try {
      const snapshot = await fetchChipDistribution(target)
      const entry: ChipDistributionEntry = snapshot.points.length
        ? { status: 'READY', snapshot, errorMessage: '' }
        : { status: 'EMPTY', snapshot, errorMessage: '暂无可用筹码数据' }
      entries.value[target.securityId] = entry
      if (entry.status === 'READY') writeCache(snapshot)
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

  async function refreshLoaded(targets: ChipDistributionTarget[]) {
    const loadedTargets = targets.filter(target => entries.value[target.securityId]?.snapshot)
    await Promise.all(loadedTargets.map(target => ensure(target, true)))
  }

  return { entries, getEntry, ensure, refreshLoaded, isSupported: isChipDistributionSupported }
}

async function acquireRequestSlot() {
  if (activeRequestCount < MAX_CONCURRENT_REQUESTS) {
    activeRequestCount += 1
    return
  }
  await new Promise<void>(resolve => requestWaiters.push(resolve))
  activeRequestCount += 1
}

function releaseRequestSlot() {
  activeRequestCount = Math.max(0, activeRequestCount - 1)
  requestWaiters.shift()?.()
}

function readCache(securityId: string): ChipDistributionSnapshot | null {
  if (!import.meta.client) return null
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${securityId}`)
    if (!raw) return null
    const snapshot = JSON.parse(raw) as ChipDistributionSnapshot
    const fetchedAt = new Date(snapshot.fetchedAt).getTime()
    if (!Number.isFinite(fetchedAt) || Date.now() - fetchedAt > CACHE_TTL_MS || !Array.isArray(snapshot.points)) {
      localStorage.removeItem(`${CACHE_PREFIX}${securityId}`)
      return null
    }
    return snapshot
  } catch {
    return null
  }
}

function writeCache(snapshot: ChipDistributionSnapshot) {
  if (!import.meta.client) return
  try {
    localStorage.setItem(`${CACHE_PREFIX}${snapshot.securityId}`, JSON.stringify(snapshot))
  } catch {
    // 浏览器存储不可用时退化为页面内缓存，不影响数据展示。
  }
}

import type { ChipDistributionSnapshot } from '~/types/chip-distribution'

const DATABASE_NAME = 'value-ticker-market-cache'
const DATABASE_VERSION = 1
const STORE_NAME = 'chip-snapshots'
const LAST_ACCESSED_INDEX = 'lastAccessedAt'

interface ChipCacheRecord {
  securityId: string
  snapshot: ChipDistributionSnapshot
  lastAccessedAt: string
}

let databasePromise: Promise<IDBDatabase> | null = null

/**
 * 从 IndexedDB 读取筹码快照，并刷新该证券的最近访问时间。
 * @param securityId 项目证券 ID。
 * @returns 未过期的筹码快照；记录不存在、损坏或过期时返回 null。
 */
export async function readChipCache(securityId: string): Promise<ChipDistributionSnapshot | null> {
  const database = await openDatabase()
  const transaction = database.transaction(STORE_NAME, 'readwrite')
  const store = transaction.objectStore(STORE_NAME)
  const record = await requestResult<ChipCacheRecord | undefined>(store.get(securityId))

  if (!record || !isValidSnapshot(record.snapshot)) {
    if (record) store.delete(securityId)
    await transactionDone(transaction)
    return null
  }

  record.lastAccessedAt = new Date().toISOString()
  store.put(record)
  await transactionDone(transaction)
  return record.snapshot
}

/**
 * 将筹码快照写入 IndexedDB；缓存容量由浏览器站点配额管理。
 * @param snapshot 已完成计算且带服务端有效期的筹码快照。
 */
export async function writeChipCache(snapshot: ChipDistributionSnapshot): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(STORE_NAME, 'readwrite')
  const store = transaction.objectStore(STORE_NAME)
  store.put({
    securityId: snapshot.securityId,
    snapshot,
    lastAccessedAt: new Date().toISOString()
  } satisfies ChipCacheRecord)
  await transactionDone(transaction)
}

/**
 * 删除指定证券的 IndexedDB 筹码快照。
 * @param securityId 项目证券 ID。
 */
export async function deleteChipCache(securityId: string): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(STORE_NAME, 'readwrite')
  transaction.objectStore(STORE_NAME).delete(securityId)
  await transactionDone(transaction)
}

function openDatabase(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB) return Promise.reject(new Error('当前浏览器不支持 IndexedDB'))
  if (databasePromise) return databasePromise

  const openingPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      const store = database.objectStoreNames.contains(STORE_NAME)
        ? request.transaction!.objectStore(STORE_NAME)
        : database.createObjectStore(STORE_NAME, { keyPath: 'securityId' })
      if (!store.indexNames.contains(LAST_ACCESSED_INDEX)) {
        store.createIndex(LAST_ACCESSED_INDEX, LAST_ACCESSED_INDEX)
      }
    }
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => database.close()
      resolve(database)
    }
    request.onerror = () => reject(request.error ?? new Error('IndexedDB 打开失败'))
    request.onblocked = () => reject(new Error('IndexedDB 升级被其他页面阻塞'))
  })
  databasePromise = openingPromise.catch((error): never => {
    databasePromise = null
    throw error
  })
  return databasePromise
}

function isValidSnapshot(snapshot: ChipDistributionSnapshot | null | undefined) {
  if (!snapshot || !Array.isArray(snapshot.points)) return false
  const expiresAt = Date.parse(snapshot.expiresAt)
  return Number.isFinite(expiresAt) && Date.now() < expiresAt
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB 请求失败'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB 事务失败'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB 事务已中止'))
  })
}

import { Mutex } from 'async-mutex'

const locks = new Map<string, Mutex>()

export function getUserWriteLock(userId: string) {
  let lock = locks.get(userId)

  if (!lock) {
    lock = new Mutex()
    locks.set(userId, lock)
  }

  return lock
}

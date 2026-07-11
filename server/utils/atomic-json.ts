import { open, rename } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export async function writeJsonAtomic(filePath: string, data: unknown) {
  const dir = dirname(filePath)
  const tempPath = join(dir, `.${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`)
  const file = await open(tempPath, 'w')

  try {
    await file.writeFile(`${JSON.stringify(data, null, 2)}\n`, 'utf8')
    await file.sync()
  } finally {
    await file.close()
  }

  await rename(tempPath, filePath)
  await syncDirectoryBestEffort(dir)
}

async function syncDirectoryBestEffort(dir: string) {
  try {
    const dirHandle = await open(dir, 'r')
    try {
      await dirHandle.sync()
    } finally {
      await dirHandle.close()
    }
  } catch {
    // Directory fsync is best-effort on Windows and some filesystems.
  }
}

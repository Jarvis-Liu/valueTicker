import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { loadEnv } from 'vite'
import { userStockConfigSchema } from '../shared/schemas/stock-config'
import { getRedisClient } from '../server/utils/redis'

for (const [key, value] of Object.entries(loadEnv('development', process.cwd(), ''))) {
  if (process.env[key] === undefined) process.env[key] = value
}

const args = new Set(process.argv.slice(2))
const overwrite = args.has('--overwrite')
const fileArgument = process.argv.find(arg => arg.startsWith('--file='))
const sourcePath = resolve(fileArgument ? fileArgument.slice('--file='.length) : '.data/user-stocks/local-dev-user.json')

const raw = await readFile(sourcePath, 'utf8')
const config = userStockConfigSchema.parse(JSON.parse(raw))
const key = `value-ticker:user-stock-config:${sanitizeUserId(config.userId)}`
const redis = getRedisClient()

if (overwrite) {
  await redis.set(key, config)
  console.log(`Migrated ${sourcePath} to ${key} (overwritten).`)
} else {
  const result = await redis.set(key, config, { nx: true })
  if (result !== 'OK') {
    throw new Error(`Refusing to overwrite existing key ${key}. Re-run with --overwrite only after confirming the target data.`)
  }
  console.log(`Migrated ${sourcePath} to ${key}.`)
}

function sanitizeUserId(userId: string) {
  return userId.replace(/[^a-zA-Z0-9_-]/g, '_')
}

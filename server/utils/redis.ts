import { Redis } from '@upstash/redis'

let redis: Redis | undefined

/**
 * Lazily construct the server-only Upstash client. Keeping construction lazy
 * lets Nuxt start locally even before the development environment variables
 * have been pulled from Vercel.
 */
export function getRedisClient() {
  if (!redis) {
    const { url, token } = getRedisCredentials()
    redis = new Redis({
      url,
      token,
      signal: () => AbortSignal.timeout(30_000),
      retry: { retries: 1, backoff: () => 100 }
    })
  }
  return redis
}

function getRedisCredentials() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
  if (url && token) return { url, token }

  // Vercel Marketplace integrations can namespace variables, for example
  // `kv_value_ticker_KV_REST_API_URL`, instead of exposing the SDK defaults.
  const urlEntry = Object.entries(process.env).find(([key, value]) => value && key.endsWith('_KV_REST_API_URL'))
  if (urlEntry) {
    const prefix = urlEntry[0].slice(0, -'_KV_REST_API_URL'.length)
    const namespacedToken = process.env[`${prefix}_KV_REST_API_TOKEN`]
    if (namespacedToken) return { url: urlEntry[1], token: namespacedToken }
  }

  throw new Error('Missing Upstash Redis URL or token environment variables')
}

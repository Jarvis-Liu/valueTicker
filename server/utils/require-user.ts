import type { H3Event } from 'h3'
import { serverSupabaseUser } from '#supabase/server'
import { ApiResponseError } from '~~/server/utils/api-response'

export async function requireUserId(event: H3Event) {
  try {
    const claims = await serverSupabaseUser(event)
    if (typeof claims?.sub !== 'string' || !claims.sub) {
      throw new ApiResponseError(401, 'UNAUTHORIZED', '请先登录')
    }

    return claims.sub
  } catch (error) {
    if (error instanceof ApiResponseError) throw error
    throw new ApiResponseError(401, 'UNAUTHORIZED', '登录状态无效或已过期')
  }
}

import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchTencentIntradayFromProxy, TencentIntradayProxyError } from './tencent-intraday'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Tencent intraday API client', () => {
  it('returns the formal API payload', async () => {
    const payload = { code: 0, data: { sz300620: { date: '20260812' } } }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: payload }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchTencentIntradayFromProxy('sz300620')).resolves.toEqual(payload)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/quotes/intraday/tencent?code=sz300620',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('marks a temporary upstream failure as eligible for direct fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: false,
      error: { code: 'UPSTREAM_UNAVAILABLE', message: '行情代理暂时不可用' }
    }), { status: 502 })))

    const error = await fetchTencentIntradayFromProxy('sz300620').catch(value => value)
    expect(error).toBeInstanceOf(TencentIntradayProxyError)
    expect(error).toMatchObject({ status: 502, fallbackEligible: true })
  })

  it('does not fallback for an invalid symbol response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: false,
      error: { code: 'INVALID_PAYLOAD', message: '腾讯分时证券代码格式无效' }
    }), { status: 422 })))

    const error = await fetchTencentIntradayFromProxy('invalid').catch(value => value)
    expect(error).toBeInstanceOf(TencentIntradayProxyError)
    expect(error).toMatchObject({ status: 422, fallbackEligible: false })
  })
})

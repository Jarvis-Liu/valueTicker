import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDirectEastmoneyUrl, fetchEastmoneyKlineResult } from './eastmoney-kline'

const payload = {
  rc: 0,
  data: {
    code: '301217',
    klines: ['2026-08-11,10,10.5,10.8,9.9,1,2,3,4,5,6']
  }
}

const staleResult = {
  secid: '0.301217',
  payload,
  fetchedAt: '2026-08-12T00:00:00.000Z',
  expiresAt: '2026-08-12T00:30:00.000Z',
  cacheStatus: 'STALE' as const,
  stale: true,
  warning: '历史 K 线上游暂时不可用，当前展示最近一次有效数据'
}

describe('eastmoney kline API fallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('constructs a fixed direct Eastmoney request', () => {
    const url = createDirectEastmoneyUrl('0.301217', new Date('2026-08-12T00:00:00.000Z'))
    expect(url.origin).toBe('https://push2his.eastmoney.com')
    expect(url.searchParams.get('secid')).toBe('0.301217')
    expect(url.searchParams.get('klt')).toBe('101')
    expect(url.searchParams.get('fqt')).toBe('1')
    expect(url.searchParams.get('beg')).toBe('20250817')
  })

  it('falls back to browser direct fetch and reports the payload after server failure', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('HTTP 502'))
      .mockResolvedValueOnce(payload)
      .mockResolvedValueOnce({
        success: true,
        data: {
          secid: '0.301217',
          payload,
          fetchedAt: '2026-08-12T00:00:00.000Z',
          expiresAt: '2026-08-12T00:30:00.000Z',
          cacheStatus: 'MISS',
          stale: false
        }
      })
    vi.stubGlobal('$fetch', fetchMock)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const result = await fetchEastmoneyKlineResult('0.301217')
    expect(result.cacheStatus).toBe('MISS')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('push2his.eastmoney.com/api/qt/stock/kline/get')
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/quotes/kline/eastmoney-recover')
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ method: 'POST', body: { secid: '0.301217', payload } })
  })

  it('tries browser recovery when the shared cache returns STALE', async () => {
    const recoveredResult = {
      ...staleResult,
      fetchedAt: '2026-08-12T01:00:00.000Z',
      expiresAt: '2026-08-12T01:30:00.000Z',
      cacheStatus: 'REFRESHED' as const,
      stale: false,
      warning: '浏览器直连恢复成功'
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ success: true, data: staleResult })
      .mockResolvedValueOnce(payload)
      .mockResolvedValueOnce({ success: true, data: recoveredResult })
    vi.stubGlobal('$fetch', fetchMock)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await expect(fetchEastmoneyKlineResult('0.301217')).resolves.toEqual(recoveredResult)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('push2his.eastmoney.com/api/qt/stock/kline/get')
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/quotes/kline/eastmoney-recover')
  })

  it('keeps the STALE payload when browser direct recovery also fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ success: true, data: staleResult })
      .mockRejectedValueOnce(new Error('东财直连失败'))
    vi.stubGlobal('$fetch', fetchMock)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await expect(fetchEastmoneyKlineResult('0.301217')).resolves.toEqual(staleResult)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

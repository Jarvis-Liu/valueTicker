import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { useQuoteMonitor } from './useQuoteMonitor'
import type { QuoteAlertEvent, QuoteWorkerResponse } from '../services/quotes/types'

afterEach(() => vi.unstubAllGlobals())

describe('system notifications while editing alert rules', () => {
  it('keeps recording alerts while blocked and resumes only new notifications after closing', () => {
    const addAlertEvent = vi.fn()
    const notifyAlert = vi.fn()
    let receive: ((event: { data: QuoteWorkerResponse }) => void) | undefined
    const makeRef = <T>(value: T) => ({ value })
    vi.stubGlobal('ref', makeRef)
    vi.stubGlobal('shallowRef', makeRef)
    vi.stubGlobal('useMarketStore', () => ({ addAlertEvent }))
    vi.stubGlobal('useBrowserNotifications', () => ({ notifyAlert }))
    vi.stubGlobal('Worker', class {
      set onmessage(handler: typeof receive) { receive = handler }
      postMessage() {}
    })

    const blocked = makeRef(false) as Ref<boolean>
    const monitor = useQuoteMonitor(blocked)
    monitor.start([], 'MIXED')
    const alert: QuoteAlertEvent = {
      id: 'alert-1', securityId: 'SSE:600865', securityName: '百大集团', code: '600865',
      pricePrecision: 2, rule: { type: 'CHANGE_LOWER', enabled: true, value: 1, note: '' },
      price: 9.8, changePercent: -2, triggeredAt: '2026-11-06T02:00:00.000Z', provider: 'TENCENT'
    }
    const emitAlert = () => receive!({ data: { type: 'ALERT_TRIGGERED', event: alert } })

    emitAlert()
    expect(notifyAlert).toHaveBeenCalledTimes(1)

    blocked.value = true
    emitAlert()
    emitAlert()
    expect(addAlertEvent).toHaveBeenCalledTimes(3)
    expect(notifyAlert).toHaveBeenCalledTimes(1)

    blocked.value = false
    expect(notifyAlert).toHaveBeenCalledTimes(1)
    emitAlert()
    expect(addAlertEvent).toHaveBeenCalledTimes(4)
    expect(notifyAlert).toHaveBeenCalledTimes(2)
  })
})

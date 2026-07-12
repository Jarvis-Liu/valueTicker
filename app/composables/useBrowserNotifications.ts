import type { QuoteAlertEvent } from '~/services/quotes/types'

export function useBrowserNotifications() {
  const supported = import.meta.client && 'Notification' in window
  const permission = ref<NotificationPermission>(supported ? Notification.permission : 'denied')

  async function requestPermission() {
    if (!supported) return permission.value
    if (Notification.permission === 'default') {
      permission.value = await Notification.requestPermission()
      return permission.value
    }

    permission.value = Notification.permission
    return permission.value
  }

  function notifyAlert(event: QuoteAlertEvent) {
    if (!supported) return false
    permission.value = Notification.permission
    if (permission.value !== 'granted') return false

    const notification = new Notification(buildTitle(event), {
      body: buildBody(event),
      tag: event.id,
      silent: false
    })

    notification.onclick = () => {
      window.focus()
      notification.close()
    }

    return true
  }

  return {
    permission,
    supported,
    requestPermission,
    notifyAlert
  }
}

function buildTitle(event: QuoteAlertEvent) {
  return `${event.securityName}（${event.code}）${getRuleName(event.rule.type)} ${event.rule.value}${getRuleUnit(event.rule.type)}`
}

function buildBody(event: QuoteAlertEvent) {
  const note = event.rule.note ? `｜${event.rule.note}` : ''
  return `当前价格 ${formatNumber(event.price)}，涨跌幅 ${formatSigned(event.changePercent)}%${note}`
}

function getRuleName(type: QuoteAlertEvent['rule']['type']) {
  if (type === 'PRICE_UPPER') return '价格涨至'
  if (type === 'PRICE_LOWER') return '价格跌至'
  if (type === 'CHANGE_UPPER') return '涨幅超过'
  return '跌幅超过'
}

function getRuleUnit(type: QuoteAlertEvent['rule']['type']) {
  return type.startsWith('PRICE') ? '元' : '%'
}

function formatNumber(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : '--'
}

function formatSigned(value: number) {
  if (!Number.isFinite(value)) return '--'
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`
}

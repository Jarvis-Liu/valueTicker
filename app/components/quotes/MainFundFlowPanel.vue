<script setup lang="ts">
import { IconAlertCircle, IconRefresh } from '@tabler/icons-vue'
import { fetchFundFlow } from '~/services/api/fund-flow'
import type { SecurityIntradayTrend } from '~/services/quotes/types'
import type { IntradayTrendTarget } from '~/types/market'
import { getNextAutomaticRefreshAt, isContinuousAuction } from '~/utils/market-calendar'
import type { FundFlowProvider, FundFlowSnapshot } from '~~/shared/types/fund-flow'
import InteractiveIntradayChart from './InteractiveIntradayChart.vue'

const props = defineProps<{
  target: IntradayTrendTarget
  trend: SecurityIntradayTrend | undefined
  pricePrecision: 2 | 3
}>()
const fundFlowRanks = useFundFlowRanks()

const snapshot = ref<FundFlowSnapshot | null>(null)
const loading = ref(false)
const errorMessage = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
let requestToken = 0
let activeRequestKey = ''

const stockCode = computed(() => {
  if (props.target.securityType !== 'STOCK') return ''
  if (props.target.securityId.startsWith('SSE:')) return `sh${props.target.code}`
  if (props.target.securityId.startsWith('SZSE:')) return `sz${props.target.code}`
  if (props.target.securityId.startsWith('BSE:')) return `bj${props.target.code}`
  return ''
})
// 与分时趋势使用相同路由：北交所由东财覆盖，其余受支持的 A 股优先腾讯。
const fundProvider = computed<FundFlowProvider>(() => props.target.securityId.startsWith('BSE:') ? 'EASTMONEY' : 'TENCENT')
const requestKey = computed(() => `${fundProvider.value}:${stockCode.value}`)
const globalRank = computed(() => fundFlowRanks.rankByCode.value[props.target.code])
const displayedRank = computed(() => {
  // 详情排名与资金趋势保持同源：沪深使用腾讯接口原值，只有北交所用东财 Top 500 补充。
  if (!props.target.securityId.startsWith('BSE:')) return snapshot.value?.summary.rank || '--'
  return globalRank.value
    ? `#${globalRank.value.rank.toLocaleString('zh-CN')} / ${fundFlowRanks.total.value.toLocaleString('zh-CN')}`
    : '--'
})

onMounted(() => {
  void loadFundFlow()
  window.addEventListener('focus', handleWindowActive)
  document.addEventListener('visibilitychange', handleWindowActive)
  scheduleRefresh()
})
onUnmounted(() => {
  requestToken += 1
  clearTimeout(timer)
  window.removeEventListener('focus', handleWindowActive)
  document.removeEventListener('visibilitychange', handleWindowActive)
})
watch(requestKey, () => {
  snapshot.value = null
  errorMessage.value = ''
  void loadFundFlow(true)
})

async function loadFundFlow(force = false) {
  const requestedCode = stockCode.value
  const requestedProvider = fundProvider.value
  const requestedKey = `${requestedProvider}:${requestedCode}`
  if (!requestedCode || (loading.value && activeRequestKey === requestedKey)) return

  const token = ++requestToken
  activeRequestKey = requestedKey
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await fetchFundFlow(requestedCode, requestedProvider, force)
    if (token === requestToken && requestedKey === requestKey.value) snapshot.value = result
  } catch (error) {
    if (token === requestToken) errorMessage.value = error instanceof Error ? error.message : '资金流向请求失败'
  } finally {
    if (token === requestToken) loading.value = false
  }
}

function scheduleRefresh() {
  clearTimeout(timer)
  const nextRunAt = getNextAutomaticRefreshAt(new Date(), 60_000)
  timer = setTimeout(async () => {
    if (isWindowActive() && isContinuousAuction()) await loadFundFlow(true)
    scheduleRefresh()
  }, Math.max(1000, nextRunAt.getTime() - Date.now()))
}

function handleWindowActive() {
  if (isWindowActive() && isContinuousAuction()) void loadFundFlow()
}

function isWindowActive() {
  return document.visibilityState === 'visible' && document.hasFocus()
}

function formatMoney(value: number | null | undefined) {
  if (!Number.isFinite(value)) return '--'
  const absolute = Math.abs(value!)
  const sign = value! > 0 ? '+' : ''
  if (absolute >= 1e8) return `${sign}${(value! / 1e8).toFixed(2)}亿`
  if (absolute >= 1e4) return `${sign}${(value! / 1e4).toFixed(0)}万`
  return `${sign}${value!.toFixed(0)}元`
}

function toneClass(value: number | null | undefined) {
  if (!Number.isFinite(value) || value === 0) return 'text-slate-700'
  return value! > 0 ? 'text-rose-600' : 'text-emerald-600'
}

function formatUpdatedAt(value: string | undefined) {
  if (!value) return '--'
  return new Date(value).toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' })
}

function formatPercent(value: number | null | undefined) {
  return Number.isFinite(value) ? `${value}%` : '--'
}

function providerName(provider: FundFlowProvider | undefined) {
  return provider === 'EASTMONEY' ? '东方财富' : '腾讯'
}
</script>

<template>
  <div>
    <div class="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
      <div class="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
        <p class="text-[10px] text-slate-400">
          主力净流入
        </p>
        <p
          class="mt-0.5 text-sm font-semibold tabular-number"
          :class="toneClass(snapshot?.summary.mainNetIn)"
        >
          {{ formatMoney(snapshot?.summary.mainNetIn) }}
        </p>
      </div>
      <div class="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
        <p class="text-[10px] text-slate-400">
          超大单
        </p>
        <p
          class="mt-0.5 text-sm font-semibold tabular-number"
          :class="toneClass(snapshot?.summary.superFlow)"
        >
          {{ formatMoney(snapshot?.summary.superFlow) }}
        </p>
      </div>
      <div class="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
        <p class="text-[10px] text-slate-400">
          大单
        </p>
        <p
          class="mt-0.5 text-sm font-semibold tabular-number"
          :class="toneClass(snapshot?.summary.bigFlow)"
        >
          {{ formatMoney(snapshot?.summary.bigFlow) }}
        </p>
      </div>
      <div class="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
        <p class="text-[10px] text-slate-400">
          市场排名
        </p>
        <div class="mt-0.5 flex items-center justify-between gap-2">
          <p class="text-sm font-semibold text-slate-700 tabular-number">
            {{ displayedRank }}
          </p>
          <button
            type="button"
            class="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-white hover:text-indigo-600 disabled:opacity-50"
            :disabled="loading"
            aria-label="刷新主力资金"
            @click="loadFundFlow(true)"
          >
            <IconRefresh
              :size="13"
              :class="loading && 'animate-spin'"
            />
          </button>
        </div>
      </div>
    </div>

    <InteractiveIntradayChart
      :trend="trend"
      :price-precision="pricePrecision"
      :fund-flow="snapshot"
      show-fund-flow
    />

    <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
      <span v-if="snapshot">{{ providerName(snapshot.provider) }}资金流向 · {{ formatUpdatedAt(snapshot.updatedAt) }}</span>
      <span v-else-if="loading">正在加载主力资金…</span>
      <span
        v-if="snapshot"
        class="tabular-number"
      >流入 {{ formatPercent(snapshot.summary.mainInRate) }} · 流出 {{ formatPercent(snapshot.summary.mainOutRate) }}</span>
      <span
        v-if="errorMessage"
        class="inline-flex items-center gap-1 text-amber-600"
      >
        <IconAlertCircle :size="12" />
        {{ errorMessage }}，价格分时不受影响
        <button
          type="button"
          class="font-semibold underline underline-offset-2"
          @click="loadFundFlow(true)"
        >重试</button>
      </span>
    </div>
  </div>
</template>

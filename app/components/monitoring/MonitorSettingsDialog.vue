<script setup lang="ts">
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue'
import { IconClock, IconDatabase, IconSettings, IconX } from '@tabler/icons-vue'
import type { QuoteProvider } from '~/services/quotes/types'

const props = defineProps<{
  open: boolean
  provider: QuoteProvider
  pollingIntervalMs: number
}>()

const emit = defineEmits<{
  close: []
  save: [settings: { provider: QuoteProvider, pollingIntervalMs: number }]
}>()

const providerOptions: Array<{ value: QuoteProvider, label: string, description: string }> = [
  { value: 'EASTMONEY', label: '东财行情', description: '支持沪深、北交所及指数行情' },
  { value: 'TENCENT', label: '腾讯行情', description: '覆盖常用 A 股与场内 ETF 行情' }
]
const intervalOptions = [5000, 10000, 15000, 30000]
const draftProvider = ref<QuoteProvider>('EASTMONEY')
const draftIntervalMs = ref(5000)

watch(() => props.open, (open) => {
  if (!open) return
  draftProvider.value = props.provider
  draftIntervalMs.value = normalizeInterval(props.pollingIntervalMs)
})

function normalizeInterval(value: number) {
  return intervalOptions.includes(value) ? value : 5000
}

function save() {
  emit('save', {
    provider: draftProvider.value,
    pollingIntervalMs: normalizeInterval(draftIntervalMs.value)
  })
}
</script>

<template>
  <TransitionRoot
    :show="open"
    as="template"
  >
    <Dialog
      class="relative z-[90]"
      @close="emit('close')"
    >
      <TransitionChild
        as="template"
        enter="ease-out duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-150"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-slate-950/35 backdrop-blur-sm" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-y-auto p-4 sm:p-6">
        <div class="flex min-h-full items-center justify-center">
          <TransitionChild
            as="template"
            enter="ease-out duration-200"
            enter-from="translate-y-2 scale-95 opacity-0"
            enter-to="translate-y-0 scale-100 opacity-100"
            leave="ease-in duration-150"
            leave-from="translate-y-0 scale-100 opacity-100"
            leave-to="translate-y-2 scale-95 opacity-0"
          >
            <DialogPanel class="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div class="flex items-start justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
                <div class="flex items-center gap-3">
                  <span class="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                    <IconSettings :size="21" />
                  </span>
                  <div>
                    <DialogTitle class="text-sm font-semibold text-slate-900">
                      监测设置
                    </DialogTitle>
                    <p class="mt-1 text-[11px] text-slate-400">
                      调整当前浏览器的行情监测策略
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  class="icon-button"
                  aria-label="关闭"
                  @click="emit('close')"
                >
                  <IconX :size="18" />
                </button>
              </div>

              <div class="space-y-6 px-5 py-5 sm:px-6">
                <section>
                  <div class="flex items-center gap-2">
                    <IconDatabase
                      :size="16"
                      class="text-emerald-600"
                    />
                    <h3 class="text-xs font-semibold text-slate-800">
                      行情数据源
                    </h3>
                  </div>
                  <p class="mt-1 text-[11px] leading-4 text-slate-400">
                    切换后会立即使用新数据源拉取一批行情，首批数据仅用于校准提醒。
                  </p>
                  <div class="mt-3 grid gap-2">
                    <button
                      v-for="option in providerOptions"
                      :key="option.value"
                      type="button"
                      class="flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition"
                      :class="draftProvider === option.value ? 'border-emerald-300 bg-emerald-50/70' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'"
                      @click="draftProvider = option.value"
                    >
                      <span
                        class="grid h-4 w-4 shrink-0 place-items-center rounded-full border"
                        :class="draftProvider === option.value ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 bg-white'"
                      >
                        <span
                          v-if="draftProvider === option.value"
                          class="h-1.5 w-1.5 rounded-full bg-white"
                        />
                      </span>
                      <span class="min-w-0">
                        <span class="block text-xs font-semibold text-slate-700">{{ option.label }}</span>
                        <span class="mt-0.5 block text-[11px] text-slate-400">{{ option.description }}</span>
                      </span>
                    </button>
                  </div>
                </section>

                <section>
                  <div class="flex items-center gap-2">
                    <IconClock
                      :size="16"
                      class="text-emerald-600"
                    />
                    <h3 class="text-xs font-semibold text-slate-800">
                      轮询频率
                    </h3>
                  </div>
                  <p class="mt-1 text-[11px] leading-4 text-slate-400">
                    最短为 5 秒；上一轮请求未完成时不会发起新的请求。该偏好仅保存在当前浏览器。
                  </p>
                  <div class="mt-3 grid grid-cols-4 gap-2">
                    <button
                      v-for="interval in intervalOptions"
                      :key="interval"
                      type="button"
                      class="rounded-xl border px-2 py-2.5 text-xs font-semibold transition"
                      :class="draftIntervalMs === interval ? 'border-emerald-500 bg-emerald-600 text-white shadow-sm shadow-emerald-200' : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700'"
                      @click="draftIntervalMs = interval"
                    >
                      {{ interval / 1000 }} 秒
                    </button>
                  </div>
                </section>
              </div>

              <div class="flex justify-end gap-3 border-t border-slate-100 px-5 py-4 sm:px-6">
                <button
                  type="button"
                  class="h-10 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                  @click="emit('close')"
                >
                  取消
                </button>
                <button
                  type="button"
                  class="h-10 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white transition hover:bg-emerald-700"
                  @click="save"
                >
                  保存设置
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

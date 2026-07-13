<script setup lang="ts">
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Switch,
  TransitionChild,
  TransitionRoot
} from '@headlessui/vue'
import {
  IconBellRinging,
  IconChevronDown,
  IconInfoCircle,
  IconPlus,
  IconTrash,
  IconX
} from '@tabler/icons-vue'
import type { SecurityQuote } from '~/types/market'
import type { AlertRule, AlertRuleType } from '~~/shared/types/stock'

const props = defineProps<{
  open: boolean
  quote: SecurityQuote | null
  rules?: AlertRule[]
  saving?: boolean
}>()

const emit = defineEmits<{
  close: []
  save: [rules: AlertRule[]]
}>()

const localRules = ref<AlertRule[]>([])
const validationMessage = ref('')

const ruleOptions: Array<{ id: AlertRuleType, name: string, hint: string, unit: string }> = [
  { id: 'PRICE_UPPER', name: '价格涨至', hint: '当前价大于等于目标价时提醒', unit: '元' },
  { id: 'PRICE_LOWER', name: '价格跌至', hint: '当前价小于等于目标价时提醒', unit: '元' },
  { id: 'CHANGE_UPPER', name: '涨幅超过', hint: '涨跌幅大于等于目标百分比时提醒', unit: '%' },
  { id: 'CHANGE_LOWER', name: '跌幅超过', hint: '涨跌幅小于等于目标百分比时提醒', unit: '%' }
]

const enabledRuleCount = computed(() => localRules.value.filter(rule => rule.enabled).length)

watch(() => [props.open, props.quote?.securityId, props.rules] as const, () => {
  if (!props.open) return

  localRules.value = cloneRules(props.rules ?? [])
  validationMessage.value = ''

  if (localRules.value.length === 0) {
    addRule()
  }
}, { immediate: true, deep: true })

function addRule() {
  if (localRules.value.length >= 8) {
    validationMessage.value = '单只证券最多配置 8 条提醒规则'
    return
  }

  localRules.value.push(createDefaultRule())
  validationMessage.value = ''
}

function removeRule(index: number) {
  localRules.value.splice(index, 1)
  validationMessage.value = ''
}

function save() {
  const normalizedRules = localRules.value
    .map(rule => ({
      type: rule.type,
      enabled: rule.enabled,
      value: Number(rule.value),
      note: rule.note.trim()
    }))
    .filter(rule => rule.enabled || rule.value > 0 || rule.note)

  const invalidRule = normalizedRules.find(rule => !Number.isFinite(rule.value) || rule.value <= 0)
  if (invalidRule) {
    validationMessage.value = '请为每条保留的规则填写大于 0 的目标值'
    return
  }

  if (normalizedRules.length > 0 && normalizedRules.every(rule => !rule.enabled)) {
    validationMessage.value = '至少开启一条规则才能进入监测；如果不需要提醒，可以删除全部规则后保存'
    return
  }

  emit('save', normalizedRules)
}

function createDefaultRule(): AlertRule {
  const price = Number.isFinite(props.quote?.price) ? props.quote!.price : 0
  const precision = props.quote?.securityType === 'ETF' ? 3 : 2

  return {
    type: 'PRICE_UPPER',
    enabled: true,
    value: price > 0 ? Number((price * 1.03).toFixed(precision)) : 0,
    note: ''
  }
}

function cloneRules(rules: AlertRule[]) {
  return rules.map(rule => ({
    type: rule.type,
    enabled: rule.enabled,
    value: rule.value,
    note: rule.note
  }))
}

function getRuleOption(type: AlertRuleType) {
  return ruleOptions.find(option => option.id === type) ?? ruleOptions[0]!
}
</script>

<template>
  <TransitionRoot
    as="template"
    :show="open"
  >
    <Dialog
      class="relative z-50"
      @close="$emit('close')"
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
        <div class="fixed inset-0 bg-slate-950/35 backdrop-blur-[2px]" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-hidden">
        <div class="absolute inset-0 overflow-hidden">
          <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-4 sm:pl-10">
            <TransitionChild
              as="template"
              enter="transform transition ease-out duration-300"
              enter-from="translate-x-full"
              enter-to="translate-x-0"
              leave="transform transition ease-in duration-200"
              leave-from="translate-x-0"
              leave-to="translate-x-full"
            >
              <DialogPanel class="pointer-events-auto w-screen max-w-lg">
                <div class="flex h-full flex-col bg-white shadow-2xl">
                  <div class="border-b border-slate-100 px-5 py-5 sm:px-6">
                    <div class="flex items-start justify-between gap-4">
                      <div class="flex items-center gap-3">
                        <span class="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                          <IconBellRinging :size="21" />
                        </span>
                        <div>
                          <DialogTitle class="text-base font-semibold text-slate-950">
                            设置提醒规则
                          </DialogTitle>
                          <p
                            v-if="quote"
                            class="mt-1 text-xs text-slate-500"
                          >
                            {{ quote.name }} · {{ quote.code }}，已开启 {{ enabledRuleCount }} 条
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        class="icon-button"
                        aria-label="关闭"
                        @click="$emit('close')"
                      >
                        <IconX :size="18" />
                      </button>
                    </div>
                  </div>

                  <div class="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                    <div
                      v-if="quote"
                      class="mb-5 flex items-end justify-between rounded-2xl bg-[#0f332c] px-4 py-4 text-white"
                    >
                      <div>
                        <p class="text-[11px] text-emerald-100/60">
                          当前价格
                        </p>
                        <p class="mt-1 text-2xl font-semibold tabular-number">
                          {{ Number.isFinite(quote.price) ? quote.price.toFixed(quote.securityType === 'ETF' ? 3 : 2) : '--' }}
                        </p>
                      </div>
                      <p
                        class="text-sm font-semibold tabular-number"
                        :class="quote.change >= 0 ? 'text-rose-300' : 'text-emerald-300'"
                      >
                        {{ quote.change >= 0 ? '+' : '' }}{{ Number.isFinite(quote.changePercent) ? quote.changePercent.toFixed(2) : '--' }}%
                      </p>
                    </div>

                    <div class="mb-4 flex items-center justify-between">
                      <div>
                        <p class="text-sm font-semibold text-slate-900">
                          规则列表
                        </p>
                        <p class="mt-1 text-xs text-slate-500">
                          价格与涨跌幅提醒可以同时存在；开启后，只要轮询值满足阈值就属于可提醒状态。
                        </p>
                      </div>
                      <button
                        type="button"
                        class="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        :disabled="localRules.length >= 8"
                        @click="addRule"
                      >
                        <IconPlus :size="15" />
                        新增规则
                      </button>
                    </div>

                    <div
                      v-if="validationMessage"
                      class="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700"
                    >
                      {{ validationMessage }}
                    </div>

                    <div
                      v-if="localRules.length === 0"
                      class="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center"
                    >
                      <p class="text-sm font-semibold text-slate-700">
                        当前没有提醒规则
                      </p>
                      <p class="mt-1 text-xs text-slate-400">
                        保存空规则会清空该证券提醒配置。
                      </p>
                    </div>

                    <div class="space-y-3">
                      <div
                        v-for="(rule, index) in localRules"
                        :key="index"
                        class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div class="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <p class="text-xs font-semibold text-slate-900">
                              提醒 {{ index + 1 }}
                            </p>
                            <p class="mt-0.5 text-[10px] text-slate-400">
                              {{ getRuleOption(rule.type).hint }}
                            </p>
                          </div>
                          <button
                            type="button"
                            class="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-rose-500 transition hover:bg-rose-50"
                            @click="removeRule(index)"
                          >
                            <IconTrash :size="15" />
                            删除
                          </button>
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                          <label>
                            <span class="text-xs font-semibold text-slate-700">提醒条件</span>
                            <Listbox v-model="rule.type">
                              <div class="relative mt-2">
                                <ListboxButton class="group relative flex h-10 w-full items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 pl-7 pr-9 text-left text-xs font-semibold text-slate-800 shadow-inner shadow-white outline-none transition hover:border-emerald-300 hover:bg-white focus-visible:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-100">
                                  <span class="pointer-events-none absolute left-3 h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.65)]" />
                                  <span class="block truncate">{{ getRuleOption(rule.type).name }}</span>
                                  <span class="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-slate-50 via-slate-50/90 to-transparent transition group-hover:from-white group-hover:via-white/90" />
                                  <IconChevronDown
                                    :size="14"
                                    class="pointer-events-none absolute right-3 text-emerald-700/70 transition group-hover:text-emerald-700"
                                  />
                                </ListboxButton>

                                <Transition
                                  enter-active-class="transition duration-150 ease-out"
                                  enter-from-class="-translate-y-1 opacity-0"
                                  enter-to-class="translate-y-0 opacity-100"
                                  leave-active-class="transition duration-100 ease-in"
                                  leave-from-class="translate-y-0 opacity-100"
                                  leave-to-class="-translate-y-1 opacity-0"
                                >
                                  <ListboxOptions class="absolute left-0 top-[calc(100%+8px)] z-[80] w-full overflow-hidden rounded-xl border border-emerald-100 bg-white p-1 shadow-2xl shadow-slate-900/10 outline-none ring-1 ring-slate-900/5">
                                    <ListboxOption
                                      v-for="option in ruleOptions"
                                      :key="option.id"
                                      v-slot="{ active, selected }"
                                      :value="option.id"
                                      as="template"
                                    >
                                      <li
                                        class="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold transition"
                                        :class="[
                                          active ? 'bg-emerald-50 text-emerald-900' : 'text-slate-600',
                                          selected && 'text-emerald-700'
                                        ]"
                                      >
                                        <span
                                          class="h-1.5 w-1.5 rounded-full"
                                          :class="selected ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.65)]' : 'bg-slate-200'"
                                        />
                                        <span class="min-w-0 flex-1 truncate">{{ option.name }}</span>
                                      </li>
                                    </ListboxOption>
                                  </ListboxOptions>
                                </Transition>
                              </div>
                            </Listbox>
                          </label>

                          <label>
                            <span class="text-xs font-semibold text-slate-700">目标值</span>
                            <div class="relative mt-2">
                              <input
                                v-model.number="rule.value"
                                type="number"
                                min="0"
                                step="0.01"
                                class="h-10 w-full rounded-xl border border-slate-200 px-3 pr-11 text-sm font-semibold text-slate-900 tabular-number focus:border-emerald-400 focus:outline-none"
                              >
                              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{{ getRuleOption(rule.type).unit }}</span>
                            </div>
                          </label>
                        </div>

                        <label class="mt-4 block">
                          <span class="text-xs font-semibold text-slate-700">提醒备注 <span class="font-normal text-slate-400">（可选）</span></span>
                          <input
                            v-model="rule.note"
                            type="text"
                            maxlength="50"
                            class="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none"
                            placeholder="例如：突破后观察成交量"
                          >
                          <span class="mt-1.5 block text-right text-[10px] text-slate-400">{{ rule.note.length }}/50</span>
                        </label>

                        <div class="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
                          <div>
                            <p class="text-xs font-semibold text-slate-800">
                              开启该提醒
                            </p>
                            <p class="mt-0.5 text-[10px] text-slate-400">
                              关闭后保留配置，但不会进入监测
                            </p>
                          </div>
                          <Switch
                            v-model="rule.enabled"
                            class="relative inline-flex h-6 w-11 items-center rounded-full transition"
                            :class="rule.enabled ? 'bg-emerald-500' : 'bg-slate-300'"
                          >
                            <span
                              class="inline-block h-5 w-5 rounded-full bg-white shadow transition"
                              :class="rule.enabled ? 'translate-x-5' : 'translate-x-0.5'"
                            />
                          </Switch>
                        </div>
                      </div>
                    </div>

                    <div class="mt-6 flex gap-2 rounded-xl bg-slate-50 px-3 py-3 text-slate-500">
                      <IconInfoCircle
                        :size="17"
                        class="mt-0.5 shrink-0"
                      />
                      <p class="text-[11px] leading-4">
                        判定规则：价格涨至为当前价 ≥ 目标价，价格跌至为当前价 ≤ 目标价；涨幅超过为涨跌幅 ≥ 目标百分比，跌幅超过为涨跌幅 ≤ 目标百分比。
                      </p>
                    </div>
                  </div>

                  <div class="flex gap-3 border-t border-slate-100 px-5 py-4 sm:px-6">
                    <button
                      type="button"
                      class="h-10 flex-1 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                      :disabled="saving"
                      @click="$emit('close')"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      class="h-10 flex-1 rounded-xl bg-emerald-600 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      :disabled="saving"
                      @click="save"
                    >
                      {{ saving ? '保存中...' : '保存提醒' }}
                    </button>
                  </div>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup lang="ts">
import type { ChipTechnicalSignal } from '~/types/chip-distribution'
import { CHIP_SIGNAL_DEFINITIONS, type ChipSignalFilter } from '~/utils/chip-signals'

const props = defineProps<{
  modelValue: ChipSignalFilter
  signals: ChipTechnicalSignal[]
}>()
const emit = defineEmits<{ 'update:modelValue': [value: ChipSignalFilter] }>()

const filters: Array<{ value: ChipSignalFilter, label: string }> = [
  { value: 'ALL', label: '全部' },
  { value: 'CROSS', label: '交叉' },
  { value: 'OSCILLATOR', label: '超买/超卖' },
  { value: 'TREND', label: '突破/反转' },
  { value: 'HIDDEN', label: '隐藏' }
]

function count(filter: ChipSignalFilter) {
  if (filter === 'ALL') return props.signals.length
  if (filter === 'HIDDEN') return 0
  return props.signals.filter(signal => CHIP_SIGNAL_DEFINITIONS[signal.type].category === filter).length
}
</script>

<template>
  <div
    class="flex gap-1 overflow-x-auto pb-1"
    role="radiogroup"
    aria-label="技术信号筛选"
  >
    <button
      v-for="filter in filters"
      :key="filter.value"
      type="button"
      role="radio"
      :aria-checked="modelValue === filter.value"
      class="shrink-0 rounded-md border px-2 py-1 text-[11px] font-medium transition"
      :class="modelValue === filter.value
        ? 'border-slate-700 bg-slate-700 text-white'
        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'"
      @click="emit('update:modelValue', filter.value)"
    >
      {{ filter.label }}<span v-if="filter.value !== 'HIDDEN'"> {{ count(filter.value) }}</span>
    </button>
  </div>
</template>

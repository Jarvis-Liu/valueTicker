<script setup lang="ts">
import { IconInfoCircle } from '@tabler/icons-vue'

withDefaults(defineProps<{
  variant?: 'dark' | 'light'
}>(), {
  variant: 'light'
})

const tooltipId = useId()
</script>

<template>
  <span class="group relative inline-flex shrink-0">
    <button
      type="button"
      class="grid h-5 w-5 place-items-center rounded-md outline-none transition focus-visible:ring-2"
      :class="variant === 'dark'
        ? 'text-emerald-100/55 hover:bg-white/10 hover:text-emerald-200 focus-visible:ring-emerald-300/40'
        : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 focus-visible:ring-emerald-300'"
      aria-label="查看数据源路由说明"
      :aria-describedby="tooltipId"
    >
      <IconInfoCircle :size="14" />
    </button>

    <span
      :id="tooltipId"
      role="tooltip"
      class="pointer-events-none invisible absolute left-0 top-[calc(100%+8px)] z-[110] w-72 translate-y-1 rounded-xl border px-3 py-2.5 text-left opacity-0 shadow-xl transition duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100"
      :class="variant === 'dark'
        ? 'border-emerald-300/15 bg-[#102f2a] text-emerald-50/75 shadow-slate-950/35'
        : 'border-slate-200 bg-white text-slate-500 shadow-slate-900/10'"
    >
      <span
        class="block text-[11px] font-semibold"
        :class="variant === 'dark' ? 'text-white' : 'text-slate-800'"
      >数据源路由说明</span>
      <span class="mt-1.5 block text-[10px] leading-4">
        实时监测行情使用当前选择的数据源，影响列表报价与提醒判断。
      </span>
      <span class="mt-1 block text-[10px] leading-4">
        分时图与主力动向按证券自动路由：沪深优先腾讯，北交所使用东方财富。
      </span>
    </span>
  </span>
</template>

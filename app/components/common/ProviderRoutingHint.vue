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
      class="pointer-events-none invisible absolute left-0 top-[calc(100%+8px)] z-[110] w-80 max-w-[calc(100vw-2rem)] translate-y-1 rounded-xl border px-3 py-2.5 text-left opacity-0 shadow-xl transition duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100"
      :class="variant === 'dark'
        ? 'border-emerald-300/15 bg-[#102f2a] text-emerald-50/75 shadow-slate-950/35'
        : 'border-slate-200 bg-white text-slate-500 shadow-slate-900/10'"
    >
      <span
        class="block text-[11px] font-semibold"
        :class="variant === 'dark' ? 'text-white' : 'text-slate-800'"
      >三种数据源模式</span>
      <span class="mt-1.5 block text-[10px] leading-4">
        <strong class="font-semibold">默认混合：</strong>沪深、ETF 与 A 股指数使用腾讯；北交所和韩国 KOSPI 使用东财。
      </span>
      <span class="mt-1 block text-[10px] leading-4">
        <strong class="font-semibold">仅东财：</strong>实时行情与分时全部使用东财，接口受限时可能暂不可用。
      </span>
      <span class="mt-1 block text-[10px] leading-4">
        <strong class="font-semibold">仅腾讯：</strong>实时行情与分时全部使用腾讯；不受支持的北交所、韩国 KOSPI 等会显示 --。
      </span>
      <span
        class="mt-2 block border-t pt-2 text-[10px] leading-4"
        :class="variant === 'dark' ? 'border-white/10 text-amber-100/80' : 'border-slate-100 text-amber-700'"
      >
        单一数据源缺少报价时，该证券的分时图和提醒判断也会暂停。筹码、成交额和资金流使用各自独立的数据源，不受这里切换影响。
      </span>
    </span>
  </span>
</template>

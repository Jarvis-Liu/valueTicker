<script setup lang="ts">
import { IconInfoCircle } from '@tabler/icons-vue'
import AppTooltip from '~/components/common/AppTooltip.vue'

withDefaults(defineProps<{
  variant?: 'dark' | 'light'
}>(), {
  variant: 'light'
})
</script>

<template>
  <AppTooltip
    aria-label="查看数据源路由说明"
    placement="bottom"
    :variant="variant"
    width="lg"
  >
    <template #trigger>
      <IconInfoCircle :size="14" />
    </template>

    <span
      class="block text-[11px] font-semibold"
      :class="variant === 'dark'
        ? 'text-white'
        : 'text-slate-800'"
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
  </AppTooltip>
</template>

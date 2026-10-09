<script setup lang="ts">
const props = withDefaults(defineProps<{
  ariaLabel: string
  placement?: 'bottom' | 'left' | 'top'
  variant?: 'dark' | 'light'
  width?: 'sm' | 'lg'
}>(), {
  placement: 'top',
  variant: 'light',
  width: 'sm'
})

const tooltipId = useId()
const trigger = ref<HTMLButtonElement | null>(null)
const tooltip = ref<HTMLElement | null>(null)
const visible = ref(false)
const position = reactive({ top: '0px', left: '0px' })

function show() {
  visible.value = true
  void nextTick(updatePosition)
}

function hide() {
  visible.value = false
}

function updatePosition() {
  if (!trigger.value || !tooltip.value) return
  const triggerRect = trigger.value.getBoundingClientRect()
  const tooltipRect = tooltip.value.getBoundingClientRect()
  const gap = 8
  const viewportPadding = 8
  let top = triggerRect.top - tooltipRect.height - gap
  let left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2

  if (props.placement === 'bottom') {
    top = triggerRect.bottom + gap
    left = triggerRect.left
  } else if (props.placement === 'left') {
    top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2
    left = triggerRect.left - tooltipRect.width - gap
    if (left < viewportPadding) left = triggerRect.right + gap
  } else if (top < viewportPadding) {
    top = triggerRect.bottom + gap
  }

  position.top = `${Math.min(Math.max(top, viewportPadding), window.innerHeight - tooltipRect.height - viewportPadding)}px`
  position.left = `${Math.min(Math.max(left, viewportPadding), window.innerWidth - tooltipRect.width - viewportPadding)}px`
}

onMounted(() => {
  window.addEventListener('scroll', updatePosition, true)
  window.addEventListener('resize', updatePosition)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', updatePosition, true)
  window.removeEventListener('resize', updatePosition)
})
</script>

<template>
  <span class="inline-flex shrink-0">
    <button
      ref="trigger"
      type="button"
      class="grid h-5 w-5 place-items-center rounded-md outline-none transition focus-visible:ring-2"
      :class="variant === 'dark'
        ? 'text-emerald-100/55 hover:bg-white/10 hover:text-emerald-200 focus-visible:ring-emerald-300/40'
        : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 focus-visible:ring-emerald-300'"
      :aria-label="ariaLabel"
      :aria-describedby="visible ? tooltipId : undefined"
      @mouseenter="show"
      @mouseleave="hide"
      @focus="show"
      @blur="hide"
    >
      <slot name="trigger" />
    </button>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="translate-y-1 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="translate-y-1 opacity-0"
      >
        <div
          v-if="visible"
          :id="tooltipId"
          ref="tooltip"
          role="tooltip"
          class="pointer-events-none fixed z-[120] rounded-xl border px-3 py-2.5 text-left shadow-xl"
          :class="[
            width === 'lg' ? 'w-80 max-w-[calc(100vw-2rem)]' : 'w-64 max-w-[calc(100vw-2rem)]',
            variant === 'dark'
              ? 'border-emerald-300/15 bg-[#102f2a] text-emerald-50/75 shadow-slate-950/35'
              : 'border-slate-200 bg-white text-slate-500 shadow-slate-900/10'
          ]"
          :style="position"
        >
          <slot />
        </div>
      </Transition>
    </Teleport>
  </span>
</template>

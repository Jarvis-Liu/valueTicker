<script setup lang="ts">
defineProps<{
  refreshing?: boolean
}>()
</script>

<template>
  <div
    class="absolute inset-0 z-40 grid place-items-center bg-[#f7faf8]/90 backdrop-blur-[1px]"
    role="status"
    aria-live="polite"
  >
    <div class="flex flex-col items-center gap-3 rounded-2xl border border-slate-100 bg-white/95 px-6 py-5 shadow-xl shadow-slate-900/5">
      <svg
        class="h-12 w-12 overflow-visible"
        viewBox="0 0 48 48"
        aria-hidden="true"
      >
        <circle
          class="value-ticker-loader__halo"
          cx="24"
          cy="24"
          r="19"
        />
        <circle
          class="value-ticker-loader__orbit"
          cx="24"
          cy="24"
          r="15.5"
        />
        <path
          class="value-ticker-loader__pulse value-ticker-loader__pulse--green"
          d="M8 25h8l3.2-7.5"
        />
        <path
          class="value-ticker-loader__pulse value-ticker-loader__pulse--red"
          d="M19.2 17.5l4.3 15 3.5-10 2.5 2.5H40"
        />
        <circle
          class="value-ticker-loader__dot"
          cx="40"
          cy="25"
          r="2.5"
        />
      </svg>
      <p class="text-xs font-medium text-slate-600">
        {{ refreshing ? '正在刷新行情…' : '正在加载监测数据…' }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.value-ticker-loader__halo {
  fill: rgba(16, 185, 129, 0.07);
  stroke: rgba(16, 185, 129, 0.14);
  stroke-width: 1;
}

.value-ticker-loader__orbit {
  fill: none;
  stroke: #10b981;
  stroke-dasharray: 48 50;
  stroke-linecap: round;
  stroke-width: 2.25;
  transform-box: fill-box;
  transform-origin: center;
  animation:
    value-ticker-loader-orbit 1.45s linear infinite,
    value-ticker-loader-orbit-color 1.45s cubic-bezier(0.25, 1, 0.5, 1) infinite;
}

.value-ticker-loader__pulse {
  fill: none;
  stroke-dasharray: 43;
  stroke-dashoffset: 43;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.2;
  animation: value-ticker-loader-pulse 2.25s cubic-bezier(0.25, 1, 0.5, 1) infinite;
}

.value-ticker-loader__pulse--green { stroke: #10b981; }
.value-ticker-loader__pulse--red { stroke: #f43f5e; }

.value-ticker-loader__dot {
  fill: #6ee7b7;
  transform-box: fill-box;
  transform-origin: center;
  animation: value-ticker-loader-dot 2.25s cubic-bezier(0.25, 1, 0.5, 1) infinite;
}

@keyframes value-ticker-loader-orbit {
  to { transform: rotate(360deg); }
}

@keyframes value-ticker-loader-orbit-color {
  0%, 45% { stroke: #10b981; }
  100% { stroke: #f43f5e; }
}
@keyframes value-ticker-loader-pulse {
  0%, 12% { stroke-dashoffset: 43; opacity: 0.25; }
  45%, 76% { stroke-dashoffset: 0; opacity: 1; }
  100% { stroke-dashoffset: -43; opacity: 0.35; }
}
@keyframes value-ticker-loader-dot {
  0%, 38% { fill: #6ee7b7; transform: scale(0.68); opacity: 0.35; }
  58% { fill: #6ee7b7; transform: scale(1.2); opacity: 1; }
  82% { fill: #fb7185; transform: scale(1); opacity: 1; }
  100% { fill: #f43f5e; transform: scale(0.68); opacity: 0.55; }
}
@media (prefers-reduced-motion: reduce) {
  .value-ticker-loader__orbit,
  .value-ticker-loader__pulse,
  .value-ticker-loader__dot {
    animation: none;
  }

  .value-ticker-loader__pulse {
    stroke-dashoffset: 0;
  }
}
</style>

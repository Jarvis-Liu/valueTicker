<script setup lang="ts">
import { IconArrowsExchange, IconCopy, IconX } from '@tabler/icons-vue'
import type { WatchGroup } from '~/types/market'

const props = defineProps<{
  open: boolean
  mode: 'MOVE' | 'COPY'
  sourceGroupName: string
  groups: WatchGroup[]
}>()
const emit = defineEmits<{ close: [], submit: [targetGroupId: string] }>()
const targetGroupId = ref('')

watch(() => props.open, (open) => {
  if (open) targetGroupId.value = props.groups[0]?.id ?? ''
})

function submit() {
  if (targetGroupId.value) emit('submit', targetGroupId.value)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-[80] grid place-items-center bg-slate-950/35 px-4 backdrop-blur-sm"
        @click.self="emit('close')"
      >
        <section class="w-full max-w-md rounded-2xl bg-white shadow-2xl">
          <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div class="flex items-center gap-2">
              <span class="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                <IconArrowsExchange
                  v-if="mode === 'MOVE'"
                  :size="17"
                />
                <IconCopy
                  v-else
                  :size="17"
                />
              </span>
              <div>
                <h2 class="text-sm font-semibold text-slate-900">
                  {{ mode === 'MOVE' ? '移动证券' : '复制证券' }}
                </h2>
                <p class="mt-1 text-[11px] text-slate-400">
                  从「{{ sourceGroupName }}」选择目标分组
                </p>
              </div>
            </div>
            <button
              type="button"
              class="icon-button"
              aria-label="关闭"
              @click="emit('close')"
            >
              <IconX :size="17" />
            </button>
          </div>
          <form
            class="space-y-4 px-5 py-5"
            @submit.prevent="submit"
          >
            <label class="block text-xs font-medium text-slate-600">
              目标分组
              <select
                v-model="targetGroupId"
                class="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
              >
                <option
                  v-for="group in groups"
                  :key="group.id"
                  :value="group.id"
                >{{ group.name }}（{{ group.count }} 只）</option>
              </select>
            </label>
            <div class="flex justify-end gap-2">
              <button
                type="button"
                class="rounded-xl px-4 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50"
                @click="emit('close')"
              >
                取消
              </button>
              <button
                type="submit"
                class="rounded-xl bg-[#123c34] px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!targetGroupId"
              >
                确认{{ mode === 'MOVE' ? '移动' : '复制' }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity .16s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>

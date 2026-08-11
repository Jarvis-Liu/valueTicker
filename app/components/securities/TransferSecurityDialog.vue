<script setup lang="ts">
import {
  Listbox,
  ListboxButton,
  ListboxLabel,
  ListboxOption,
  ListboxOptions
} from '@headlessui/vue'
import {
  IconArrowsExchange,
  IconCheck,
  IconChevronDown,
  IconCopy,
  IconFolder,
  IconX
} from '@tabler/icons-vue'
import type { WatchGroup } from '~/types/market'

const props = defineProps<{
  open: boolean
  mode: 'MOVE' | 'COPY'
  sourceGroupName: string
  groups: WatchGroup[]
}>()
const emit = defineEmits<{ close: [], submit: [targetGroupId: string] }>()
const targetGroupId = ref('')
const selectedGroup = computed(() => props.groups.find(group => group.id === targetGroupId.value))

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
            <Listbox
              v-model="targetGroupId"
              as="div"
              class="relative"
              :disabled="groups.length === 0"
            >
              <ListboxLabel class="block text-xs font-medium text-slate-600">
                目标分组
              </ListboxLabel>
              <ListboxButton
                class="group mt-2 flex min-h-12 w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 text-left shadow-sm shadow-slate-900/[0.03] outline-none transition duration-150 hover:border-emerald-300 hover:bg-white focus-visible:border-emerald-400 focus-visible:ring-4 focus-visible:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
              >
                <span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700 transition group-hover:bg-emerald-100">
                  <IconFolder :size="16" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-semibold text-slate-800">
                    {{ selectedGroup?.name ?? '暂无可用分组' }}
                  </span>
                  <span
                    v-if="selectedGroup"
                    class="mt-0.5 block text-[11px] text-slate-400"
                  >
                    已有 {{ selectedGroup.count }} 只证券
                  </span>
                </span>
                <IconChevronDown
                  :size="17"
                  class="shrink-0 text-slate-400 transition duration-200 group-data-[headlessui-state=open]:rotate-180 group-data-[headlessui-state=open]:text-emerald-600"
                />
              </ListboxButton>

              <Transition
                enter-active-class="transition duration-100 ease-out"
                enter-from-class="scale-95 opacity-0"
                enter-to-class="scale-100 opacity-100"
                leave-active-class="transition duration-75 ease-in"
                leave-from-class="scale-100 opacity-100"
                leave-to-class="scale-95 opacity-0"
              >
                <ListboxOptions
                  class="group-options absolute z-[90] mt-2 max-h-60 w-full origin-top overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10 outline-none ring-1 ring-slate-900/[0.03]"
                >
                  <ListboxOption
                    v-for="group in groups"
                    :key="group.id"
                    v-slot="{ active, selected }"
                    :value="group.id"
                    as="template"
                  >
                    <li
                      class="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 outline-none transition-colors"
                      :class="active ? 'bg-emerald-50' : 'bg-white'"
                    >
                      <span
                        class="grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors"
                        :class="selected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'"
                      >
                        <IconFolder :size="14" />
                      </span>
                      <span class="min-w-0 flex-1 truncate text-sm text-slate-700">
                        {{ group.name }}
                      </span>
                      <span class="shrink-0 text-[11px] tabular-nums text-slate-400">
                        {{ group.count }} 只
                      </span>
                      <span class="grid h-5 w-5 shrink-0 place-items-center text-emerald-600">
                        <IconCheck
                          v-if="selected"
                          :size="16"
                          :stroke-width="2.5"
                        />
                      </span>
                    </li>
                  </ListboxOption>
                </ListboxOptions>
              </Transition>
            </Listbox>
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

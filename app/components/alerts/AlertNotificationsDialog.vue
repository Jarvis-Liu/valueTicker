<script setup lang="ts">
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot
} from '@headlessui/vue'
import { IconBellRinging, IconClockHour4, IconTrash, IconX } from '@tabler/icons-vue'
import type { AlertNotification } from '~/types/market'

defineProps<{
  open: boolean
  notifications: AlertNotification[]
}>()

const emit = defineEmits<{
  close: []
  clear: []
}>()
</script>

<template>
  <TransitionRoot
    as="template"
    :show="open"
  >
    <Dialog
      class="relative z-[70]"
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
        <div class="fixed inset-0 bg-slate-950/35 backdrop-blur-[2px]" />
      </TransitionChild>
      <div class="fixed inset-0 grid place-items-center overflow-y-auto p-4">
        <TransitionChild
          as="template"
          enter="ease-out duration-200"
          enter-from="translate-y-2 scale-95 opacity-0"
          enter-to="translate-y-0 scale-100 opacity-100"
          leave="ease-in duration-150"
          leave-from="translate-y-0 scale-100 opacity-100"
          leave-to="translate-y-2 scale-95 opacity-0"
        >
          <DialogPanel class="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div class="flex items-start justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
              <div class="flex items-center gap-3">
                <span class="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-600"><IconBellRinging :size="21" /></span>
                <div>
                  <DialogTitle class="text-base font-semibold text-slate-950">
                    提醒动态
                  </DialogTitle>
                  <p class="mt-0.5 text-xs text-slate-400">
                    当前页面会话内最近 {{ notifications.length >= 20 ? '20+' : notifications.length }} 条提醒
                  </p>
                </div>
              </div>
              <button
                type="button"
                class="icon-button"
                aria-label="关闭提醒动态"
                @click="emit('close')"
              >
                <IconX :size="18" />
              </button>
            </div>
            <div class="max-h-[420px] divide-y divide-slate-100 overflow-y-auto px-5 sm:px-6">
              <article
                v-for="notice in notifications"
                :key="notice.id"
                class="py-4"
              >
                <div class="flex gap-3">
                  <span
                    class="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    :class="notice.tone === 'up' ? 'bg-rose-400' : notice.tone === 'down' ? 'bg-emerald-400' : 'bg-indigo-400'"
                  />
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-semibold text-slate-800">
                      {{ notice.title }}
                    </p>
                    <p class="mt-1 text-xs leading-5 text-slate-500">
                      {{ notice.detail }}
                    </p>
                    <p class="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
                      <IconClockHour4 :size="13" />{{ notice.time }}
                    </p>
                  </div>
                </div>
              </article>
              <div
                v-if="notifications.length === 0"
                class="py-12 text-center text-sm text-slate-400"
              >
                暂无触发提醒
              </div>
            </div>
            <div class="flex items-center justify-between gap-4 border-t border-slate-100 px-5 py-4 sm:px-6">
              <p class="text-[11px] leading-4 text-slate-400">
                清空仅影响站内提醒，不会撤回系统通知。
              </p>
              <button
                type="button"
                class="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-300"
                :disabled="notifications.length === 0"
                @click="emit('clear')"
              >
                <IconTrash :size="15" />清空
              </button>
            </div>
          </DialogPanel>
        </TransitionChild>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

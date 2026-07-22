<script setup lang="ts">
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot
} from '@headlessui/vue'
import { IconAlertTriangle, IconX } from '@tabler/icons-vue'

defineProps<{
  open: boolean
  title: string
  message: string
  confirmText?: string
  pending?: boolean
}>()

const emit = defineEmits<{
  close: []
  confirm: []
}>()
</script>

<template>
  <TransitionRoot
    as="template"
    :show="open"
  >
    <Dialog
      class="relative z-50"
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
          <DialogPanel class="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div class="flex items-start justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
              <div class="flex items-center gap-3">
                <span class="grid h-10 w-10 place-items-center rounded-xl bg-rose-50 text-rose-600">
                  <IconAlertTriangle :size="21" />
                </span>
                <DialogTitle class="text-base font-semibold text-slate-950">
                  {{ title }}
                </DialogTitle>
              </div>
              <button
                type="button"
                class="icon-button"
                aria-label="关闭确认弹框"
                @click="emit('close')"
              >
                <IconX :size="18" />
              </button>
            </div>

            <div class="px-5 py-6 text-sm leading-6 text-slate-600 sm:px-6">
              {{ message }}
            </div>

            <div class="flex gap-3 border-t border-slate-100 px-5 py-4 sm:px-6">
              <button
                type="button"
                class="h-10 flex-1 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                @click="emit('close')"
              >
                取消
              </button>
              <button
                type="button"
                class="h-10 flex-1 rounded-xl bg-rose-600 text-xs font-semibold text-white transition hover:bg-rose-700"
                :disabled="pending"
                @click="emit('confirm')"
              >
                {{ pending ? '处理中…' : (confirmText ?? '确认删除') }}
              </button>
            </div>
          </DialogPanel>
        </TransitionChild>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

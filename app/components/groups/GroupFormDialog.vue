<script setup lang="ts">
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot
} from '@headlessui/vue'
import { IconCheck, IconFolderPlus, IconX } from '@tabler/icons-vue'

const props = defineProps<{
  open: boolean
  mode?: 'create' | 'rename'
  initialName?: string
  existingNames?: string[]
}>()

const emit = defineEmits<{
  close: []
  submit: [name: string]
}>()

const name = ref('')
const errorMessage = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

function reset() {
  name.value = props.initialName ?? ''
  errorMessage.value = ''
}

function validate() {
  const normalizedName = name.value.trim()
  const names = (props.existingNames ?? []).map(item => item.trim().toLocaleLowerCase())

  if (!normalizedName) {
    errorMessage.value = '请输入分组名称'
    return false
  }

  if (normalizedName.length > 20) {
    errorMessage.value = '分组名称不能超过 20 个字符'
    return false
  }

  if (names.includes(normalizedName.toLocaleLowerCase())) {
    errorMessage.value = '分组名称已存在，请换一个名称'
    return false
  }

  errorMessage.value = ''
  return true
}

function submit() {
  if (!validate()) {
    inputRef.value?.focus()
    return
  }

  emit('submit', name.value.trim())
}

watch(() => props.open, (open) => {
  if (open) {
    reset()
    nextTick(() => inputRef.value?.focus())
  }
})

const isRenameMode = computed(() => props.mode === 'rename')
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
            <form @submit.prevent="submit">
              <div class="flex items-start justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
                <div class="flex items-center gap-3">
                  <span class="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                    <IconFolderPlus :size="21" />
                  </span>
                  <div>
                    <DialogTitle class="text-base font-semibold text-slate-950">
                      {{ isRenameMode ? '重命名分组' : '新建分组' }}
                    </DialogTitle>
                    <p class="mt-1 text-xs text-slate-500">
                      {{ isRenameMode ? '更新分组名称，不影响已有证券' : '用分组整理你的关注证券' }}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  class="icon-button"
                  :aria-label="isRenameMode ? '关闭重命名分组' : '关闭新建分组'"
                  @click="emit('close')"
                >
                  <IconX :size="18" />
                </button>
              </div>

              <div class="px-5 py-6 sm:px-6">
                <label class="block">
                  <span class="text-xs font-semibold text-slate-700">分组名称</span>
                  <div class="relative mt-2">
                    <input
                      ref="inputRef"
                      v-model="name"
                      type="text"
                      maxlength="20"
                      autocomplete="off"
                      placeholder="例如：核心资产"
                      class="h-11 w-full rounded-xl border px-3 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                      :class="errorMessage ? 'border-rose-300 focus:border-rose-400' : 'border-slate-200 focus:border-emerald-400'"
                      @input="errorMessage = ''"
                    >
                    <IconCheck
                      v-if="name.trim() && !errorMessage"
                      :size="17"
                      class="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600"
                    />
                  </div>
                  <span class="mt-1.5 flex items-center justify-between text-[10px]">
                    <span :class="errorMessage ? 'text-rose-600' : 'text-slate-400'">
                      {{ errorMessage || '名称长度为 1–20 个字符' }}
                    </span>
                    <span class="text-slate-400">{{ name.length }}/20</span>
                  </span>
                </label>

                <div class="mt-5 rounded-xl bg-slate-50 px-3 py-3 text-[11px] leading-4 text-slate-500">
                  {{ isRenameMode ? '默认分组可以重命名，但不能删除。' : '新建后可以继续添加证券，也可以在分组列表中调整顺序。' }}
                </div>
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
                  type="submit"
                  class="h-10 flex-1 rounded-xl bg-emerald-600 text-xs font-semibold text-white transition hover:bg-emerald-700"
                >
                  {{ isRenameMode ? '保存名称' : '创建分组' }}
                </button>
              </div>
            </form>
          </DialogPanel>
        </TransitionChild>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

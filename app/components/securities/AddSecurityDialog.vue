<script setup lang="ts">
import { IconLoader2, IconSearch, IconX } from '@tabler/icons-vue'
import { searchSecuritiesRequest } from '~/services/api/stock-config'
import type { SecurityItem } from '~~/shared/types/stock'

const props = defineProps<{ open: boolean, groupName: string, existingSecurityIds: string[] }>()
const emit = defineEmits<{ close: [], select: [security: SecurityItem] }>()
const keyword = ref('')
const results = ref<SecurityItem[]>([])
const loading = ref(false)
const errorMessage = ref('')
const hasSearched = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | undefined
let searchSequence = 0

watch(() => props.open, (open) => {
  if (open) {
    keyword.value = ''
    results.value = []
    errorMessage.value = ''
    hasSearched.value = false
  }
})

function scheduleSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  const sequence = ++searchSequence
  hasSearched.value = false
  errorMessage.value = ''

  if (!keyword.value.trim()) {
    results.value = []
    return
  }

  searchTimer = setTimeout(() => search(keyword.value.trim(), sequence), 350)
}

async function search(value = keyword.value.trim(), sequence = searchSequence) {
  if (!value) return
  if (searchTimer) {
    clearTimeout(searchTimer)
    searchTimer = undefined
  }
  loading.value = true
  errorMessage.value = ''
  try {
    const nextResults = (await searchSecuritiesRequest(value)).items
    if (sequence !== searchSequence) return
    results.value = nextResults
    hasSearched.value = true
  } catch (error) {
    if (sequence !== searchSequence) return
    errorMessage.value = error instanceof Error ? error.message : '搜索失败'
    hasSearched.value = true
  } finally {
    loading.value = false
  }
}

function select(security: SecurityItem) {
  emit('select', security)
}

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-[80] grid place-items-center bg-slate-950/35 px-4 backdrop-blur-sm"
        @click.self="emit('close')"
      >
        <section class="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
          <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 class="text-sm font-semibold text-slate-900">
                添加证券
              </h2>
              <p class="mt-1 text-[11px] text-slate-400">
                添加到「{{ groupName }}」
              </p>
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
            class="flex gap-2 px-5 py-4"
            @submit.prevent="search"
          >
            <label class="relative min-w-0 flex-1">
              <IconSearch
                :size="17"
                class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                v-model="keyword"
                autofocus
                class="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm focus:border-emerald-300 focus:bg-white focus:outline-none"
                placeholder="输入证券名称或 6 位代码"
                @input="scheduleSearch"
              >
            </label>
            <button
              type="submit"
              class="h-10 rounded-xl bg-[#123c34] px-4 text-xs font-semibold text-white"
              :disabled="loading"
            >
              <IconLoader2
                v-if="loading"
                :size="16"
                class="animate-spin"
              />
              <span v-else>搜索</span>
            </button>
          </form>
          <p
            v-if="errorMessage"
            class="px-5 pb-3 text-xs text-rose-600"
          >
            {{ errorMessage }}
          </p>
          <div class="max-h-72 overflow-y-auto px-3 pb-3">
            <button
              v-for="security in results"
              :key="security.securityId"
              type="button"
              class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-emerald-50 disabled:cursor-default disabled:hover:bg-transparent"
              :disabled="existingSecurityIds.includes(security.securityId)"
              @click="select(security)"
            >
              <span class="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-500">{{ security.securityType === 'ETF' ? 'ETF' : security.name.slice(0, 1) }}</span>
              <span class="min-w-0 flex-1"><span class="block text-sm font-medium text-slate-800">{{ security.name }} <small
                v-if="security.boardLabel"
                class="text-indigo-600"
              >{{ security.boardLabel }}</small></span><span class="text-xs text-slate-400">{{ security.exchange }} · {{ security.code }}</span></span>
              <span
                v-if="existingSecurityIds.includes(security.securityId)"
                class="text-[11px] font-medium text-emerald-600"
              >已添加</span>
            </button>
            <p
              v-if="!loading && hasSearched && keyword && !results.length"
              class="px-3 py-10 text-center text-xs text-slate-400"
            >
              没有找到匹配的证券
            </p>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity .16s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>

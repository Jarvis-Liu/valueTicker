<script setup lang="ts">
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems
} from '@headlessui/vue'
import { VueDraggable } from 'vue-draggable-plus'
import {
  IconChartDots3,
  IconChevronRight,
  IconDotsVertical,
  IconDownload,
  IconEdit,
  IconFolder,
  IconInfoCircle,
  IconPlus,
  IconTrash,
  IconSettings,
  IconUpload
} from '@tabler/icons-vue'
import type { WatchGroup } from '~/types/market'

const props = defineProps<{
  groups: WatchGroup[]
  selectedId: string
}>()

const emit = defineEmits<{
  select: [id: string]
  add: []
  rename: [group: WatchGroup]
  delete: [group: WatchGroup]
  settings: []
  reorder: [groupIds: string[]]
  export: []
  import: [file: File]
}>()

const persistedGroupCount = computed(() => props.groups.filter(group => group.id !== 'all').length)
const totalSecurityCount = computed(() => props.groups.find(group => group.id === 'all')?.count ?? 0)
const menuPositions = reactive<Record<string, { top: string, left: string }>>({})
const importInput = ref<HTMLInputElement>()

function positionMenu(groupId: string, event: MouseEvent) {
  const button = event.currentTarget as HTMLElement
  const rect = button.getBoundingClientRect()
  menuPositions[groupId] = {
    top: `${rect.bottom + 6}px`,
    left: `${Math.max(8, rect.right - 128)}px`
  }
}

function handleGroupReorder(nextGroups: WatchGroup[]) {
  emit('reorder', nextGroups.filter(group => group.id !== 'all').map(group => group.id))
}

function canMoveGroup(event: { dragged: HTMLElement, related: HTMLElement }) {
  return !event.dragged.classList.contains('group-system-view') && !event.related.classList.contains('group-system-view')
}

function selectImportFile() {
  importInput.value?.click()
}

function handleImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) emit('import', file)
}
</script>

<template>
  <aside class="surface-card flex min-h-0 flex-col overflow-visible lg:h-full">
    <div class="flex items-center justify-between border-b border-slate-100 px-4 py-4">
      <div>
        <p class="text-sm font-semibold text-slate-900">
          自选分组
        </p>
        <p class="mt-0.5 text-[11px] text-slate-400">
          {{ persistedGroupCount }} 个分组 · {{ totalSecurityCount }} 只证券
        </p>
      </div>
      <div class="flex items-center gap-1">
        <input
          ref="importInput"
          type="file"
          accept="application/json,.json"
          class="hidden"
          @change="handleImportFile"
        >
        <button
          type="button"
          class="hidden"
          aria-label="导出自选分组"
          title="导出分组"
          @click="emit('export')"
        >
          <IconDownload :size="17" />
        </button>
        <button
          type="button"
          class="hidden"
          aria-label="导入自选分组"
          title="导入分组"
          @click="selectImportFile"
        >
          <IconUpload :size="17" />
        </button>
        <Menu
          as="div"
          class="relative z-30 order-last"
        >
          <MenuButton
            class="grid h-9 w-9 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="更多分组操作"
            title="更多操作"
          >
            <IconDotsVertical :size="18" />
          </MenuButton>
          <MenuItems class="absolute right-0 top-full z-40 mt-2 w-32 overflow-hidden rounded-xl border border-slate-100 bg-white py-1 shadow-xl shadow-slate-900/10 focus:outline-none">
            <MenuItem v-slot="{ active }">
              <button
                type="button"
                class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-600"
                :class="active && 'bg-slate-50 text-slate-900'"
                @click="emit('export')"
              >
                <IconUpload :size="15" />
                导出分组
              </button>
            </MenuItem>
            <MenuItem v-slot="{ active }">
              <button
                type="button"
                class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-600"
                :class="active && 'bg-slate-50 text-slate-900'"
                @click="selectImportFile"
              >
                <IconDownload :size="15" />
                导入分组
              </button>
            </MenuItem>
          </MenuItems>
        </Menu>
        <button
          type="button"
          class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
          aria-label="新建分组"
          title="新建分组"
          @click="emit('add')"
        >
          <IconPlus :size="18" />
          <span>新建</span>
        </button>
      </div>
    </div>

    <nav
      class="min-h-0 flex-1 overflow-y-auto p-2.5 lg:space-y-1"
      aria-label="股票分组"
    >
      <VueDraggable
        :model-value="groups"
        tag="div"
        class="space-y-1"
        handle=".group-drag-handle"
        filter=".group-system-view"
        :move="canMoveGroup"
        :animation="150"
        ghost-class="group-drag-ghost"
        chosen-class="group-drag-chosen"
        @update:model-value="handleGroupReorder"
      >
        <div
          v-for="group in groups"
          :key="group.id"
          class="group relative flex min-w-[11rem] flex-1 items-center gap-2 rounded-xl px-2 py-1.5 transition lg:w-full lg:min-w-0"
          :class="[group.id === 'all' && 'group-system-view', selectedId === group.id ? 'bg-[#e7f7f1] text-emerald-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900']"
        >
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 text-left"
            @click="emit('select', group.id)"
          >
            <span
              class="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
              :class="[group.id !== 'all' && 'group-drag-handle cursor-grab active:cursor-grabbing', selectedId === group.id ? 'bg-white text-emerald-600 shadow-sm' : 'bg-slate-100 text-slate-400 group-hover:text-slate-600']"
              :title="group.id === 'all' ? undefined : '拖动头像调整分组顺序'"
            >
              <IconChartDots3
                v-if="group.id === 'all'"
                :size="17"
              />
              <IconFolder
                v-else
                :size="17"
              />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[13px] font-medium">{{ group.name }}</span>
              <span
                v-if="group.isDefault"
                class="mt-0.5 hidden text-[10px] text-slate-400 lg:block"
              >默认分组</span>
            </span>
            <span
              class="tabular-number text-xs"
              :class="selectedId === group.id ? 'text-emerald-700' : 'text-slate-400'"
            >{{ group.count }}</span>
            <IconChevronRight
              :size="14"
              class="hidden text-emerald-500 lg:block"
              :class="selectedId === group.id ? 'opacity-100' : 'opacity-0'"
            />
          </button>

          <Menu
            v-if="group.id !== 'all'"
            as="div"
            class="relative z-30 shrink-0"
          >
            <MenuButton
              class="grid h-8 w-8 place-items-center rounded-lg text-slate-400 opacity-100 transition hover:bg-white hover:text-slate-700 lg:opacity-0 lg:group-hover:opacity-100"
              :aria-label="`${group.name} 更多操作`"
              @click="positionMenu(group.id, $event)"
            >
              <IconDotsVertical :size="17" />
            </MenuButton>
            <Teleport to="body">
              <MenuItems
                :style="menuPositions[group.id]"
                class="fixed z-[70] w-32 origin-top-right overflow-hidden rounded-xl border border-slate-100 bg-white py-1 shadow-xl shadow-slate-900/10 focus:outline-none"
              >
                <MenuItem v-slot="{ active }">
                  <button
                    type="button"
                    class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-600"
                    :class="active && 'bg-slate-50 text-slate-900'"
                    @click="emit('rename', group)"
                  >
                    <IconEdit :size="15" />
                    重命名
                  </button>
                </MenuItem>
                <MenuItem
                  v-if="!group.isDefault"
                  v-slot="{ active }"
                >
                  <button
                    type="button"
                    class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-rose-600"
                    :class="active && 'bg-rose-50 text-rose-700'"
                    @click="emit('delete', group)"
                  >
                    <IconTrash :size="15" />
                    删除
                  </button>
                </MenuItem>
              </MenuItems>
            </Teleport>
          </Menu>

          <span
            v-else
            class="h-8 w-8 shrink-0"
          />
        </div>
      </VueDraggable>
    </nav>

    <div class="mt-auto hidden border-t border-slate-100 p-3 lg:block">
      <button
        type="button"
        class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
        @click="emit('settings')"
      >
        <IconSettings :size="17" />
        监测设置
      </button>
      <div class="mt-2 flex gap-2 rounded-xl bg-amber-50 px-3 py-3 text-amber-800">
        <IconInfoCircle
          :size="17"
          class="mt-0.5 shrink-0"
        />
        <p class="text-[11px] leading-4">
          监测依赖当前浏览器页面，设备休眠后提醒可能暂停。
        </p>
      </div>
    </div>
  </aside>
</template>

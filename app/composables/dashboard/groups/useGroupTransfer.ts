import { computed, ref, type Ref } from 'vue'
import type { SecurityQuote, WatchGroup } from '~/types/market'

/** useGroupTransfer 需要的共享分组状态和页面反馈回调。 */
interface GroupTransferOptions {
  /** 当前页面选择的来源分组 ID。 */
  selectedGroupId: Ref<string>
  /** 包含“全部”系统视图的可展示分组。 */
  groups: Readonly<Ref<WatchGroup[]>>
  /** 分组操作共享的当前证券。 */
  activeSecurity: Ref<SecurityQuote | null>
  /** 向页面展示操作结果。 */
  notify: (message: string) => void
}

/**
 * 负责证券跨分组移动和复制：
 * 1. 管理转移弹框、操作模式和当前证券；
 * 2. 排除“全部”视图及当前来源分组，生成可选目标分组；
 * 3. 调用 Store 的原子 MOVE/COPY 接口并反馈结果。
 */
export function useGroupTransfer(options: GroupTransferOptions) {
  /** 用户配置 Store，负责跨组移动或复制的持久化写入。 */
  const userConfigStore = useUserConfigStore()

  /** 移动/复制证券弹框是否打开。 */
  const transferDialogOpen = ref(false)

  /** 当前跨组操作是移动还是复制。 */
  const transferMode = ref<'MOVE' | 'COPY'>('MOVE')

  /** 可作为目标的真实分组，不包含系统“全部”视图和当前来源分组。 */
  const transferGroups = computed(() => options.groups.value.filter(group =>
    group.id !== 'all' && group.id !== options.selectedGroupId.value
  ))

  /** 打开指定证券的移动或复制弹框。 */
  function openTransferDialog(mode: 'MOVE' | 'COPY', quote: SecurityQuote) {
    options.activeSecurity.value = quote
    transferMode.value = mode
    transferDialogOpen.value = true
  }

  /** 关闭移动/复制弹框并清理当前证券。 */
  function closeTransferDialog() {
    transferDialogOpen.value = false
    options.activeSecurity.value = null
  }

  /** 将当前证券移动或复制到目标分组。 */
  async function transferSecurity(targetGroupId: string) {
    if (!options.activeSecurity.value || options.selectedGroupId.value === 'all') return

    try {
      await userConfigStore.transferMember(
        options.selectedGroupId.value,
        options.activeSecurity.value.securityId,
        targetGroupId,
        transferMode.value
      )
      closeTransferDialog()
      options.notify(transferMode.value === 'MOVE' ? '证券已移动' : '证券已复制')
    } catch (error) {
      console.error('[ValueTicker] 转移证券失败', error)
      options.notify(userConfigStore.errorMessage || '证券转移失败')
    }
  }

  return {
    transferDialogOpen,
    transferMode,
    transferGroups,
    openTransferDialog,
    closeTransferDialog,
    transferSecurity
  }
}

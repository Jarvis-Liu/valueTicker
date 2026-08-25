import { computed, ref, watch, type Ref } from 'vue'
import type { SecurityQuote } from '~/types/market'
import { useGroupActions } from './useGroupActions'
import { useGroupImportExport } from './useGroupImportExport'
import { useGroupTransfer } from './useGroupTransfer'

/** useGroupManagement 门面需要的 Dashboard 状态和跨领域回调。 */
interface GroupManagementOptions {
  /** 当前页面选择的分组 ID。 */
  selectedGroupId: Ref<string>
  /** 切换分组后触发该组的一次性行情请求。 */
  refreshGroupSecurities: (groupId: string) => void
  /** 最后一个分组成员关系删除后清理证券筹码缓存。 */
  removeChipCache: (securityId: string) => Promise<unknown>
  /** 向页面展示统一操作结果。 */
  notify: (message: string) => void
}

/**
 * Dashboard 分组管理统一门面（Facade）。
 *
 * 内部按职责组合：
 * - useGroupActions：分组 CRUD、排序和组内证券增删；
 * - useGroupTransfer：证券跨组移动与复制；
 * - useGroupImportExport：分组配置文件导入与导出。
 *
 * 页面只依赖本 composable 的统一出口，内部模块不相互调用；共享状态由门面创建后注入，
 * 既减少 index.vue 的依赖数量，也避免重新形成单个超大 composable。
 */
export function useGroupManagement(options: GroupManagementOptions) {
  /** 用户配置 Store，提供包含“全部”系统视图的分组展示模型。 */
  const userConfigStore = useUserConfigStore()

  /** Dashboard 左侧栏和相关弹框使用的分组列表。 */
  const groups = computed(() => userConfigStore.watchGroups)

  /** 删除与转移流程共享的当前证券上下文。 */
  const activeSecurity = ref<SecurityQuote | null>(null)

  /** 分组及组内证券直接操作模块。 */
  const actions = useGroupActions({
    selectedGroupId: options.selectedGroupId,
    groups,
    activeSecurity,
    refreshGroupSecurities: options.refreshGroupSecurities,
    removeChipCache: options.removeChipCache,
    notify: options.notify
  })

  /** 证券跨组移动和复制模块。 */
  const transfer = useGroupTransfer({
    selectedGroupId: options.selectedGroupId,
    groups,
    activeSecurity,
    notify: options.notify
  })

  /** 分组配置文件导入和导出模块。 */
  const importExport = useGroupImportExport({
    selectedGroupId: options.selectedGroupId,
    notify: options.notify
  })

  /** 当前分组被其他操作删除后，自动回退至稳定的“全部”系统视图。 */
  watch(groups, (nextGroups) => {
    const selectedGroupExists = nextGroups.some(group => group.id === options.selectedGroupId.value)
    if (!selectedGroupExists) options.selectedGroupId.value = 'all'
  })

  return {
    /** Dashboard 可展示分组列表。 */
    groups,
    /** 删除与转移弹框当前操作的证券。 */
    activeSecurity,
    /** 分组 CRUD 和组内证券操作能力。 */
    ...actions,
    /** 证券跨组移动和复制能力。 */
    ...transfer,
    /** 分组文件导入和导出能力。 */
    ...importExport
  }
}

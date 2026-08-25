import { computed, ref, type Ref } from 'vue'
import type { SecurityQuote, WatchGroup } from '~/types/market'
import type { SecurityItem } from '~~/shared/types/stock'

/** useGroupActions 需要的共享 Dashboard 状态与页面反馈回调。 */
interface GroupActionsOptions {
  /** 当前页面选择的分组 ID。 */
  selectedGroupId: Ref<string>
  /** 包含“全部”系统视图的可展示分组。 */
  groups: Readonly<Ref<WatchGroup[]>>
  /** 删除与转移流程共享的当前证券。 */
  activeSecurity: Ref<SecurityQuote | null>
  /** 切换分组后触发该组的一次性行情请求。 */
  refreshGroupSecurities: (groupId: string) => void
  /** 最后一个分组成员关系删除后清理证券筹码缓存。 */
  removeChipCache: (securityId: string) => Promise<unknown>
  /** 向页面展示操作结果。 */
  notify: (message: string) => void
}

/**
 * 负责分组及分组成员的直接操作：
 * 1. 分组选择、新建、重命名、删除和拖拽排序；
 * 2. 组内证券添加、删除和拖拽排序；
 * 3. 管理上述操作对应的表单和确认弹框状态；
 * 4. 最后一个分组成员关系删除后清理该证券的筹码缓存。
 *
 * 证券跨组移动/复制与文件导入导出分别由独立 composable 负责。
 */
export function useGroupActions(options: GroupActionsOptions) {
  /** 用户配置 Store，负责所有分组和成员持久化写入。 */
  const userConfigStore = useUserConfigStore()

  /** 分组表单是否打开。 */
  const groupFormOpen = ref(false)

  /** 分组表单当前执行新建还是重命名。 */
  const groupFormMode = ref<'create' | 'rename'>('create')

  /** 当前正在重命名或等待删除确认的分组。 */
  const activeGroup = ref<WatchGroup | null>(null)

  /** 删除分组二次确认弹框是否打开。 */
  const deleteConfirmOpen = ref(false)

  /** 添加证券弹框是否打开。 */
  const addSecurityOpen = ref(false)

  /** 移除证券二次确认弹框是否打开。 */
  const removeSecurityConfirmOpen = ref(false)

  /** 是否正在提交移除证券请求，用于防止重复操作。 */
  const removingSecurity = ref(false)

  /** 当前选中的可展示分组；分组失效时回退到列表首项。 */
  const selectedGroup = computed(() => options.groups.value.find(group => group.id === options.selectedGroupId.value) ?? options.groups.value[0]!)

  /** “全部”视图添加证券时使用默认分组，否则使用当前分组。 */
  const addTargetGroup = computed(() => options.selectedGroupId.value === 'all'
    ? options.groups.value.find(group => group.isDefault) ?? options.groups.value[0]
    : selectedGroup.value)

  /** 添加证券弹框用于排除重复项的目标分组证券 ID。 */
  const addTargetSecurityIds = computed(() => {
    const group = userConfigStore.stockGroups.find(item => item.id === addTargetGroup.value?.id)
    return group?.members.map(member => member.securityId) ?? []
  })

  /** 分组表单名称去重校验使用的其他分组名称。 */
  const editableGroupNames = computed(() => options.groups.value
    .filter(group => group.id !== 'all' && group.id !== activeGroup.value?.id)
    .map(group => group.name))

  /** 选择 Dashboard 分组，并请求该分组的一次行情快照。 */
  function selectGroup(groupId: string) {
    if (options.selectedGroupId.value === groupId) return
    options.selectedGroupId.value = groupId
    options.refreshGroupSecurities(groupId)
  }

  /** 保存用户拖拽后的分组顺序。 */
  async function reorderGroups(groupIds: string[]) {
    try {
      await userConfigStore.reorderGroups(groupIds)
      options.notify('分组顺序已保存')
    } catch (error) {
      console.error('[ValueTicker] 调整分组顺序失败', error)
      options.notify(userConfigStore.errorMessage || '分组排序保存失败')
    }
  }

  /** 保存当前分组内用户拖拽后的证券顺序。 */
  async function reorderGroupMembers(securityIds: string[]) {
    if (options.selectedGroupId.value === 'all') return

    try {
      await userConfigStore.reorderGroupMembers(options.selectedGroupId.value, securityIds)
      options.notify('证券顺序已保存')
    } catch (error) {
      console.error('[ValueTicker] 调整证券顺序失败', error)
      options.notify(userConfigStore.errorMessage || '证券排序保存失败')
    }
  }

  /** 打开新建分组表单。 */
  function openGroupForm() {
    groupFormMode.value = 'create'
    activeGroup.value = null
    groupFormOpen.value = true
  }

  /** 关闭分组表单。 */
  function closeGroupForm() {
    groupFormOpen.value = false
  }

  /** 打开指定分组的重命名表单。 */
  function openRenameGroupForm(group: WatchGroup) {
    groupFormMode.value = 'rename'
    activeGroup.value = group
    groupFormOpen.value = true
  }

  /** 根据当前表单模式创建或重命名分组。 */
  async function submitGroupForm(name: string) {
    if (groupFormMode.value === 'rename') await renameGroup(name)
    else await createGroup(name)
  }

  /** 创建分组并将页面切换至新分组。 */
  async function createGroup(name: string) {
    try {
      const group = await userConfigStore.createGroup(name)
      options.selectedGroupId.value = group.id
      closeGroupForm()
      options.notify('分组已保存')
    } catch (error) {
      console.error('[ValueTicker] 创建分组失败', error)
      options.notify(userConfigStore.errorMessage || '分组保存失败')
    }
  }

  /** 保存当前活动分组的新名称。 */
  async function renameGroup(name: string) {
    if (!activeGroup.value) return

    try {
      const group = await userConfigStore.renameGroup(activeGroup.value.id, name)
      options.selectedGroupId.value = group.id
      closeGroupForm()
      options.notify('分组名称已更新')
    } catch (error) {
      console.error('[ValueTicker] 重命名分组失败', error)
      options.notify(userConfigStore.errorMessage || '分组重命名失败')
    }
  }

  /** 打开删除指定分组的二次确认弹框。 */
  function openDeleteGroupConfirm(group: WatchGroup) {
    activeGroup.value = group
    deleteConfirmOpen.value = true
  }

  /** 关闭删除分组确认弹框。 */
  function closeDeleteGroupConfirm() {
    deleteConfirmOpen.value = false
  }

  /** 删除当前活动分组，必要时将页面切回“全部”视图。 */
  async function deleteGroup() {
    if (!activeGroup.value) return
    const groupId = activeGroup.value.id

    try {
      await userConfigStore.deleteGroup(groupId)
      if (options.selectedGroupId.value === groupId) options.selectedGroupId.value = 'all'
      closeDeleteGroupConfirm()
      activeGroup.value = null
      options.notify('分组已删除')
    } catch (error) {
      console.error('[ValueTicker] 删除分组失败', error)
      options.notify(userConfigStore.errorMessage || '分组删除失败')
    }
  }

  /** 打开添加证券弹框。 */
  function openAddSecurity() {
    addSecurityOpen.value = true
  }

  /** 将证券添加到当前分组或默认分组。 */
  async function addSecurity(security: SecurityItem) {
    try {
      if (!addTargetGroup.value) throw new Error('暂无可用分组')
      await userConfigStore.addMember(addTargetGroup.value.id, security)
      addSecurityOpen.value = false
      options.notify('证券已添加')
    } catch (error) {
      console.error('[ValueTicker] 添加证券失败', error)
      options.notify(userConfigStore.errorMessage || '证券添加失败')
    }
  }

  /** 打开从当前分组移除证券的二次确认弹框。 */
  function openRemoveSecurityConfirm(quote: SecurityQuote) {
    options.activeSecurity.value = quote
    removeSecurityConfirmOpen.value = true
  }

  /** 关闭移除证券确认弹框并清理当前证券。 */
  function closeRemoveSecurityConfirm() {
    removeSecurityConfirmOpen.value = false
    options.activeSecurity.value = null
  }

  /** 从当前分组移除证券，并在其不属于任何分组时清理筹码缓存。 */
  async function removeSecurity() {
    if (!options.activeSecurity.value || options.selectedGroupId.value === 'all' || removingSecurity.value) return

    const groupId = options.selectedGroupId.value
    const securityId = options.activeSecurity.value.securityId
    removingSecurity.value = true
    closeRemoveSecurityConfirm()

    try {
      await userConfigStore.deleteMember(groupId, securityId)
      // 重新加载持久化结果，避免基于乐观状态误删仍被其他分组使用的缓存。
      await userConfigStore.loadConfig()
      const stillInAnyGroup = userConfigStore.stockGroups.some(group =>
        group.members.some(member => member.securityId === securityId)
      )
      if (!stillInAnyGroup) await options.removeChipCache(securityId)
      options.notify('证券已从当前分组移除')
    } catch (error) {
      console.error('[ValueTicker] 移除证券失败', error)
      options.notify(userConfigStore.errorMessage || '证券移除失败')
    } finally {
      removingSecurity.value = false
    }
  }

  return {
    groupFormOpen,
    groupFormMode,
    activeGroup,
    deleteConfirmOpen,
    addSecurityOpen,
    removeSecurityConfirmOpen,
    removingSecurity,
    selectedGroup,
    addTargetGroup,
    addTargetSecurityIds,
    editableGroupNames,
    selectGroup,
    reorderGroups,
    reorderGroupMembers,
    openGroupForm,
    closeGroupForm,
    openRenameGroupForm,
    submitGroupForm,
    openDeleteGroupConfirm,
    closeDeleteGroupConfirm,
    deleteGroup,
    openAddSecurity,
    addSecurity,
    openRemoveSecurityConfirm,
    closeRemoveSecurityConfirm,
    removeSecurity
  }
}

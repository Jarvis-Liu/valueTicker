import { defineStore } from 'pinia'
import { ClientApiError, createStockGroupRequest, deleteStockGroupRequest, fetchStockConfig, renameStockGroupRequest } from '~/services/api/stock-config'
import type { WatchGroup } from '~/types/market'
import type { StockGroup, UserStockConfig } from '~~/shared/types/stock'

export const useUserConfigStore = defineStore('user-config', () => {
  const config = ref<UserStockConfig | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const errorMessage = ref('')

  const stockGroups = computed(() => [...(config.value?.groups ?? [])].sort((a, b) => a.sortOrder - b.sortOrder))
  const watchGroups = computed<WatchGroup[]>(() => {
    const groups = stockGroups.value.map(toWatchGroup)
    const uniqueSecurityCount = new Set(stockGroups.value.flatMap(group => group.members.map(member => member.securityId))).size

    return [
      {
        id: 'all',
        name: '全部证券',
        count: uniqueSecurityCount
      },
      ...groups
    ]
  })

  async function loadConfig() {
    loading.value = true
    errorMessage.value = ''

    try {
      config.value = await fetchStockConfig()
    } catch (error) {
      errorMessage.value = getErrorMessage(error)
      throw error
    } finally {
      loading.value = false
    }
  }

  async function createGroup(name: string) {
    if (!config.value) {
      await loadConfig()
    }

    if (!config.value) {
      throw new Error('用户配置尚未加载')
    }

    const snapshot = cloneUserStockConfig(config.value)
    const tempGroup: StockGroup = {
      id: `temp_${Date.now()}`,
      name,
      sortOrder: config.value.groups.length,
      members: []
    }

    saving.value = true
    errorMessage.value = ''
    config.value.groups.push(tempGroup)

    try {
      const result = await createStockGroupRequest(name, snapshot.configVersion)
      config.value = result.config
      return result.group
    } catch (error) {
      config.value = snapshot

      if (isVersionConflict(error)) {
        return await retryCreateGroupAfterConflict(name)
      }

      errorMessage.value = getErrorMessage(error)
      throw error
    } finally {
      saving.value = false
    }
  }

  async function retryCreateGroupAfterConflict(name: string) {
    await loadConfig()

    if (!config.value) {
      throw new Error('用户配置尚未加载')
    }

    const snapshot = cloneUserStockConfig(config.value)
    const tempGroup: StockGroup = {
      id: `temp_${Date.now()}`,
      name,
      sortOrder: config.value.groups.length,
      members: []
    }

    config.value.groups.push(tempGroup)

    try {
      const result = await createStockGroupRequest(name, snapshot.configVersion)
      config.value = result.config
      return result.group
    } catch (error) {
      config.value = snapshot
      errorMessage.value = getErrorMessage(error)
      throw error
    }
  }

  async function renameGroup(groupId: string, name: string) {
    await ensureConfigLoaded()

    const currentConfig = config.value!
    const snapshot = cloneUserStockConfig(currentConfig)
    const targetGroup = currentConfig.groups.find(group => group.id === groupId)

    if (!targetGroup) {
      throw new Error('分组不存在')
    }

    saving.value = true
    errorMessage.value = ''
    targetGroup.name = name

    try {
      const result = await renameStockGroupRequest(groupId, name, snapshot.configVersion)
      config.value = result.config
      return result.group
    } catch (error) {
      config.value = snapshot

      if (isVersionConflict(error)) {
        return await retryRenameGroupAfterConflict(groupId, name)
      }

      errorMessage.value = getErrorMessage(error)
      throw error
    } finally {
      saving.value = false
    }
  }

  async function deleteGroup(groupId: string) {
    await ensureConfigLoaded()

    const currentConfig = config.value!
    const snapshot = cloneUserStockConfig(currentConfig)

    saving.value = true
    errorMessage.value = ''
    currentConfig.groups = currentConfig.groups.filter(group => group.id !== groupId)

    try {
      const result = await deleteStockGroupRequest(groupId, snapshot.configVersion)
      config.value = result.config
      return result.group
    } catch (error) {
      config.value = snapshot

      if (isVersionConflict(error)) {
        return await retryDeleteGroupAfterConflict(groupId)
      }

      errorMessage.value = getErrorMessage(error)
      throw error
    } finally {
      saving.value = false
    }
  }

  async function retryRenameGroupAfterConflict(groupId: string, name: string) {
    await loadConfig()

    if (!config.value) {
      throw new Error('用户配置尚未加载')
    }

    const snapshot = cloneUserStockConfig(config.value)
    const targetGroup = config.value.groups.find(group => group.id === groupId)

    if (!targetGroup) {
      throw new Error('分组不存在')
    }

    targetGroup.name = name

    try {
      const result = await renameStockGroupRequest(groupId, name, snapshot.configVersion)
      config.value = result.config
      return result.group
    } catch (error) {
      config.value = snapshot
      errorMessage.value = getErrorMessage(error)
      throw error
    }
  }

  async function retryDeleteGroupAfterConflict(groupId: string) {
    await loadConfig()

    if (!config.value) {
      throw new Error('用户配置尚未加载')
    }

    const currentConfig = config.value
    const snapshot = cloneUserStockConfig(currentConfig)
    currentConfig.groups = currentConfig.groups.filter(group => group.id !== groupId)

    try {
      const result = await deleteStockGroupRequest(groupId, snapshot.configVersion)
      config.value = result.config
      return result.group
    } catch (error) {
      config.value = snapshot
      errorMessage.value = getErrorMessage(error)
      throw error
    }
  }

  async function ensureConfigLoaded() {
    if (!config.value) {
      await loadConfig()
    }

    if (!config.value) {
      throw new Error('用户配置尚未加载')
    }
  }

  return {
    config,
    loading,
    saving,
    errorMessage,
    stockGroups,
    watchGroups,
    loadConfig,
    createGroup,
    renameGroup,
    deleteGroup
  }
})

function toWatchGroup(group: StockGroup): WatchGroup {
  return {
    id: group.id,
    name: group.name,
    count: group.members.length,
    isDefault: group.isDefault
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof ClientApiError) {
    return error.apiError.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return '操作失败，请稍后重试'
}

function isVersionConflict(error: unknown) {
  return error instanceof ClientApiError && error.apiError.code === 'CONFIG_VERSION_CONFLICT'
}

function cloneUserStockConfig(config: UserStockConfig): UserStockConfig {
  return JSON.parse(JSON.stringify(config)) as UserStockConfig
}

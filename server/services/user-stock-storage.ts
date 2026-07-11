import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { DEFAULT_GROUP_ID, MAX_GROUPS_PER_USER, STOCK_CONFIG_SCHEMA_VERSION } from '~~/shared/constants/stock'
import { createStockGroupPayloadSchema, updateStockGroupPayloadSchema, userStockConfigSchema } from '~~/shared/schemas/stock-config'
import type { CreateStockGroupPayload, UpdateStockGroupPayload } from '~~/shared/schemas/stock-config'
import type { StockGroup, UserStockConfig } from '~~/shared/types/stock'
import { writeJsonAtomic } from '~~/server/utils/atomic-json'
import { ApiResponseError } from '~~/server/utils/api-response'
import { getUserWriteLock } from '~~/server/utils/user-write-lock'

const dataDir = join(process.cwd(), '.data', 'user-stocks')

export async function getUserStockConfig(userId: string) {
  await ensureStorageDir()

  const filePath = getConfigPath(userId)
  const config = await readConfigFile(filePath, userId)
  const parsed = userStockConfigSchema.safeParse(config)

  if (!parsed.success) {
    throw new ApiResponseError(500, 'STORAGE_WRITE_FAILED', '用户配置文件结构异常', parsed.error.flatten())
  }

  return parsed.data
}

export async function createStockGroup(userId: string, payload: CreateStockGroupPayload, expectedVersion: number) {
  const lock = getUserWriteLock(userId)

  return lock.runExclusive(async () => {
    const config = await getUserStockConfig(userId)
    const input = createStockGroupPayloadSchema.parse(payload)
    const name = input.name.trim()

    assertConfigVersion(config, expectedVersion)
    assertCanCreateGroup(config, name)

    const now = new Date().toISOString()
    const group: StockGroup = {
      id: `group_${randomUUID()}`,
      name,
      sortOrder: config.groups.length,
      members: []
    }

    const nextConfig: UserStockConfig = {
      ...config,
      configVersion: config.configVersion + 1,
      updatedAt: now,
      groups: [...config.groups, group]
    }

    await persistConfig(userId, nextConfig)

    return {
      config: nextConfig,
      group
    }
  })
}

export async function renameStockGroup(userId: string, groupId: string, payload: UpdateStockGroupPayload, expectedVersion: number) {
  const lock = getUserWriteLock(userId)

  return lock.runExclusive(async () => {
    const config = await getUserStockConfig(userId)
    const input = updateStockGroupPayloadSchema.parse(payload)
    const name = input.name.trim()
    const group = findPersistedGroup(config, groupId)

    assertConfigVersion(config, expectedVersion)
    assertUniqueGroupName(config, name, groupId)

    const now = new Date().toISOString()
    const updatedGroup: StockGroup = {
      ...group,
      name
    }
    const nextConfig: UserStockConfig = {
      ...config,
      configVersion: config.configVersion + 1,
      updatedAt: now,
      groups: config.groups.map(item => item.id === groupId ? updatedGroup : item)
    }

    await persistConfig(userId, nextConfig)

    return {
      config: nextConfig,
      group: updatedGroup
    }
  })
}

export async function deleteStockGroup(userId: string, groupId: string, expectedVersion: number) {
  const lock = getUserWriteLock(userId)

  return lock.runExclusive(async () => {
    const config = await getUserStockConfig(userId)
    const group = findPersistedGroup(config, groupId)

    assertConfigVersion(config, expectedVersion)

    if (group.isDefault) {
      throw new ApiResponseError(422, 'INVALID_PAYLOAD', '默认分组不可删除')
    }

    const now = new Date().toISOString()
    const nextGroups = config.groups
      .filter(item => item.id !== groupId)
      .map((item, index) => ({
        ...item,
        sortOrder: index
      }))
    const nextConfig: UserStockConfig = {
      ...config,
      configVersion: config.configVersion + 1,
      updatedAt: now,
      groups: nextGroups
    }

    await persistConfig(userId, nextConfig)

    return {
      config: nextConfig,
      group
    }
  })
}

async function readConfigFile(filePath: string, userId: string): Promise<UserStockConfig> {
  try {
    const raw = await readFile(filePath, 'utf8')
    return JSON.parse(raw) as UserStockConfig
  } catch (error) {
    if (isNotFoundError(error)) {
      const config = createDefaultConfig(userId)
      await writeJsonAtomic(filePath, config)
      return config
    }

    throw new ApiResponseError(500, 'STORAGE_WRITE_FAILED', '读取用户配置失败')
  }
}

async function persistConfig(userId: string, config: UserStockConfig) {
  const parsed = userStockConfigSchema.safeParse(config)

  if (!parsed.success) {
    throw new ApiResponseError(500, 'STORAGE_WRITE_FAILED', '写入前配置结构校验失败', parsed.error.flatten())
  }

  try {
    await writeJsonAtomic(getConfigPath(userId), parsed.data)
  } catch {
    throw new ApiResponseError(500, 'STORAGE_WRITE_FAILED', '写入用户配置失败')
  }
}

function createDefaultConfig(userId: string): UserStockConfig {
  const now = new Date().toISOString()

  return {
    schemaVersion: STOCK_CONFIG_SCHEMA_VERSION,
    configVersion: 1,
    userId,
    updatedAt: now,
    groups: [
      {
        id: DEFAULT_GROUP_ID,
        name: '默认分组',
        sortOrder: 0,
        isDefault: true,
        members: []
      }
    ],
    alerts: {}
  }
}

async function ensureStorageDir() {
  await mkdir(dataDir, { recursive: true })
}

function getConfigPath(userId: string) {
  return join(dataDir, `${sanitizeUserId(userId)}.json`)
}

function sanitizeUserId(userId: string) {
  return userId.replace(/[^a-zA-Z0-9_-]/g, '_')
}

function assertConfigVersion(config: UserStockConfig, expectedVersion: number) {
  if (config.configVersion !== expectedVersion) {
    throw new ApiResponseError(409, 'CONFIG_VERSION_CONFLICT', '配置版本已变化，请刷新后重试')
  }
}

function assertCanCreateGroup(config: UserStockConfig, name: string) {
  if (config.groups.length >= MAX_GROUPS_PER_USER) {
    throw new ApiResponseError(422, 'GROUP_LIMIT_EXCEEDED', `最多只能创建 ${MAX_GROUPS_PER_USER} 个分组`)
  }

  assertUniqueGroupName(config, name)
}

function findPersistedGroup(config: UserStockConfig, groupId: string) {
  const group = config.groups.find(item => item.id === groupId)

  if (!group) {
    throw new ApiResponseError(404, 'GROUP_NOT_FOUND', '分组不存在')
  }

  return group
}

function assertUniqueGroupName(config: UserStockConfig, name: string, currentGroupId?: string) {
  const normalizedName = name.toLocaleLowerCase()
  const duplicated = config.groups.some(group => group.id !== currentGroupId && group.name.trim().toLocaleLowerCase() === normalizedName)

  if (duplicated) {
    throw new ApiResponseError(409, 'DUPLICATE_GROUP_NAME', '分组名称已存在，请换一个名称')
  }
}

function isNotFoundError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}

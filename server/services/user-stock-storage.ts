import { randomUUID } from 'node:crypto'
import {
  DEFAULT_GROUP_ID,
  MAX_GROUP_MEMBERS,
  MAX_GROUPS_PER_USER,
  MAX_SECURITIES_PER_USER,
  STOCK_CONFIG_SCHEMA_VERSION
} from '~~/shared/constants/stock'
import {
  addStockMemberPayloadSchema,
  createStockGroupPayloadSchema,
  transferStockMemberPayloadSchema,
  updateStockAlertsPayloadSchema,
  updateStockGroupPayloadSchema,
  userStockConfigSchema
} from '~~/shared/schemas/stock-config'
import type {
  AddStockMemberPayload,
  CreateStockGroupPayload,
  TransferStockMemberPayload,
  UpdateStockAlertsPayload,
  UpdateStockGroupPayload
} from '~~/shared/schemas/stock-config'
import type { ApiErrorCode } from '~~/shared/types/api'
import type { UserStockConfig } from '~~/shared/types/stock'
import { ApiResponseError } from '~~/server/utils/api-response'
import { getRedisClient } from '~~/server/utils/redis'

type Operation = 'READ' | 'CREATE_GROUP' | 'RENAME_GROUP' | 'DELETE_GROUP' | 'ADD_MEMBER' | 'DELETE_MEMBER' | 'TRANSFER_MEMBER' | 'UPDATE_ALERTS'

type RedisEvaluator = {
  eval: (script: string, keys: string[], args: string[]) => Promise<unknown>
}

interface ScriptResponse {
  status: 'OK' | 'ERROR'
  code?: ApiErrorCode | 'INVALID_CONFIG'
  configJson?: string
  resultJson?: string
  config?: unknown
  result?: Record<string, unknown>
}

const USER_STOCK_CONFIG_KEY_PREFIX = 'value-ticker:user-stock-config:'

// Every state transition happens in this one Redis command. This protects
// against two Vercel Function instances reading the same old config and then
// overwriting each other's changes.
const USER_STOCK_CONFIG_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then
  raw = ARGV[1]
  redis.call('SET', KEYS[1], raw)
end

local ok, config = pcall(cjson.decode, raw)
if not ok or type(config) ~= 'table' or type(config.configVersion) ~= 'number' or type(config.groups) ~= 'table' or type(config.alerts) ~= 'table' then
  return cjson.encode({status = 'ERROR', code = 'INVALID_CONFIG'})
end

local function emptyArray()
  return cjson.decode('[]')
end

-- Normalize container fields that Redis Lua cjson cannot distinguish when
-- they are empty. Required scalar fields remain validated by the TypeScript
-- schema before the configuration is returned to an API caller.
local function normalizeConfig()
  config.alerts = config.alerts or {}
  for index, group in ipairs(config.groups) do
    group.members = group.members or emptyArray()
    group.sortOrder = index - 1
    for _, member in ipairs(group.members) do
      member.providerSymbols = member.providerSymbols or {}
    end
  end
end
normalizeConfig()

-- Redis Lua cjson loses the distinction between empty objects and arrays.
-- Restore the schema-defined container types after serialization.
local function encodeJson(value)
  local encoded, json = pcall(cjson.encode, value)
  if not encoded or type(json) ~= 'string' then return nil end
  json = string.gsub(json, '"alerts":%[%]', '"alerts":{}')
  json = string.gsub(json, '"providerSymbols":%[%]', '"providerSymbols":{}')
  json = string.gsub(json, '"members":{}', '"members":[]')
  json = string.gsub(json, '"rules":{}', '"rules":[]')
  return json
end

-- A result can reference an item already nested in another result field (for
-- example group.members and member). cjson rejects such shared Lua tables,
-- so isolate every top-level result value before encoding the response.
local function cloneResultValue(value)
  if type(value) ~= 'table' then return value end
  local encoded, json = pcall(cjson.encode, value)
  if not encoded or type(json) ~= 'string' then return nil end
  local decoded, copy = pcall(cjson.decode, json)
  if not decoded then return nil end
  return copy
end

local function successResponse(serializedConfig, result)
  local isolatedResult = {}
  for key, value in pairs(result or {}) do
    local copy = cloneResultValue(value)
    if type(value) == 'table' and copy == nil then return nil end
    isolatedResult[key] = copy
  end
  local serializedResult = encodeJson(isolatedResult)
  if not serializedResult then return nil end
  local encoded, response = pcall(cjson.encode, {status = 'OK', configJson = serializedConfig, resultJson = serializedResult})
  if not encoded or type(response) ~= 'string' then return nil end
  return response
end

if ARGV[2] == 'READ' then
  local serializedConfig = encodeJson(config)
  if not serializedConfig then return cjson.encode({status = 'ERROR', code = 'INVALID_CONFIG'}) end
  return successResponse(serializedConfig, {}) or cjson.encode({status = 'ERROR', code = 'INVALID_CONFIG'})
end

local expectedVersion = tonumber(ARGV[4])
if config.configVersion ~= expectedVersion then
  return cjson.encode({status = 'ERROR', code = 'CONFIG_VERSION_CONFLICT'})
end

local payload = cjson.decode(ARGV[3])
local now = ARGV[5]
local function findGroupIndex(groupId)
  for index, group in ipairs(config.groups) do
    if group.id == groupId then return index end
  end
  return nil
end
local function findMember(group, securityId)
  for index, member in ipairs(group.members) do
    if member.securityId == securityId then return index, member end
  end
  return nil, nil
end
local function filteredMembers(members, securityId)
  local result = emptyArray()
  for _, member in ipairs(members) do
    if member.securityId ~= securityId then table.insert(result, member) end
  end
  return result
end
local function normalizedName(name)
  return string.lower(string.gsub(name, '^%s*(.-)%s*$', '%1'))
end
local function groupNameExists(name, exceptId)
  local normalized = normalizedName(name)
  for _, group in ipairs(config.groups) do
    if group.id ~= exceptId and normalizedName(group.name) == normalized then return true end
  end
  return false
end
local function uniqueSecurityCount()
  local ids = {}
  local count = 0
  for _, group in ipairs(config.groups) do
    for _, member in ipairs(group.members) do
      if not ids[member.securityId] then ids[member.securityId] = true; count = count + 1 end
    end
  end
  return ids, count
end
local function persist(result)
  config.configVersion = config.configVersion + 1
  config.updatedAt = now
  normalizeConfig()
  local serializedConfig = encodeJson(config)
  if not serializedConfig then return cjson.encode({status = 'ERROR', code = 'INVALID_CONFIG'}) end
  local serializedResponse = successResponse(serializedConfig, result)
  if not serializedResponse then return cjson.encode({status = 'ERROR', code = 'INVALID_CONFIG'}) end
  redis.call('SET', KEYS[1], serializedConfig)
  return serializedResponse
end
local function unchanged(result)
  normalizeConfig()
  local serializedConfig = encodeJson(config)
  if not serializedConfig then return cjson.encode({status = 'ERROR', code = 'INVALID_CONFIG'}) end
  return successResponse(serializedConfig, result) or cjson.encode({status = 'ERROR', code = 'INVALID_CONFIG'})
end

if ARGV[2] == 'CREATE_GROUP' then
  if #config.groups >= ${MAX_GROUPS_PER_USER} then return cjson.encode({status = 'ERROR', code = 'GROUP_LIMIT_EXCEEDED'}) end
  if groupNameExists(payload.name) then return cjson.encode({status = 'ERROR', code = 'DUPLICATE_GROUP_NAME'}) end
  local group = {id = ARGV[6], name = payload.name, sortOrder = #config.groups, members = emptyArray()}
  table.insert(config.groups, group)
  return persist({group = group})
end

if ARGV[2] == 'UPDATE_ALERTS' then
  local exists = false
  for _, item in ipairs(config.groups) do
    local _, member = findMember(item, payload.securityId)
    if member then exists = true; break end
  end
  if not exists then return cjson.encode({status = 'ERROR', code = 'SECURITY_NOT_FOUND'}) end
  local alerts = cjson.null
  if #payload.rules > 0 then
    alerts = {securityId = payload.securityId, rules = payload.rules, updatedAt = now}
    config.alerts[payload.securityId] = alerts
  else
    config.alerts[payload.securityId] = nil
  end
  return persist({alerts = alerts})
end

local groupIndex = findGroupIndex(payload.groupId)
if not groupIndex then return cjson.encode({status = 'ERROR', code = 'GROUP_NOT_FOUND'}) end
local group = config.groups[groupIndex]

if ARGV[2] == 'RENAME_GROUP' then
  if groupNameExists(payload.name, group.id) then return cjson.encode({status = 'ERROR', code = 'DUPLICATE_GROUP_NAME'}) end
  group.name = payload.name
  return persist({group = group})
end

if ARGV[2] == 'DELETE_GROUP' then
  if group.isDefault then return cjson.encode({status = 'ERROR', code = 'INVALID_PAYLOAD'}) end
  table.remove(config.groups, groupIndex)
  for index, item in ipairs(config.groups) do item.sortOrder = index - 1 end
  return persist({group = group})
end

if ARGV[2] == 'ADD_MEMBER' then
  local _, existing = findMember(group, payload.member.securityId)
  if existing then return unchanged({group = group, member = existing}) end
  local ids, count = uniqueSecurityCount()
  if #group.members >= ${MAX_GROUP_MEMBERS} then return cjson.encode({status = 'ERROR', code = 'MEMBER_LIMIT_EXCEEDED'}) end
  if not ids[payload.member.securityId] and count >= ${MAX_SECURITIES_PER_USER} then return cjson.encode({status = 'ERROR', code = 'MEMBER_LIMIT_EXCEEDED'}) end
  payload.member.addedAt = now
  table.insert(group.members, payload.member)
  return persist({group = group, member = payload.member})
end

if ARGV[2] == 'DELETE_MEMBER' then
  local _, member = findMember(group, payload.securityId)
  if not member then return cjson.encode({status = 'ERROR', code = 'SECURITY_NOT_FOUND'}) end
  group.members = filteredMembers(group.members, payload.securityId)
  return persist({group = group, member = member})
end

if ARGV[2] == 'TRANSFER_MEMBER' then
  local sourceGroup = group
  local targetIndex = findGroupIndex(payload.targetGroupId)
  if not targetIndex then return cjson.encode({status = 'ERROR', code = 'GROUP_NOT_FOUND'}) end
  local targetGroup = config.groups[targetIndex]
  local _, member = findMember(sourceGroup, payload.securityId)
  if not member then return cjson.encode({status = 'ERROR', code = 'SECURITY_NOT_FOUND'}) end
  if sourceGroup.id == targetGroup.id then return cjson.encode({status = 'ERROR', code = 'INVALID_PAYLOAD'}) end
  local _, targetMember = findMember(targetGroup, payload.securityId)
  if payload.mode == 'COPY' and targetMember then return unchanged({sourceGroup = sourceGroup, targetGroup = targetGroup, member = member}) end
  if payload.mode == 'MOVE' and targetMember then
    sourceGroup.members = filteredMembers(sourceGroup.members, payload.securityId)
    return persist({sourceGroup = sourceGroup, targetGroup = targetGroup, member = member})
  end
  if #targetGroup.members >= ${MAX_GROUP_MEMBERS} then return cjson.encode({status = 'ERROR', code = 'MEMBER_LIMIT_EXCEEDED'}) end
  table.insert(targetGroup.members, member)
  if payload.mode == 'MOVE' then sourceGroup.members = filteredMembers(sourceGroup.members, payload.securityId) end
  return persist({sourceGroup = sourceGroup, targetGroup = targetGroup, member = member})
end

return cjson.encode({status = 'ERROR', code = 'INVALID_PAYLOAD'})
`

export async function getUserStockConfig(userId: string) {
  const response = await execute(userId, 'READ')
  return parseResponseConfig(response)
}

export async function createStockGroup(userId: string, payload: CreateStockGroupPayload, expectedVersion: number) {
  const input = createStockGroupPayloadSchema.parse(payload)
  const response = await execute(userId, 'CREATE_GROUP', { name: input.name.trim() }, expectedVersion, `group_${randomUUID()}`)
  return { config: parseResponseConfig(response), group: response.result?.group }
}

export async function renameStockGroup(userId: string, groupId: string, payload: UpdateStockGroupPayload, expectedVersion: number) {
  const input = updateStockGroupPayloadSchema.parse(payload)
  const response = await execute(userId, 'RENAME_GROUP', { groupId, name: input.name.trim() }, expectedVersion)
  return { config: parseResponseConfig(response), group: response.result?.group }
}

export async function deleteStockGroup(userId: string, groupId: string, expectedVersion: number) {
  const response = await execute(userId, 'DELETE_GROUP', { groupId }, expectedVersion)
  return { config: parseResponseConfig(response), group: response.result?.group }
}

export async function addStockGroupMember(userId: string, groupId: string, payload: AddStockMemberPayload, expectedVersion: number) {
  const input = addStockMemberPayloadSchema.parse(payload)
  const response = await execute(userId, 'ADD_MEMBER', { groupId, member: input }, expectedVersion)
  return { config: parseResponseConfig(response), group: response.result?.group, member: response.result?.member }
}

export async function deleteStockGroupMember(userId: string, groupId: string, securityId: string, expectedVersion: number) {
  const response = await execute(userId, 'DELETE_MEMBER', { groupId, securityId }, expectedVersion)
  return { config: parseResponseConfig(response), group: response.result?.group, member: response.result?.member }
}

export async function transferStockGroupMember(userId: string, groupId: string, securityId: string, payload: TransferStockMemberPayload, expectedVersion: number) {
  const input = transferStockMemberPayloadSchema.parse(payload)
  const response = await execute(userId, 'TRANSFER_MEMBER', { groupId, securityId, ...input }, expectedVersion)
  return {
    config: parseResponseConfig(response),
    sourceGroup: response.result?.sourceGroup,
    targetGroup: response.result?.targetGroup,
    member: response.result?.member
  }
}

export async function updateStockAlerts(userId: string, securityId: string, payload: UpdateStockAlertsPayload, expectedVersion: number) {
  const input = updateStockAlertsPayloadSchema.parse(payload)
  const response = await execute(userId, 'UPDATE_ALERTS', { securityId, rules: input.rules }, expectedVersion)
  return { config: parseResponseConfig(response), alerts: response.result?.alerts ?? null }
}

async function execute(userId: string, operation: Operation, payload: Record<string, unknown> = {}, expectedVersion = 0, generatedGroupId = ''): Promise<ScriptResponse> {
  const key = getUserStockConfigKey(userId)
  const args = [JSON.stringify(createDefaultConfig(userId)), operation, JSON.stringify(payload), String(expectedVersion), new Date().toISOString(), generatedGroupId]

  try {
    const raw = await (getRedisClient() as RedisEvaluator).eval(USER_STOCK_CONFIG_SCRIPT, [key], args)
    const response = parseScriptResponse(raw)
    if (response.status === 'ERROR') throw scriptError(response.code)
    return response
  } catch (error) {
    if (error instanceof ApiResponseError) throw error
    console.error('User stock KV operation failed', { operation, key, error: error instanceof Error ? error.message : String(error) })
    throw new ApiResponseError(500, 'STORAGE_WRITE_FAILED', '用户配置存储暂时不可用')
  }
}

function parseScriptResponse(raw: unknown): ScriptResponse {
  const response = typeof raw === 'string' ? JSON.parse(raw) : raw
  if (!response || typeof response !== 'object' || !('status' in response)) throw new Error('Invalid Redis script response')
  const parsed = response as ScriptResponse
  if (parsed.resultJson) {
    const result = JSON.parse(parsed.resultJson)
    if (!result || typeof result !== 'object') throw new Error('Invalid Redis script result')
    parsed.result = result as Record<string, unknown>
  }
  return parsed
}

function parseConfig(config: unknown): UserStockConfig {
  const parsed = userStockConfigSchema.safeParse(config)
  if (!parsed.success) {
    console.error('Invalid user stock config returned from KV', { issues: parsed.error.issues.map(issue => issue.path.join('.')) })
    throw new ApiResponseError(500, 'STORAGE_WRITE_FAILED', '用户配置存储数据异常')
  }
  return parsed.data
}

function parseResponseConfig(response: ScriptResponse) {
  try {
    return parseConfig(response.configJson ? JSON.parse(response.configJson) : response.config)
  } catch (error) {
    if (error instanceof ApiResponseError) throw error
    console.error('Invalid config JSON returned from KV script', { error: error instanceof Error ? error.message : String(error) })
    throw new ApiResponseError(500, 'STORAGE_WRITE_FAILED', '用户配置存储数据异常')
  }
}

function scriptError(code: ScriptResponse['code']): ApiResponseError {
  const errors: Record<string, ApiResponseError> = {
    CONFIG_VERSION_CONFLICT: new ApiResponseError(409, 'CONFIG_VERSION_CONFLICT', '配置版本已变化，请刷新后重试'),
    GROUP_NOT_FOUND: new ApiResponseError(404, 'GROUP_NOT_FOUND', '分组不存在'),
    SECURITY_NOT_FOUND: new ApiResponseError(404, 'SECURITY_NOT_FOUND', '证券不存在'),
    DUPLICATE_GROUP_NAME: new ApiResponseError(409, 'DUPLICATE_GROUP_NAME', '分组名称已存在，请换一个名称'),
    GROUP_LIMIT_EXCEEDED: new ApiResponseError(422, 'GROUP_LIMIT_EXCEEDED', `最多只能创建 ${MAX_GROUPS_PER_USER} 个分组`),
    MEMBER_LIMIT_EXCEEDED: new ApiResponseError(422, 'MEMBER_LIMIT_EXCEEDED', `证券数量已达到 ${MAX_GROUP_MEMBERS} 只分组上限或 ${MAX_SECURITIES_PER_USER} 只用户上限`),
    INVALID_PAYLOAD: new ApiResponseError(422, 'INVALID_PAYLOAD', '请求参数不合法'),
    INVALID_CONFIG: new ApiResponseError(500, 'STORAGE_WRITE_FAILED', '用户配置存储数据异常')
  }
  return errors[code ?? 'INVALID_CONFIG'] ?? errors.INVALID_CONFIG!
}

function createDefaultConfig(userId: string): UserStockConfig {
  const now = new Date().toISOString()
  return {
    schemaVersion: STOCK_CONFIG_SCHEMA_VERSION,
    configVersion: 1,
    userId,
    updatedAt: now,
    groups: [{ id: DEFAULT_GROUP_ID, name: '默认分组', sortOrder: 0, isDefault: true, members: [] }],
    alerts: {}
  }
}

export function getUserStockConfigKey(userId: string) {
  return `${USER_STOCK_CONFIG_KEY_PREFIX}${sanitizeUserId(userId)}`
}

function sanitizeUserId(userId: string) {
  return userId.replace(/[^a-zA-Z0-9_-]/g, '_')
}

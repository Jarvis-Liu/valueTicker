import type { ApiError, ApiResponse } from '~~/shared/types/api'
import type { AlertRule, SecurityAlerts, SecurityItem, StockGroup, UserStockConfig } from '~~/shared/types/stock'

export class ClientApiError extends Error {
  /** 创建包含服务端错误码的客户端 API 异常。 */
  constructor(public readonly apiError: ApiError) {
    super(apiError.message)
  }
}

export interface CreateStockGroupResult {
  config: UserStockConfig
  group: StockGroup
}

export interface AddStockMemberResult {
  config: UserStockConfig
  group: StockGroup
  member: SecurityItem & { addedAt: string }
}

export interface UpdateStockAlertsResult {
  config: UserStockConfig
  alerts: SecurityAlerts | null
}

export interface SecuritySearchResult {
  items: SecurityItem[]
}

/** 获取当前用户的完整股票配置。 */
export async function fetchStockConfig() {
  return requestApi<UserStockConfig>('/api/stock-config')
}

/** 请求创建股票分组。 */
export async function createStockGroupRequest(name: string, configVersion: number) {
  return requestApi<CreateStockGroupResult>('/api/stock-groups', {
    method: 'POST',
    headers: {
      'If-Match': String(configVersion)
    },
    body: {
      name
    }
  })
}

/** 请求重命名股票分组。 */
export async function renameStockGroupRequest(groupId: string, name: string, configVersion: number) {
  return requestApi<CreateStockGroupResult>(`/api/stock-groups/${encodeURIComponent(groupId)}`, {
    method: 'PATCH',
    headers: {
      'If-Match': String(configVersion)
    },
    body: {
      name
    }
  })
}

/** 请求删除股票分组。 */
export async function deleteStockGroupRequest(groupId: string, configVersion: number) {
  return requestApi<CreateStockGroupResult>(`/api/stock-groups/${encodeURIComponent(groupId)}`, {
    method: 'DELETE',
    headers: {
      'If-Match': String(configVersion)
    }
  })
}

/** 请求搜索证券，服务端会根据 Provider 策略返回统一证券结构。 */
export async function searchSecuritiesRequest(keyword: string) {
  return requestApi<SecuritySearchResult>(`/api/securities/search?q=${encodeURIComponent(keyword)}`)
}

/** 请求将证券添加到指定分组。 */
export async function addStockMemberRequest(groupId: string, security: SecurityItem, configVersion: number) {
  return requestApi<AddStockMemberResult>(`/api/stock-groups/${encodeURIComponent(groupId)}/members`, {
    method: 'POST',
    headers: { 'If-Match': String(configVersion) },
    body: security
  })
}

/** 请求从指定分组移除证券。 */
export async function deleteStockMemberRequest(groupId: string, securityId: string, configVersion: number) {
  return requestApi<AddStockMemberResult>(`/api/stock-groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(securityId)}`, {
    method: 'DELETE',
    headers: { 'If-Match': String(configVersion) }
  })
}

/** 请求移动或复制分组内证券。 */
export async function transferStockMemberRequest(groupId: string, securityId: string, targetGroupId: string, mode: 'MOVE' | 'COPY', configVersion: number) {
  return requestApi<AddStockMemberResult>(`/api/stock-groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(securityId)}`, {
    method: 'POST',
    headers: { 'If-Match': String(configVersion) },
    body: { targetGroupId, mode }
  })
}

/** 保存或清空单只证券的提醒规则配置。 */
export async function updateStockAlertsRequest(securityId: string, rules: AlertRule[], configVersion: number) {
  return requestApi<UpdateStockAlertsResult>(`/api/stock-alerts/${encodeURIComponent(securityId)}`, {
    method: 'PUT',
    headers: { 'If-Match': String(configVersion) },
    body: { rules }
  })
}

/** 发送统一 API 请求并将失败响应转换为 ClientApiError。 */
async function requestApi<T>(url: string, options?: Parameters<typeof $fetch<ApiResponse<T>>>[1]) {
  let response: ApiResponse<T>

  try {
    response = await $fetch<ApiResponse<T>>(url, {
      ...options,
      ignoreResponseError: true
    })
  } catch (error) {
    const maybeResponse = error as { data?: ApiResponse<T>, response?: { _data?: ApiResponse<T> } }
    response = maybeResponse.data ?? maybeResponse.response?._data ?? {
      success: false,
      error: {
        code: 'STORAGE_WRITE_FAILED',
        message: error instanceof Error ? error.message : '请求失败'
      }
    }
  }

  if (!response.success || !response.data) {
    throw new ClientApiError(response.error ?? {
      code: 'STORAGE_WRITE_FAILED',
      message: '请求失败'
    })
  }

  return response.data
}

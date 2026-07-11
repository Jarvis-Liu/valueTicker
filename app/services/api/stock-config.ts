import type { ApiError, ApiResponse } from '~~/shared/types/api'
import type { StockGroup, UserStockConfig } from '~~/shared/types/stock'

export class ClientApiError extends Error {
  constructor(public readonly apiError: ApiError) {
    super(apiError.message)
  }
}

export interface CreateStockGroupResult {
  config: UserStockConfig
  group: StockGroup
}

export async function fetchStockConfig() {
  return requestApi<UserStockConfig>('/api/stock-config')
}

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

export async function deleteStockGroupRequest(groupId: string, configVersion: number) {
  return requestApi<CreateStockGroupResult>(`/api/stock-groups/${encodeURIComponent(groupId)}`, {
    method: 'DELETE',
    headers: {
      'If-Match': String(configVersion)
    }
  })
}

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

export type ApiErrorCode
  = | 'UNAUTHORIZED'
    | 'CONFIG_NOT_FOUND'
    | 'GROUP_NOT_FOUND'
    | 'SECURITY_NOT_FOUND'
    | 'DUPLICATE_GROUP_NAME'
    | 'CONFIG_VERSION_CONFLICT'
    | 'GROUP_LIMIT_EXCEEDED'
    | 'MEMBER_LIMIT_EXCEEDED'
    | 'INVALID_PAYLOAD'
    | 'STORAGE_WRITE_FAILED'
    | 'SECURITY_SEARCH_FAILED'

export interface ApiError {
  code: ApiErrorCode
  message: string
  details?: unknown
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: ApiError
  configVersion?: number
}

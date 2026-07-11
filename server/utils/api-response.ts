import type { H3Event } from 'h3'
import { getHeader, setResponseStatus } from 'h3'
import type { ApiErrorCode, ApiResponse } from '~~/shared/types/api'

export class ApiResponseError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(message)
  }
}

export function apiSuccess<T>(data: T, configVersion?: number): ApiResponse<T> {
  return {
    success: true,
    data,
    configVersion
  }
}

export function apiFailure<T = never>(event: H3Event, error: ApiResponseError): ApiResponse<T> {
  setResponseStatus(event, error.statusCode)

  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      details: error.details
    }
  }
}

export function parseIfMatch(event: H3Event): number {
  const value = getHeader(event, 'if-match')
  const version = Number(String(value ?? '').replaceAll('"', ''))

  if (!Number.isInteger(version) || version <= 0) {
    throw new ApiResponseError(422, 'INVALID_PAYLOAD', '缺少有效的 If-Match 配置版本')
  }

  return version
}

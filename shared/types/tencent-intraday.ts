/** 腾讯分时接口的原始响应；解析与 241 分钟时间轴清洗仍由前端行情适配器负责。 */
export interface TencentIntradayResponse {
  code: number
  msg?: string
  data?: Record<string, TencentIntradaySecurityData>
}

export interface TencentIntradaySecurityData {
  date?: string
  data?: {
    date?: string
    data?: string[]
  }
  qt?: Record<string, string[]>
}

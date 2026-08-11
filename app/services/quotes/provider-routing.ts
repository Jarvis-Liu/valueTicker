import type { SecurityItem } from '~~/shared/types/stock'
import type { QuoteProvider, QuoteProviderMode } from './types'

/**
 * 将用户选择的数据源模式解析为单只证券实际使用的 Provider。
 * 默认混合延续低风险策略：北交所与韩国 KOSPI 走东财，其余走腾讯。
 */
export function resolveQuoteProvider(security: SecurityItem, mode: QuoteProviderMode): QuoteProvider {
  if (mode !== 'MIXED') return mode

  return security.exchange === 'BSE' || security.providerSymbols.eastmoney?.startsWith('100.') === true
    ? 'EASTMONEY'
    : 'TENCENT'
}

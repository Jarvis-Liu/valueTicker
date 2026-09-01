import type { AlertRuleType } from '~~/shared/types/stock'

/** 目标值辅助换算结果，供提醒规则表单展示。 */
export interface AlertTargetConversion {
  /** 已格式化的带符号数值和单位。 */
  text: string
  /** 换算结果方向，用于映射系统语义色。 */
  direction: 'POSITIVE' | 'NEGATIVE' | 'FLAT'
}

/**
 * 将提醒目标值换算为另一种便于理解的口径：
 * - 价格规则：计算目标价格相对昨收的涨跌幅；
 * - 涨跌幅规则：计算该百分比相对昨收对应的涨跌额。
 *
 * @param type 提醒规则类型。
 * @param targetValue 用户输入的目标值；跌幅规则仍按正数幅度输入。
 * @param previousClose 昨日收盘价。
 * @returns 最多三位小数的展示结果；输入无效时返回 null。
 */
export function convertAlertTarget(type: AlertRuleType, targetValue: number, previousClose: number): AlertTargetConversion | null {
  if (!Number.isFinite(targetValue) || targetValue <= 0) return null
  if (!Number.isFinite(previousClose) || previousClose <= 0) return null

  const isPriceRule = type === 'PRICE_UPPER' || type === 'PRICE_LOWER'
  const convertedValue = isPriceRule
    ? (targetValue - previousClose) / previousClose * 100
    : previousClose * (type === 'CHANGE_LOWER' ? -targetValue : targetValue) / 100
  const unit = isPriceRule ? '%' : '元'

  return formatConversion(convertedValue, unit)
}

/** 将换算结果四舍五入到最多三位小数，并移除无意义的尾随零。 */
function formatConversion(value: number, unit: string): AlertTargetConversion {
  const rounded = Number(value.toFixed(3))
  const direction = rounded > 0 ? 'POSITIVE' : rounded < 0 ? 'NEGATIVE' : 'FLAT'
  const sign = rounded > 0 ? '+' : rounded < 0 ? '-' : ''

  return {
    text: `${sign}${Math.abs(rounded)}${unit}`,
    direction
  }
}

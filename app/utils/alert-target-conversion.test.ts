import { describe, expect, it } from 'vitest'
import { convertAlertTarget } from './alert-target-conversion'

describe('alert target conversion', () => {
  it('converts target prices to signed percentages', () => {
    expect(convertAlertTarget('PRICE_UPPER', 10.5, 10)).toEqual({ text: '+5%', direction: 'POSITIVE' })
    expect(convertAlertTarget('PRICE_LOWER', 9.7625, 10)).toEqual({ text: '-2.375%', direction: 'NEGATIVE' })
  })

  it('uses the actual price relation instead of forcing the price-rule direction', () => {
    expect(convertAlertTarget('PRICE_UPPER', 9.5, 10)).toEqual({ text: '-5%', direction: 'NEGATIVE' })
    expect(convertAlertTarget('PRICE_LOWER', 10.5, 10)).toEqual({ text: '+5%', direction: 'POSITIVE' })
  })

  it('converts change percentages to signed price differences', () => {
    expect(convertAlertTarget('CHANGE_UPPER', 5, 10)).toEqual({ text: '+0.5元', direction: 'POSITIVE' })
    expect(convertAlertTarget('CHANGE_LOWER', 12.375, 10)).toEqual({ text: '-1.238元', direction: 'NEGATIVE' })
  })

  it('shows at most three decimals and normalizes zero', () => {
    expect(convertAlertTarget('PRICE_UPPER', 10, 10)).toEqual({ text: '0%', direction: 'FLAT' })
    expect(convertAlertTarget('CHANGE_UPPER', 1.23456, 10)).toEqual({ text: '+0.123元', direction: 'POSITIVE' })
  })

  it('returns null for invalid target values or previous closes', () => {
    expect(convertAlertTarget('PRICE_UPPER', 0, 10)).toBeNull()
    expect(convertAlertTarget('PRICE_UPPER', Number.NaN, 10)).toBeNull()
    expect(convertAlertTarget('CHANGE_UPPER', 5, 0)).toBeNull()
    expect(convertAlertTarget('CHANGE_UPPER', 5, Number.NaN)).toBeNull()
  })
})

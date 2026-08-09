import { describe, expect, it } from 'vitest'
import { parseEastmoneyFundFlowPoint, toEastmoneySecid } from './eastmoney-fund-flow'

describe('Eastmoney fund flow parser', () => {
  it('maps a cumulative minute row to the common fund flow point', () => {
    expect(parseEastmoneyFundFlowPoint(
      '2026-08-07 09:31,183070231.0,-140647.0,-182929591.0,-21438933.0,204509164.0'
    )).toEqual({
      time: '09:31',
      price: null,
      mainNetInflow: 183070231,
      retailNetInflow: -183070238,
      superNetInflow: 204509164,
      bigNetInflow: -21438933,
      normalNetInflow: -182929591,
      smallNetInflow: -140647,
      mainInflow: null,
      mainOutflow: null
    })
  })

  it('drops malformed rows', () => {
    expect(parseEastmoneyFundFlowPoint('2026-08-07 09:31,--')).toBeNull()
  })

  it('maps Shanghai, Shenzhen and Beijing symbols to Eastmoney secids', () => {
    expect(toEastmoneySecid('sh601318')).toBe('1.601318')
    expect(toEastmoneySecid('sz300502')).toBe('0.300502')
    expect(toEastmoneySecid('bj920438')).toBe('0.920438')
  })
})

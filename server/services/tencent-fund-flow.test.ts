import { describe, expect, it } from 'vitest'
import { parseFundFlowPoint } from './tencent-fund-flow'

describe('Tencent fund flow parser', () => {
  it('converts a raw minute point into chart data', () => {
    expect(parseFundFlowPoint({
      time: '202608070930',
      Price: '439.98',
      MainNetInflow: '126535200',
      RetailNetInflow: '-126535200',
      SuperNetInflow: '80125000',
      BigNetInflow: '46410200',
      NormalNetInflow: '-38200000',
      SmallNetInflow: '-88335200',
      MainInflow: '210000000',
      MainOutflow: '83464800'
    })).toEqual({
      time: '09:30',
      price: 439.98,
      mainNetInflow: 126535200,
      retailNetInflow: -126535200,
      superNetInflow: 80125000,
      bigNetInflow: 46410200,
      normalNetInflow: -38200000,
      smallNetInflow: -88335200,
      mainInflow: 210000000,
      mainOutflow: 83464800
    })
  })

  it('drops a point with an invalid time or required value', () => {
    expect(parseFundFlowPoint({
      time: '09:30',
      Price: '439.98',
      MainNetInflow: '100'
    })).toBeNull()

    expect(parseFundFlowPoint({
      time: '202608070930',
      Price: '--',
      MainNetInflow: '100'
    })).toBeNull()
  })
})

const EASTMONEY_KLINE_ENDPOINT = 'https://push2his.eastmoney.com/api/qt/stock/kline/get'
const EASTMONEY_TOKEN = '7eea3edcaed734bea9cbfc24409ed989'
const FIELDS1 = 'f1,f2,f3,f4,f5,f6'
const FIELDS2 = 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f116'

/** 临时测试代理：校验 stock-sdk 日 K 参数后，由 Nuxt 服务端携带东财 Cookie 请求。 */
export default defineEventHandler(async (event) => {
  const cookie = String(useRuntimeConfig(event).eastmoneyCookie ?? '').trim()
  if (!cookie) {
    throw createError({
      statusCode: 500,
      statusMessage: 'EASTMONEY_COOKIE 未配置'
    })
  }

  const query = getQuery(event)
  const secid = readQueryValue(query.secid)
  const klt = readQueryValue(query.klt)
  const fqt = readQueryValue(query.fqt)
  const beg = readQueryValue(query.beg)
  const end = readQueryValue(query.end)

  if (!/^(?:0|1)\.\d{6}$/.test(secid)) throwInvalidParameter('secid')
  if (!/^(?:101|102|103)$/.test(klt)) throwInvalidParameter('klt')
  if (!/^[012]$/.test(fqt)) throwInvalidParameter('fqt')
  if (!/^\d{8}$/.test(beg)) throwInvalidParameter('beg')
  if (!/^\d{8}$/.test(end)) throwInvalidParameter('end')

  const url = new URL(EASTMONEY_KLINE_ENDPOINT)
  url.searchParams.set('fields1', FIELDS1)
  url.searchParams.set('fields2', FIELDS2)
  url.searchParams.set('ut', EASTMONEY_TOKEN)
  url.searchParams.set('klt', klt)
  url.searchParams.set('fqt', fqt)
  url.searchParams.set('secid', secid)
  url.searchParams.set('beg', beg)
  url.searchParams.set('end', end)

  const response = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
    headers: {
      'accept': 'application/json,text/plain,*/*',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'cookie': cookie,
      'referer': 'https://quote.eastmoney.com/',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36'
    }
  })

  const body = await response.text()
  if (!response.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: `东财接口请求失败：HTTP ${response.status}`,
      data: body.slice(0, 500)
    })
  }

  try {
    return JSON.parse(body)
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: '东财接口未返回有效 JSON',
      data: body.slice(0, 500)
    })
  }
})

function readQueryValue(value: unknown) {
  const rawValue = Array.isArray(value) ? value[0] : value
  return typeof rawValue === 'string' ? rawValue.trim() : ''
}

function throwInvalidParameter(name: string): never {
  throw createError({
    statusCode: 422,
    statusMessage: `无效的东财日 K 参数：${name}`
  })
}

export default {
  async fetch(request, env, ctx) {
    // 处理 OPTIONS 预检请求（解决前端跨域限制）
    if (request.method === "OPTIONS") {
      return makeCorsResponse(null, 204);
    }

    const url = new URL(request.url);
    const pathname = url.pathname;
    const searchParams = url.search; // 自动读取上游传进来的完整 Query 参数

    try {
      // -------------------------------------------------------------
      // 1. 东方财富 K 线代理接口 (/eastmoney/kline)
      // 示例: /eastmoney/kline?fields1=...&secid=1.688126&klt=101...
      // -------------------------------------------------------------
      if (pathname === "/eastmoney/kline") {
        const targetUrl = `https://push2his.eastmoney.com/api/qt/stock/kline/get${searchParams}`;

        // 从环境变量读取 EASTMONEY_COOKIE；若未配置则回退到基础设备指纹
        const cookie = env.EASTMONEY_COOKIE || "qgqp_b_id=238b4707cd51bc3d76d8aea0feec20ec; st_pvi=45244368155035;";

        const response = await fetch(targetUrl, {
          method: "GET",
          headers: {
            'accept': 'application/json,text/plain,*/*',
            'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
            "User-Agent": 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
            "Referer": "https://quote.eastmoney.com/",
            "Cookie": cookie,
          },
        });

        return makeCorsResponse(await response.text());
      }

      // -------------------------------------------------------------
      // 2. 腾讯财经 分时数据代理接口 (/qq/minute)
      // 示例: /qq/minute?code=sz001309
      // -------------------------------------------------------------
      if (pathname === "/qq/minute") {
        const targetUrl = `https://web.ifzq.gtimg.cn/appstock/app/minute/query${searchParams}`;

        const response = await fetch(targetUrl, {
          method: "GET",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://finance.qq.com/",
            // 腾讯接口不传 Cookie
          },
        });

        return makeCorsResponse(await response.text());
      }

      // 404 路由未匹配
      return new Response(JSON.stringify({ code: 404, message: "Route Not Found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });

    } catch (err) {
      return new Response(JSON.stringify({ code: 500, error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

/**
 * 统一跨域响应函数
 */
function makeCorsResponse(data, status = 200) {
  return new Response(data, {
    status: status,
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

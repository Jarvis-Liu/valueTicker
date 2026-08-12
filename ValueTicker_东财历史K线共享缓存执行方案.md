# ValueTicker 东财历史 K 线共享缓存执行方案

## 1. 文档目的

本文档用于指导 ValueTicker 将东方财富历史日 K 请求迁移为“浏览器本地缓存 + Nuxt 服务端 + Upstash Redis 共享缓存 + Cloudflare Worker/东财上游”的统一访问链路。

目标是在不改变筹码分布、技术指标和技术信号业务口径的前提下：

- 减少浏览器和不同用户对东方财富的重复请求；
- 让同一证券的历史 K 线由所有用户共享；
- 避免缓存过期瞬间产生并发回源；
- 在东方财富或 Cloudflare Worker 暂时不可用时继续提供最近一次有效数据；
- 控制 Upstash Redis 免费版的存储、命令和带宽消耗。

本方案遵循《股票实时监测与提醒系统_PRD_V2_精简版_Nuxt技术方案》和《ValueTicker_五阶段开发执行计划》的服务端代理、统一数据结构、异常降级和低频研究数据不进入实时轮询原则。

## 2. 当前基线

### 2.1 当前日 K 用途

当前 `app/services/chips/stock-sdk-chips.ts` 通过：

```ts
sdk.kline.withIndicators(symbol, options)
```

从东财获取日 K，并基于同一批数据生成：

- 最近 60 个交易日的筹码分布；
- 收盘价趋势；
- MA、MACD、KDJ、RSI、BOLL、SAR 等指标；
- 金叉、死叉等技术信号。

这部分属于低频研究数据，不进入 5 秒行情轮询，也不参与提醒判断。

### 2.2 当前浏览器缓存

`useChipDistribution` 已有约 30 分钟的本地缓存，但缓存仅在当前浏览器生效。不同用户、不同设备或本地缓存过期后，仍可能重复访问东财。

### 2.3 当前 Redis

项目已经通过 `server/utils/redis.ts` 接入 Upstash Redis，并存在两类数据：

- 按用户隔离的自选分组和提醒配置；
- 不区分用户、按交易日共享的三市成交额快照。

历史 K 线应沿用第二种全局共享模式，不携带用户 ID。

## 3. 目标调用链

```text
用户打开筹码趋势等需要历史 K 线的功能
                  │
                  ▼
       浏览器读取本地 30 分钟缓存
          │                    │
       有效直接使用          无记录或过期
                               │
                               ▼
             GET /api/quotes/kline/eastmoney
                               │
                               ▼
                    读取 Redis 共享缓存
          ┌────────────────────┼────────────────────┐
          │                    │                    │
       缓存有效             缓存过期             无缓存
          │                    │                    │
       返回 HIT          尝试获取更新锁        尝试获取更新锁
                               │                    │
                               └────────┬───────────┘
                                        ▼
                             CF Worker → 东方财富
                               │                 │
                            成功更新           请求失败
                               │                 │
                         写 Redis 并返回    有旧值则返回 STALE
                                             无旧值则报错
```

## 4. 缓存口径

### 4.1 第一版支持范围

- 市场：A 股；
- 周期：日 K，`klt=101`；
- 复权：前复权，`fqt=1`；
- 数据源：东方财富；
- 默认起始日期：满足筹码 120 日预热和近 60 日展示所需的动态起始日期；
- 结束日期：使用固定远期日期或服务端当天日期，由服务端统一生成；
- ETF、指数等当前不支持筹码分布的品种保持现有降级表现。

如果测试阶段必须保持固定 `beg=20250207&end=20500101`，应将起止口径纳入缓存版本或键名，避免未来改动后读取到不兼容数据。

### 4.2 Redis 键

不建议仅使用六位股票代码。缓存键必须包含数据源、市场标识、周期、复权口径和版本：

```text
value-ticker:kline:eastmoney:v1:{secid}:daily:qfq
```

示例：

```text
value-ticker:kline:eastmoney:v1:1.603259:daily:qfq
```

更新锁：

```text
value-ticker:kline-lock:eastmoney:v1:1.603259:daily:qfq
```

`secid` 比裸股票代码更安全，因为它同时包含交易所信息，可避免沪深北代码口径冲突。

### 4.3 Redis 文档结构

```ts
interface EastmoneyKlineCacheDocument {
  schemaVersion: 1
  secid: string
  symbol: string
  period: 'daily'
  adjust: 'qfq'
  beginDate: string
  endDate: string
  source: 'EASTMONEY'
  payload: EastmoneyKlineResponse
  sourceUpdatedAt: string | null
  fetchedAt: string
  expiresAt: string
}
```

说明：

- `payload` 保存东财原始有效响应，便于筹码、指标和未来其他功能共享；
- `fetchedAt` 是本次真实回源成功的时间；
- `expiresAt` 是这份数据的业务有效期；
- Redis 命中时不得重新生成 `fetchedAt` 或延长 `expiresAt`；
- `sourceUpdatedAt` 能从上游数据推导时填写，无法可靠推导时允许为 `null`。

### 4.4 物理保留时间与业务有效期

业务过期不等于立即删除。

- `expiresAt`：决定是否需要尝试回源更新；
- Redis TTL：建议设置 7～30 天，仅用于清理长期无人访问的证券；
- 已超过 `expiresAt` 但未超过 Redis TTL 的数据可以在上游失败时作为降级数据返回。

第一版业务有效期统一设为真实回源成功后的 30 分钟。后续可结合交易日历优化：

| 市场阶段 | 建议有效期 |
| --- | --- |
| 连续竞价 | 15～30 分钟 |
| 午间休市 | 至 13:00 附近 |
| 收盘且当日日 K 已稳定 | 至下一交易日 |
| 周末或法定休市 | 至下一交易日 |

## 5. 正式 API 设计

### 5.1 请求

```http
GET /api/quotes/kline/eastmoney?secid=1.603259&klt=101&fqt=1
```

第一版也可以只接受 `secid`，并由服务端固定其他参数，减少客户端构造任意上游请求的风险。

服务端必须校验：

- `secid` 仅允许已支持市场的合法格式；
- `klt` 第一版仅允许 `101`；
- `fqt` 第一版仅允许 `1`；
- 不接受客户端透传 `fields`、`ut`、上游地址或 Cookie；
- 起止日期由服务端决定。

### 5.2 响应

沿用项目统一 `ApiResponse<T>`：

```ts
interface EastmoneyKlineApiResult {
  secid: string
  payload: EastmoneyKlineResponse
  fetchedAt: string
  expiresAt: string
  cacheStatus: 'HIT' | 'MISS' | 'REFRESHED' | 'STALE'
  stale: boolean
  warning?: string
}
```

状态含义：

| 状态 | 含义 |
| --- | --- |
| `HIT` | Redis 数据仍在业务有效期内 |
| `MISS` | Redis 无记录，本次成功回源并写入 |
| `REFRESHED` | Redis 旧记录已过期，本次成功刷新 |
| `STALE` | 上游更新失败，返回 Redis 中最近一次旧数据 |

HTTP 行为：

- `HIT/MISS/REFRESHED/STALE` 均可返回 HTTP 200；
- `STALE` 必须通过字段明确提示，不能伪装成新数据；
- 参数错误返回 422；
- Redis 无记录且上游请求失败返回 502；
- 上游超时返回 504 或项目统一的上游超时错误。

## 6. 服务端缓存流程

### 6.1 正常读取

1. 根据 `secid + period + adjust + schemaVersion` 生成缓存键；
2. 从 Redis 读取缓存文档；
3. 校验缓存结构和版本；
4. 若 `Date.now() < expiresAt`，直接返回 `HIT`；
5. 不修改原缓存的时间字段。

### 6.2 无缓存或缓存过期

1. 使用 Redis `SET lockKey requestId NX EX 15` 获取证券级更新锁；
2. 获得锁后再次读取缓存，防止等待过程中其他请求已经完成更新；
3. 若仍需更新，通过 `CLOUDFLARE_WORKER_URL` 的东财 K 线路由请求真实上游；
4. 校验 HTTP 状态、JSON、东财 `rc` 和 K 线数组；
5. 生成新的 `fetchedAt/expiresAt`；
6. 写入 Redis，设置 7～30 天物理 TTL；
7. 使用带请求 ID 校验的原子方式释放锁；
8. 根据此前是否存在旧记录返回 `MISS` 或 `REFRESHED`。

### 6.3 未取得更新锁

- Redis 有旧数据：立即返回 `STALE`，不阻塞用户，也不回源；
- Redis 完全无数据：等待 200～500ms 后重读 Redis，可进行有限次数短轮询；
- 等待后仍无数据：返回明确的“数据正在初始化”或上游暂不可用错误；
- 禁止所有等待请求同时穿透至东财。

### 6.4 上游失败

- 存在旧缓存：返回 `STALE`，保留旧数据，不覆盖 Redis；
- 不存在旧缓存：返回错误；
- 记录结构化服务端日志，但不得输出 Worker 密钥、Redis token、Cookie 或完整敏感请求头；
- 不对东财进行无间隔连续重试。

## 7. 浏览器本地缓存流程

### 7.1 本地缓存结构

浏览器缓存必须保存后端返回的原始时间：

```ts
interface LocalKlineCacheEntry {
  result: EastmoneyKlineApiResult
  lastAccessedAt: string
}
```

读取规则：

```ts
Date.now() < new Date(entry.result.expiresAt).getTime()
```

禁止在 Redis `HIT` 后按浏览器收到响应的时间重新计算 30 分钟，否则两层缓存会让数据最多接近 60 分钟不更新。

### 7.2 本地缓存容量

- 只缓存用户实际访问过的证券；
- 建议最多保留最近 30～50 只；
- 通过 `lastAccessedAt` 做 LRU 清理；
- 第一版可沿用现有存储机制；
- 若需要长期保存大量完整日 K，迁移至 IndexedDB，避免触碰 `localStorage` 常见容量限制。

### 7.3 前端并发合并

保留或扩展当前 `pendingRequests` 思路：同一浏览器中，同一证券同时触发的多个组件只共享一个 Promise，不重复请求正式 API。

## 8. stock-sdk 与筹码模块迁移

现有 `sdk.kline.withIndicators()` 同时负责网络请求和指标计算。接入服务端缓存后，不能继续让该方法直接访问东财，否则会绕过 Nuxt API 和 Redis。

迁移步骤：

1. 新增前端历史 K API service，调用 `/api/quotes/kline/eastmoney`；
2. 将东财原始 `klines` 字符串转换为项目统一日 K 数据结构；
3. 使用 `stock-sdk` 提供的纯计算方法或项目适配器计算技术指标；
4. 继续使用 `calcChipDistribution` 和 `calcSignals`；
5. 保持当前 120 日筹码计算窗口、60 日展示区间和技术信号口径不变；
6. `useChipDistribution` 继续负责本地缓存、加载状态和错误展示，但缓存有效期改为后端下发的 `expiresAt`；
7. ETF、指数和不支持的证券不得发起历史 K 请求。

迁移完成后的原则是：

```text
网络获取由 Nuxt API 统一负责；指标、筹码和信号计算由前端复用现有逻辑负责。
```

## 9. Redis 容量与命令控制

以测试接口约 370 根日 K、约 29KB 原始响应估算：

- 100 只约 3MB；
- 1,000 只约 30MB；
- 5,000 只约 150MB，且数据会随时间增长。

Upstash 免费版当前需要重点关注存储、月命令数和月带宽。执行要求：

- 仅按需缓存，不一次性预热全部 A 股；
- 浏览器 30 分钟缓存优先，减少 Redis GET；
- 同一浏览器请求合并；
- Redis 使用单次 `GET` 读取完整文档；
- 锁仅在缓存过期或缺失时使用；
- 定期监控 Redis 命令量、存储量和带宽；
- 达到免费额度约 70% 时预警，达到 80% 前评估升级或缩短历史范围。

建议监控指标：

- `HIT/MISS/REFRESHED/STALE` 数量与命中率；
- 上游成功率与耗时；
- 每日 Redis 命令数和带宽；
- 缓存证券数量和总存储；
- 更新锁竞争次数；
- 返回旧数据的持续时长。

## 10. 文件与模块规划

建议新增：

```text
shared/types/eastmoney-kline.ts
server/services/eastmoney-kline-cache.ts
server/api/quotes/kline/eastmoney.get.ts
app/services/api/eastmoney-kline.ts
app/services/quotes/eastmoney-kline-normalizer.ts
```

建议修改：

```text
server/services/cloudflare-market-proxy.ts
app/services/chips/stock-sdk-chips.ts
app/composables/useChipDistribution.ts
shared/types/api.ts
```

对应测试：

```text
server/services/eastmoney-kline-cache.test.ts
server/api/quotes/kline/eastmoney.get.test.ts
app/services/api/eastmoney-kline.test.ts
app/services/quotes/eastmoney-kline-normalizer.test.ts
```

所有正式接口和缓存服务必须用注释明确用途、数据源、缓存口径和是否属于用户共享数据。

## 11. 分阶段执行步骤

### 阶段一：服务端共享缓存

1. 定义共享类型和缓存键生成函数；
2. 实现 Redis 读取、结构校验和业务过期判断；
3. 实现证券级更新锁和安全释放；
4. 复用 Cloudflare Worker 东财 K 线路由完成回源；
5. 实现旧缓存降级；
6. 增加正式 Nuxt API；
7. 编写服务端单元测试。

### 阶段二：前端 API 与本地缓存

1. 新增正式历史 K API client；
2. 将本地缓存改为读取后端 `expiresAt`；
3. 增加同证券请求合并；
4. 增加 LRU 数量限制；
5. 区分 `STALE` 与正常新鲜数据，必要时在调试日志或界面显示非阻断提示。

### 阶段三：筹码与技术信号迁移

1. 将 `stock-sdk.kline.withIndicators()` 的网络职责替换为正式 API；
2. 解析统一 K 线结构；
3. 恢复指标、筹码和信号计算；
4. 对比迁移前后同一证券、同一日期的结果；
5. 确认 ETF、指数等不支持品种不会请求接口。

### 阶段四：联调与观察

1. 首次访问验证 `MISS`；
2. 30 分钟内跨用户访问验证 `HIT`；
3. 缓存过期后验证 `REFRESHED`；
4. 模拟 Worker/东财故障验证 `STALE`；
5. 并发请求同一证券验证仅一次回源；
6. 观察 Redis 命令量、带宽和存储增长；
7. 稳定后移除不再使用的浏览器直连东财路径。

## 12. 测试清单

### 12.1 缓存行为

- Redis 无记录时回源一次、写入并返回 `MISS`；
- Redis 有效时不回源并返回 `HIT`；
- Redis 过期时成功更新并返回 `REFRESHED`；
- Redis 过期且上游失败时返回 `STALE`；
- Redis 无记录且上游失败时返回明确错误；
- Redis 中的错误版本或损坏文档不会作为有效数据返回。

### 12.2 并发行为

- 多个用户同时首次查询股票 A 时仅一次真实回源；
- 未获得锁但存在旧数据时立即返回旧数据；
- 未获得锁且无旧数据时进行有限等待，不产生请求风暴；
- 锁过期后系统能够自行恢复；
- 一个请求不能误删另一个请求持有的锁。

### 12.3 前端行为

- 本地缓存有效时不请求后端；
- 本地缓存依据后端 `expiresAt` 过期；
- Redis `HIT` 不会把本地有效期再延长 30 分钟；
- 相同证券的并发组件请求被合并；
- 超过缓存数量后按 LRU 清理；
- `STALE` 数据仍能生成筹码、指标和信号；
- 缓存迁移前后同一输入的计算结果保持一致。

### 12.4 安全与异常

- 非法 `secid/klt/fqt` 返回 422；
- 客户端不能指定任意上游 URL；
- 日志不包含 Redis token、Worker 密钥或 Cookie；
- Redis 异常不会触发无限东财重试；
- 请求超时能正确结束并释放资源。

## 13. 验收标准

- 同一证券在共享缓存有效期内，无论多少用户访问，均不重复请求东财；
- 同一浏览器在本地缓存有效期内不读取 Redis；
- 缓存过期时，同一证券的并发请求最多产生一次真实回源；
- 上游不可用且 Redis 有历史数据时，筹码趋势仍可打开；
- 前后端严格共享同一 `expiresAt`，不存在两层缓存叠加延期；
- 筹码分布、价格趋势和技术信号与迁移前计算结果一致；
- 历史 K 请求不进入行情轮询和提醒流程；
- 所有新增测试通过，`typecheck` 通过，相关文件 Lint 通过；
- 上线观察期内 Redis 存储、命令量和带宽处于套餐安全范围。

## 14. 回滚方案

在迁移阶段保留旧的 `stock-sdk` 请求实现，通过内部开关控制数据获取路径：

```text
SERVER_KLINE_CACHE_ENABLED=true
```

若正式 API、Redis 或数据解析出现不可接受的问题，可临时切回旧路径。回滚只影响历史 K 获取，不影响实时行情轮询、提醒判断、分组配置和成交额快照。

稳定运行并完成数据一致性验证后，再删除旧的浏览器直连东财代码和临时开关。

# 股票实时监测与提醒系统 PRD V2（精简版 Nuxt 技术方案）

# 项目名：ValueTicker

> 文档版本：V2.0  
> 技术栈：Nuxt 4、Vue 3、Nitro、TypeScript、Web Worker、JSON 文件持久化  
> 产品范围：A 股及场内 ETF 的分组管理、前端实时行情轮询、价格与涨跌幅提醒  
> 核心约束：后端不提供 SSE、WebSocket、长轮询或行情转发；行情公开 API 由浏览器直接请求  
> 文档状态：可进入技术评审、开发拆分与测试验收

---

# 1. 方案结论

V2 采用“后端轻存储、前端重逻辑”的架构：

```text
Nuxt 页面/UI
  ├─ 分组、股票、提醒配置 CRUD ──> Nitro API ──> 用户 JSON 文件
  └─ 行情监测控制器
       ├─ Web Worker：定时、请求、解析、阈值计算
       ├─ Provider Adapter：腾讯 / 新浪 / 东方财富
       ├─ BroadcastChannel：多标签页同步
       └─ Notification + 站内提醒
```

后端只负责：

1. 校验登录用户；
2. 读取和写入用户配置 JSON；
3. 完成分组、分组成员、提醒规则的增删改查；
4. 保证文件写入原子性、用户隔离和数据结构合法性。

后端不负责：

- 行情轮询；
- 行情接口代理；
- SSE、WebSocket 或长轮询；
- 阈值计算；
- 提醒触发；
- 证券搜索服务；
- 交易日实时推送。

---

# 2. 产品目标与边界

## 2.1 产品目标

用户可以：

- 创建和管理股票分组；
- 在分组中添加、移动、复制、删除股票；
- 查看分组股票的最新行情；
- 为单只股票设置涨跌幅和价格提醒；
- 刷新页面后恢复分组及提醒配置；
- 在网页保持运行期间收到浏览器通知或站内提醒。

## 2.2 明确边界

V2 不承诺页面关闭、浏览器进程退出、设备休眠后的持续监测。

浏览器会对后台标签页、低电量模式、设备休眠和被冻结页面实施调度限制。技术方案只能降低漏轮询概率，不能完全绕过浏览器节能策略。产品页面必须固定展示：

> 监测依赖当前浏览器页面。关闭页面、设备休眠或浏览器冻结后台页面后，提醒可能停止；回到页面时系统会自动补拉最新行情并恢复监测。

严禁通过静音音频循环、Canvas 空转、高频 DOM 操作等方式规避浏览器节能策略。

---

# 3. 功能范围

## 3.1 P0 功能

- 登录用户配置读取；
- 默认分组；
- 分组新增、重命名、删除、排序；
- 股票添加、删除、移动、复制；
- 腾讯、新浪、东财行情适配；
- 行情表格展示；
- “创 / 科 / 北”标签；
- 四类提醒规则；
- Web Worker 轮询和阈值判断；
- 浏览器通知和站内提醒；
- JSON 文件持久化；
- 多标签页只保留一个轮询主实例。

## 3.2 暂不包含

- 云端持续监测；
- 行情服务端转发；
- 短信、微信、邮件提醒；
- 自动交易；
- Level-2 行情；
- 港股、美股、期货、期权；
- 由后端维护完整证券主数据。

---

# 4. 页面信息架构

## 4.1 顶部状态栏

展示：

- 当前监测状态；
- 当前使用的数据源；
- 最近一次成功更新时间；
- 页面前台/后台状态；
- 通知权限状态；
- 手动刷新；
- 暂停/继续监测。

状态枚举：

```typescript
type MonitorStatus =
  | 'RUNNING'
  | 'BACKGROUND'
  | 'PAUSED'
  | 'MARKET_CLOSED'
  | 'STALE'
  | 'ERROR';
```

## 4.2 左侧分组栏

- “全部”为系统视图，不落库；
- 新用户自动创建“默认分组”；
- 默认分组不可删除，可重命名；
- 支持拖拽排序；
- 删除非默认分组前二次确认；
- 删除分组不删除股票提醒规则，除非该股票已不属于任何分组，可提示用户选择是否清理孤立提醒。

## 4.3 行情表格

字段：

| 字段 | 说明 |
|---|---|
| 证券名称 | 名称后显示“创 / 科 / 北”标签 |
| 证券代码 | 6 位代码 |
| 最新价 | 按证券精度显示 |
| 涨跌额 | 当前价 - 昨收 |
| 涨跌幅 | `(当前价 - 昨收) / 昨收 × 100%` |
| 今开/最高/最低/昨收 | 行情基础字段 |
| 更新时间 | 供应商时间优先，否则使用客户端接收时间 |
| 数据状态 | 正常、延迟、停牌、缺失、异常 |
| 提醒状态 | 已开启规则数量 |
| 操作 | 设置提醒、移动、复制、删除 |

---

# 5. 证券标识与板块标签

## 5.1 内部标识

统一使用：

```text
{exchange}:{code}
```

示例：

```text
SSE:600519
SZSE:000001
SZSE:300750
SSE:688981
BSE:920xxx
SZSE:159915
```

## 5.2 数据结构

```typescript
interface SecurityItem {
  securityId: string;
  exchange: 'SSE' | 'SZSE' | 'BSE';
  code: string;
  name: string;
  securityType: 'STOCK' | 'ETF' | 'UNKNOWN';
  board: 'MAIN' | 'GEM' | 'STAR' | 'BSE' | 'ETF' | 'UNKNOWN';
  boardLabel: '' | '创' | '科' | '北';
  pricePrecision: 2 | 3;
  providerSymbols: {
    tencent?: string;
    sina?: string;
    eastmoney?: string;
  };
}
```

## 5.3 标签判定

优先级：

1. 已保存的 `board` 字段；
2. 当前行情供应商返回的市场信息；
3. 前端代码规则兜底；
4. 无法确认时不展示标签，并记录诊断日志。

前端兜底规则至少包括：

- `SZSE:300xxx`：创业板，显示“创”；
- `SSE:688xxx`：科创板，显示“科”；
- `BSE:*`：北交所，显示“北”；
- ETF 不显示“创 / 科 / 北”。

供应商代码转换必须由 Adapter 完成，禁止把所有 `15xxxx` 代码转换成上海市场。

---

# 6. 分组与成员规则

## 6.1 分组规则

- 每用户最多 20 个分组；
- 每组最多 200 只股票；
- 用户去重后最多 500 只股票；
- 分组名称 1–20 个字符；
- 同一用户下分组名称不可重复；
- 同一股票可以存在于多个分组；
- 同一股票在同一分组内不可重复。

## 6.2 添加股票

V2 不要求后端提供证券搜索接口。添加股票由前端完成：

1. 用户输入证券代码或名称；
2. 前端调用公开搜索接口或使用内置轻量证券索引；
3. 用户确认目标证券；
4. 前端标准化为 `SecurityItem`；
5. 调用后端成员新增接口持久化。

搜索失败时，允许用户通过“交易所 + 代码 + 名称”手动添加，但必须提示：证券信息和板块标签需在首次行情成功后校正。

## 6.3 移动与复制

- 移动：从来源分组删除，再加入目标分组；
- 复制：保留来源分组，同时加入目标分组；
- 目标分组已有该股票时视为成功，不重复插入；
- 服务端操作必须幂等。

---

# 7. 提醒配置

## 7.1 支持的规则

```typescript
type AlertRuleType =
  | 'CHANGE_UPPER'
  | 'CHANGE_LOWER'
  | 'PRICE_UPPER'
  | 'PRICE_LOWER';
```

对应：

- 日涨幅超过；
- 日跌幅超过；
- 价格涨至；
- 价格跌至。

## 7.2 数据结构

```typescript
interface AlertRule {
  type: AlertRuleType;
  enabled: boolean;
  value: number;
  note: string;
  cooldownSeconds: number;
  maxTriggersPerDay: number;
}

interface SecurityAlerts {
  securityId: string;
  rules: AlertRule[];
  updatedAt: string;
}
```

默认值：

- 涨幅：10%；
- 跌幅：5%；
- 冷却时间：300 秒；
- 单日最多触发：3 次；
- 自定义文案最多 50 个字符。

## 7.3 表单校验

- 涨跌幅范围：`0.01–100.00`；
- 价格必须大于 0；
- 普通股票默认 2 位小数；
- ETF 默认 3 位小数；
- 至少开启一条规则才能保存为“监测中”；
- 未开启的规则可以保留输入值，但不进入 Worker 激活规则集。

---

# 8. 前端行情架构

## 8.1 模块拆分

建议目录：

```text
app/
  composables/
    useStockGroups.ts
    useQuoteMonitor.ts
    useNotifications.ts
  workers/
    quote-monitor.worker.ts
  services/quotes/
    types.ts
    tencent.adapter.ts
    sina.adapter.ts
    eastmoney.adapter.ts
    provider-manager.ts
  stores/
    market.ts
    user-config.ts
  utils/
    security-id.ts
    market-calendar.ts
    alert-engine.ts
server/
  api/stock-config/
  services/user-stock-storage.ts
  utils/atomic-json.ts
shared/
  types/stock.ts
  schemas/stock-config.ts
```

## 8.2 主线程职责

主线程只负责：

- 页面渲染；
- 从后端加载和保存配置；
- 将证券列表、激活提醒和调度配置发送给 Worker；
- 接收 Worker 行情结果并更新 Pinia；
- 调用浏览器 Notification；
- 展示站内提醒；
- 处理页面可见性变化；
- 多标签页主实例选举。

主线程不得执行 5 秒级批量行情解析和全量提醒判断。

## 8.3 Worker 职责

Worker 负责：

- 交易时段调度；
- 行情接口请求；
- 超时取消；
- 响应解码与标准化；
- 数据源切换；
- 阈值穿越判断；
- 冷却和单日次数控制；
- 向主线程发送行情快照、状态和触发事件。

---

# 9. 轮询调度与浏览器节能策略

## 9.1 核心原则

浏览器后台节流不可被可靠禁止，因此 V2 采用“尽量持续、恢复即校准、绝不补发堆积请求”的策略。

## 9.2 交易时段

时区固定为 `Asia/Shanghai`：

```text
09:25:00                集合竞价快照一次
09:30:00–11:29:59       每 5 秒
11:30:00                上午收盘快照一次
13:00:00–14:59:59       每 5 秒
15:00:00                收盘快照一次
其他时间                停止自动轮询
```

法定节假日和调休交易日通过前端交易日历文件判断。交易日历应按年度更新；日历缺失时仅按周一至周五运行，并在页面显示“交易日历未校准”。

## 9.3 禁止裸 `setInterval`

Worker 使用基于绝对时间的自校准调度：

```typescript
nextRunAt = alignToNextFiveSecondBoundary(Date.now());
delay = Math.max(0, nextRunAt - Date.now());
setTimeout(runOnce, delay);
```

每次请求结束后重新计算下一个时间边界，不按照“上次完成时间 + 5 秒”累加，避免长期漂移。

## 9.4 请求互斥

- 同一 Worker 任一时刻只允许一个行情批次运行；
- 上一请求未结束时，不启动下一请求；
- 请求超过 3 秒由 `AbortController` 取消；
- 因后台冻结错过的轮询不补发；
- 页面恢复时立即请求一次最新行情，再重新对齐 5 秒边界。

## 9.5 页面生命周期恢复

主线程监听：

- `visibilitychange`；
- `pageshow`；
- `pagehide`；
- `focus`；
- `online` / `offline`；
- Worker 心跳超时。

恢复逻辑：

1. 页面重新可见或获得焦点；
2. 检查最近行情时间；
3. 若超过 10 秒则发送 `FORCE_REFRESH`；
4. Worker 立即拉取一次；
5. 使用新行情重建提醒基准；
6. 重新进入对齐调度。

从冻结状态恢复后的第一条行情只用于重建基准，不因跨越历史阈值直接触发提醒，避免一次性误报。

## 9.6 Worker 心跳

- Worker 每 10 秒向主线程发送一次 `HEARTBEAT`；
- 前台页面 20 秒未收到心跳，重建 Worker；
- 后台页面只记录状态，不高频重建；
- 重建后重新下发证券、规则、交易日历和 Provider 状态。

## 9.7 多标签页单实例轮询

为避免同一用户打开多个标签页后重复请求公开 API：

- 使用 `BroadcastChannel('stock-monitor')` 同步状态；
- 使用 Web Locks API 竞争 `stock-monitor-leader`；
- 获得锁的标签页成为 Leader，创建 Worker 并执行轮询；
- 其他标签页为 Follower，只接收 Leader 广播的行情；
- Leader 关闭或失去锁后，Follower 重新选举；
- 不支持 Web Locks 的浏览器，使用 `localStorage` 租约 + 心跳兜底；
- 租约过期时间建议 15 秒，续约间隔 5 秒。

## 9.8 可选能力

可在支持的浏览器中使用 Screen Wake Lock API，且仅在用户主动开启“保持屏幕唤醒”时生效。该能力不能保证后台计时器不被限制，不得作为监测可靠性的前提。

---

# 10. 行情数据源

## 10.1 Provider 接口

```typescript
interface QuoteProviderAdapter {
  id: 'tencent' | 'sina' | 'eastmoney';
  supports(security: SecurityItem): boolean;
  buildRequest(securities: SecurityItem[]): RequestInfo;
  fetchQuotes(
    securities: SecurityItem[],
    signal: AbortSignal
  ): Promise<NormalizedQuote[]>;
}

interface NormalizedQuote {
  securityId: string;
  name: string;
  price: number | null;
  previousClose: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  change: number | null;
  changePercent: number | null;
  quoteTime: number;
  receivedAt: number;
  status: 'TRADING' | 'SUSPENDED' | 'CLOSED' | 'UNKNOWN';
  provider: 'tencent' | 'sina' | 'eastmoney';
}
```

## 10.2 数据源优先级

默认：

```text
腾讯 → 新浪 → 东方财富
```

但必须通过 Provider 配置支持调整顺序和临时禁用。

## 10.3 成功判定

一次批次满足以下条件才算成功：

- HTTP/网络请求成功；
- 返回内容可解析；
- 至少 80% 请求证券返回有效代码；
- 关键字段不是全部为空；
- 行情时间未明显早于当前交易时段。

部分证券失败时保留上一条行情，并标记该证券为 `STALE`。

## 10.4 超时与熔断

- 单源超时：3 秒；
- 同一数据源连续失败 3 次，熔断 10 分钟；
- 熔断结束后允许一次半开探测；
- 成功则恢复，失败则继续熔断；
- 切换数据源后不得直接触发提醒，第一批数据只用于校准基准。

## 10.5 CORS 限制

前端直连公开 API 的前提是目标接口在实际部署域名和目标浏览器中可用。上线前必须逐一验证：

- HTTPS 页面是否允许访问；
- CORS 响应头；
- Referer/Origin 限制；
- GBK 解码能力；
- 请求长度和批次上限；
- 北交所支持；
- 移动端浏览器兼容性。

若某数据源不能在生产环境前端直连，V2 只能禁用该 Provider，不得临时接入未知免费代理。

---

# 11. 提醒引擎

## 11.1 穿越触发

只有从阈值一侧穿越到另一侧才触发。

```text
价格涨至：previousPrice < target && currentPrice >= target
价格跌至：previousPrice > target && currentPrice <= target
涨幅超过：previousPct < target && currentPct >= target
跌幅超过：previousPct > -target && currentPct <= -target
```

## 11.2 初始和恢复基准

以下场景第一条有效行情仅建立基准，不触发：

- 首次打开页面；
- 新增或启用规则；
- Worker 重建；
- 页面冻结后恢复；
- 数据源切换；
- 网络断开后恢复；
- 行情延迟超过 30 秒后重新恢复。

## 11.3 防重复

每条规则维护：

```typescript
interface AlertRuntimeState {
  armed: boolean;
  lastValue: number | null;
  lastTriggeredAt: number | null;
  triggerCountToday: number;
  tradingDate: string;
}
```

- 触发后进入未武装状态；
- 数值回到阈值另一侧后重新武装；
- 同时受冷却时间和单日次数限制；
- 运行时状态只保存在 Worker，不写入后端配置文件；
- 每个新交易日重置触发次数。

---

# 12. 通知设计

## 12.1 通知渠道

优先级：

1. 浏览器系统通知；
2. 页面内消息中心；
3. 可选提示音。

浏览器通知被拒绝时，提醒仍写入站内消息中心。

## 12.2 通知模板

```text
{证券名称}（{代码}）{规则名称}
当前值：{当前值}；目标值：{目标值}
{自定义文案}
```

点击通知后：

- 聚焦现有页面；
- 切换到该股票所在分组；
- 滚动并高亮对应行；
- 打开提醒详情。

---

# 13. 后端职责与接口

## 13.1 后端职责

Nitro 只提供用户配置 CRUD，不参与实时行情。

必须实现：

- 从服务端会话获取用户 ID；
- 请求参数校验；
- JSON Schema 校验；
- 用户数据隔离；
- 原子写入；
- 写入互斥；
- 版本冲突检测；
- 基础审计日志。

## 13.2 精简接口清单

V2 推荐 **9 个接口**：

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/api/stock-config` | 获取用户完整配置 |
| POST | `/api/stock-groups` | 新建分组 |
| PATCH | `/api/stock-groups/:groupId` | 重命名分组 |
| DELETE | `/api/stock-groups/:groupId` | 删除分组 |
| PUT | `/api/stock-groups/reorder` | 调整分组顺序 |
| POST | `/api/stock-groups/:groupId/members` | 添加股票或批量添加 |
| DELETE | `/api/stock-groups/:groupId/members/:securityId` | 删除分组股票 |
| POST | `/api/stock-groups/:groupId/members/transfer` | 移动或复制股票 |
| PUT | `/api/stock-alerts/:securityId` | 新增、修改或关闭提醒配置 |

不提供：

- 行情接口；
- 行情代理；
- 证券搜索接口；
- SSE；
- WebSocket；
- 长轮询。

## 13.3 通用响应

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  configVersion?: number;
}
```

所有写请求携带：

```http
If-Match: {configVersion}
```

版本不一致返回 `409 CONFIG_VERSION_CONFLICT`，前端重新拉取配置并提示用户处理冲突。

## 13.4 接口说明

### 获取完整配置

```http
GET /api/stock-config
```

返回分组、成员、提醒和 `configVersion`。

### 新建分组

```http
POST /api/stock-groups
Content-Type: application/json
If-Match: 12

{
  "name": "核心关注"
}
```

### 修改分组

```http
PATCH /api/stock-groups/{groupId}

{
  "name": "短线观察"
}
```

### 分组排序

```http
PUT /api/stock-groups/reorder

{
  "groupIds": ["group_2", "group_1", "group_3"]
}
```

### 添加成员

```http
POST /api/stock-groups/{groupId}/members

{
  "securities": [
    {
      "securityId": "SSE:688981",
      "exchange": "SSE",
      "code": "688981",
      "name": "中芯国际",
      "securityType": "STOCK",
      "board": "STAR",
      "boardLabel": "科",
      "pricePrecision": 2,
      "providerSymbols": {
        "tencent": "sh688981",
        "sina": "sh688981"
      }
    }
  ]
}
```

### 移动或复制成员

```http
POST /api/stock-groups/{sourceGroupId}/members/transfer

{
  "securityIds": ["SSE:688981"],
  "targetGroupId": "group_2",
  "mode": "MOVE"
}
```

`mode` 为 `MOVE` 或 `COPY`。

### 保存提醒

```http
PUT /api/stock-alerts/{securityId}

{
  "rules": [
    {
      "type": "PRICE_UPPER",
      "enabled": true,
      "value": 100.00,
      "note": "突破目标价",
      "cooldownSeconds": 300,
      "maxTriggersPerDay": 3
    }
  ]
}
```

空数组表示清空该股票全部提醒。

---

# 14. JSON 持久化

## 14.1 文件路径

```text
.data/user-stocks/{userId}.json
```

部署平台必须为 `.data/user-stocks` 挂载持久化卷。

## 14.2 文件结构

```json
{
  "schemaVersion": 2,
  "configVersion": 13,
  "userId": "server-derived-user-id",
  "updatedAt": "2026-07-10T06:00:00.000Z",
  "groups": [
    {
      "id": "group_default",
      "name": "默认分组",
      "sortOrder": 0,
      "isDefault": true,
      "members": [
        {
          "securityId": "SSE:688981",
          "exchange": "SSE",
          "code": "688981",
          "name": "中芯国际",
          "securityType": "STOCK",
          "board": "STAR",
          "boardLabel": "科",
          "pricePrecision": 2,
          "providerSymbols": {
            "tencent": "sh688981",
            "sina": "sh688981"
          },
          "addedAt": "2026-07-10T06:00:00.000Z"
        }
      ]
    }
  ],
  "alerts": {
    "SSE:688981": {
      "securityId": "SSE:688981",
      "rules": [],
      "updatedAt": "2026-07-10T06:00:00.000Z"
    }
  }
}
```

## 14.3 写入要求

每次写操作：

1. 读取当前文件；
2. 校验 `configVersion`；
3. 在服务端执行具体变更；
4. 校验完整数据结构；
5. 写入同目录临时文件；
6. `fsync` 后原子重命名覆盖；
7. `configVersion + 1`；
8. 返回变更后的数据和新版本。

同一用户的写请求必须串行执行，可使用进程内用户级 Mutex。若部署多个实例，JSON 本地文件方案不支持可靠跨实例写锁，应固定单实例部署或使用共享数据库替代。

---

# 15. 前后端状态同步

## 15.1 首次加载

1. 页面请求 `/api/stock-config`；
2. 将配置写入 Pinia；
3. 计算去重证券列表；
4. 选举 Leader 标签页；
5. Leader 创建 Worker；
6. 下发证券、激活提醒、交易日历和 Provider 配置；
7. Worker 在交易时段立即请求一次。

## 15.2 写操作

采用乐观 UI：

1. 前端本地立即更新；
2. 调用对应写接口；
3. 成功后更新 `configVersion`；
4. 失败则回滚本地状态并提示；
5. 409 时重新拉取完整配置。

## 15.3 配置变化同步

- Leader 写入成功后通过 BroadcastChannel 广播新配置；
- Follower 更新本地 Pinia；
- 提醒变化需立即下发 Worker；
- 股票列表变化后 Worker 在下一批请求前更新订阅集合；
- 移除股票时同步清理该股票运行时提醒状态。

---

# 16. 错误码

| 错误码 | HTTP | 说明 |
|---|---:|---|
| `UNAUTHORIZED` | 401 | 未登录或会话失效 |
| `CONFIG_NOT_FOUND` | 404 | 用户配置不存在且初始化失败 |
| `GROUP_NOT_FOUND` | 404 | 分组不存在 |
| `SECURITY_NOT_FOUND` | 404 | 分组内不存在该股票 |
| `DUPLICATE_GROUP_NAME` | 409 | 分组名称重复 |
| `CONFIG_VERSION_CONFLICT` | 409 | 配置版本冲突 |
| `GROUP_LIMIT_EXCEEDED` | 422 | 超过分组上限 |
| `MEMBER_LIMIT_EXCEEDED` | 422 | 超过股票上限 |
| `INVALID_PAYLOAD` | 422 | 参数或结构校验失败 |
| `STORAGE_WRITE_FAILED` | 500 | JSON 文件写入失败 |

---

# 17. 非功能要求

## 17.1 性能

- 初始配置接口 P95 小于 300ms，不含冷启动；
- 单次 JSON 写入 P95 小于 500ms；
- 500 只股票配置文件建议小于 2MB；
- 行情表格使用虚拟滚动，200 行以上不得全量重复渲染；
- Worker 解析与提醒计算不得阻塞主线程；
- 同一用户多标签页只允许一个行情轮询 Leader。

## 17.2 稳定性

- 任一 Provider 失败不影响配置 CRUD；
- 行情失败保留最后成功值并标记延迟；
- Worker 异常退出后前台 20 秒内自动重建；
- 页面恢复后 2 秒内发起一次强制刷新；
- 请求不得并发堆积；
- 配置写入不得产生半截 JSON 文件。

## 17.3 安全

- 用户 ID 只能来自服务端会话；
- 文件名不得直接使用未清洗的邮箱或请求参数；
- 所有文本字段防止 XSS；
- 自定义提醒文案按纯文本展示；
- 服务端限制请求体大小；
- 日志不记录完整用户配置和敏感令牌。

---

# 18. 核心验收标准

## AC-01 后端边界

- 后端仅提供 9 个配置 CRUD 接口；
- Network 面板中不存在行情请求发往本站 Nitro；
- 不存在 SSE、WebSocket、长轮询端点；
- 行情请求全部由 Leader 标签页的 Worker 发出。

## AC-02 分组 CRUD

- 新建、重命名、删除、排序刷新后保持；
- 同组重复添加不会产生重复数据；
- 默认分组不可删除；
- 超出限制返回明确错误。

## AC-03 行情轮询

- 前台交易时段按 5 秒边界调度；
- 慢请求不产生重叠；
- 后台冻结后恢复会立即补拉一次，但不补发历史请求；
- 多标签页只存在一个轮询实例；
- 数据源失败后按规则切换和熔断。

## AC-04 节能策略恢复

- 标签页隐藏 60 秒后重新显示，2 秒内发出一次最新行情请求；
- 恢复第一条行情不触发历史穿越误报；
- Worker 心跳丢失后可以自动重建；
- 页面明确提示后台和休眠限制。

## AC-05 提醒

- 四种规则均按穿越触发；
- 达到阈值后持续停留不重复提醒；
- 回到另一侧后可重新武装；
- 冷却和单日次数有效；
- 系统通知不可用时仍有站内消息。

## AC-06 持久化

- 刷新和重新登录后配置可恢复；
- 版本冲突返回 409；
- 并发写入不会破坏 JSON；
- 容器重启后挂载卷内数据仍存在。

---

# 19. 关键测试用例

| 编号 | 场景 | 预期 |
|---|---|---|
| T01 | 同组重复添加股票 | 幂等成功，仅保留一条 |
| T02 | 股票复制到另一组 | 两组均存在该股票 |
| T03 | 股票移动到另一组 | 来源删除，目标新增 |
| T04 | 两标签页同时打开 | 仅 Leader 发起行情请求 |
| T05 | Leader 标签页关闭 | Follower 在租约过期后接管 |
| T06 | 请求耗时超过 5 秒 | 不并发，超时后切换数据源 |
| T07 | 页面后台冻结后恢复 | 立即刷新，不补历史请求 |
| T08 | 数据源切换 | 首批只校准，不误触发 |
| T09 | 价格从 9.99 涨到 10.00 | 价格涨至 10 触发一次 |
| T10 | 价格持续高于 10 | 不重复提醒 |
| T11 | 回落后再次突破 | 满足冷却与次数时再次触发 |
| T12 | 通知权限拒绝 | 站内消息正常记录 |
| T13 | 两个写请求版本相同 | 一个成功，一个返回 409 |
| T14 | 写入过程中进程异常 | 原文件保持完整 |
| T15 | ETF 159915 | 使用深市 Provider 代码，不错误转为沪市 |
| T16 | 科创板股票 | 名称后显示“科” |
| T17 | 后端服务正常但行情源失败 | 分组编辑正常，行情显示异常状态 |
| T18 | 非交易时段 | 自动轮询停止，手动刷新可用 |

---

# 20. 开发任务拆分

## P0：可用闭环

### 后端

- 用户配置初始化；
- JSON 存储服务；
- 9 个 CRUD 接口；
- Schema 校验；
- 原子写入；
- 用户级写锁；
- 版本冲突处理。

### 前端

- 分组和股票管理 UI；
- 提醒表单；
- Pinia 配置状态；
- Provider Adapter；
- Worker 轮询；
- 提醒状态机；
- Notification 和站内消息。

## P1：稳定性

- 数据源熔断；
- Worker 心跳与重建；
- 页面恢复补拉；
- Web Locks Leader 选举；
- BroadcastChannel 行情同步；
- 交易日历；
- 虚拟滚动。

## P2：体验增强

- 分组拖拽；
- 批量添加和批量移动；
- 提醒历史筛选；
- 自定义提示音；
- 可选 Screen Wake Lock；
- Provider 调试面板。

---

# 21. 上线前验证清单

- [ ] 腾讯接口在生产 HTTPS 域名下可直连；
- [ ] 新浪接口在生产环境中通过 CORS 与 Referer 验证；
- [ ] 东方财富接口在生产环境中可直连；
- [ ] GBK 解码在目标浏览器可用；
- [ ] 单批次最大代码数量经过压测；
- [ ] 159xxx ETF 市场映射正确；
- [ ] 创、科、北标签抽样验证；
- [ ] 多标签页仅一个 Leader；
- [ ] Chrome/Edge 后台 5 分钟恢复测试；
- [ ] 设备休眠后恢复测试；
- [ ] 通知拒绝和不支持场景测试；
- [ ] JSON 目录已挂载持久化卷；
- [ ] 应用采用单实例部署，或已改用共享数据库；
- [ ] 所有写接口启用用户身份校验和版本校验。

---

# 22. Definition of Done

V2 满足以下条件才可上线：

1. 后端只承担配置 CRUD 和 JSON 持久化，不存在行情代理或推送服务；
2. 9 个后端接口均有请求校验、错误码和测试；
3. 行情由前端 Worker 直接访问公开 API；
4. 多标签页只保留一个轮询主实例；
5. 前台交易时段轮询无明显漂移和请求堆积；
6. 页面从后台或休眠恢复后可自动校准；
7. 提醒不会因初始化、恢复或数据源切换误触发；
8. 分组、成员和提醒刷新后不丢失；
9. JSON 写入具备原子性和版本冲突保护；
10. 产品页面清楚说明浏览器后台限制和非云端监测边界。

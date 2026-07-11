# ValueTicker 五阶段开发执行计划

> 项目：股票实时监测与提醒系统  
> 技术栈：Nuxt 4、Vue 3、Nitro、TypeScript、Pinia、Tailwind CSS 3、Web Worker  
> 依据文档：`股票实时监测与提醒系统_PRD_V2_精简版_Nuxt技术方案.md`  
> 计划状态：设计 Demo 已完成，业务功能尚未接入

## 1. 执行原则

开发按以下依赖关系推进：

```text
工程基线
  → 共享类型与 Schema
  → Provider 可行性验证
  → JSON 存储与 API
  → Pinia 与配置管理 UI
  → Provider Adapter
  → Worker 轮询
  → 提醒与通知
  → 多标签页与生命周期恢复
  → 完整验收和部署
```

每个阶段必须满足对应验收条件后才能进入下一阶段。Provider 浏览器直连验证属于架构门槛，应尽早完成，不能推迟到实时行情模块开发结束后再验证。

## 2. 已确认的 PRD 调整

### 2.1 取消虚拟滚动

当前产品不需要引入虚拟滚动依赖，删除 PRD 中“行情表格必须使用虚拟滚动”的要求。

普通行情表格通过以下方式控制性能：

- 使用稳定的 `securityId` 作为行 `key`；
- 行情使用 Map 或标准化对象存储；
- 每批行情只更新发生变化的证券；
- 避免每次轮询重新创建完整列表；
- 避免在模板中执行高成本格式化和排序；
- 对最多 500 行、5 秒更新频率进行专项性能测试。

### 2.2 请求超时统一为 3 秒

PRD 第 9、10 章规定单源请求超时为 3 秒，而测试用例 T06 写的是“超过 5 秒”。实现和测试统一采用 3 秒，T06 应调整为：

> 请求耗时超过 3 秒时取消当前请求，不产生并发堆积，并按规则切换数据源。

## 3. 当前进度

| 工作项 | 状态 | 说明 |
|---|---|---|
| Nuxt UI 初始化模板清理 | 已完成 | 已移除 Nuxt UI、Lucide 和模板组件引用 |
| Tailwind CSS 3 基础样式 | 已完成 | 已配置全局基础样式和响应式工作台 |
| 静态 UI Demo | 已完成 | 已包含状态栏、分组、行情表格、市场概览和提醒抽屉 |
| Lint、类型检查、生产构建 | 已完成 | 当前 Demo 均已通过 |
| 领域模型、API、Store、Worker | 待开始 | Demo 数据尚未接入业务逻辑 |

---

# 阶段一：工程基础与技术风险验证

## 步骤 0：清理初始化模板与建立工程基线

**状态：已完成。**

### 目标

得到可持续开发、无遗留 UI 框架依赖的工程基线。

### 任务

- 清除 Nuxt UI 初始化模板和无效配置；
- 建立顶部状态栏、左侧分组、行情区域和右侧信息栏；
- 配置 Tailwind CSS 3 全局样式；
- 使用 Tabler Icons 作为统一图标库；
- 建立价格提醒抽屉 Demo；
- 设置中文页面元信息和基础 SEO；
- 建立 `app`、`server`、`shared` 目录规划；
- 配置 `.data` 本地数据目录的忽略规则；
- 配置 Vitest 测试入口和运行环境。

### 验收

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

其中 Lint、类型检查和生产构建已经通过。测试配置将在正式领域模型开发时补齐首批测试用例。

## 步骤 1：共享领域模型与 Schema

### 目标

让页面、Pinia、Worker、Nitro API 和 JSON 文件使用同一套数据契约。

### 建议目录

```text
shared/
  constants/
    stock.ts
  types/
    stock.ts
    api.ts
    worker.ts
  schemas/
    stock-config.ts
    stock-group.ts
    stock-alert.ts
    api-payload.ts
```

### 任务

- 定义 `SecurityItem`、`StockGroup`、`AlertRule`、`NormalizedQuote`；
- 定义完整用户配置和 `configVersion`；
- 定义 9 个 API 的请求与响应类型；
- 定义 Worker 双向消息的判别联合类型；
- 集中定义分组、成员和文本字段的业务上限；
- 使用 Zod 验证 API 请求体和完整 JSON 配置；
- 定义统一错误码和 `ApiResponse<T>`；
- 编写边界值、非法枚举和缺失字段测试。

### 阶段产物

- 前后端共享的类型文件；
- Zod Schema；
- 领域规则常量；
- 首批单元测试。

## 步骤 2：Provider 与 CORS 技术验证

### 目标

在投入行情模块开发前，确认公开行情接口能否满足“浏览器 Worker 直连”的核心架构要求。

### 任务

- 在实际 HTTPS 域名或等价环境测试腾讯、新浪、东方财富；
- 验证 CORS、Origin 和 Referer 限制；
- 验证 GBK 解码能力；
- 验证单批最大证券数量和 URL 长度；
- 验证沪、深、北市场支持情况；
- 验证 `159915` 等 ETF 的市场映射；
- 验证目标移动端浏览器兼容性；
- 验证证券搜索接口是否允许前端直连；
- 形成 Provider 支持矩阵、默认优先级和禁用清单。

### 阶段门槛

- 至少一个行情 Provider 可在生产环境由浏览器 Worker 直接访问；
- 若所有 Provider 均不可用，应暂停实时行情开发并调整 PRD 架构；
- 不允许临时接入来源不明的免费代理。

---

# 阶段二：配置管理 P0 闭环

## 步骤 3：JSON 持久化模块

### 目标

建立可靠、用户隔离、具备并发保护的 JSON 配置存储。

### 建议目录

```text
server/
  services/
    user-stock-storage.ts
  utils/
    atomic-json.ts
    user-write-lock.ts
    require-user.ts
    audit-log.ts
```

### 任务

- 新用户自动创建默认分组；
- 配置路径固定为 `.data/user-stocks/{safeUserId}.json`；
- 用户 ID 只允许来自服务端会话；
- 实现读取、初始化和完整 Schema 校验；
- 实现临时文件写入、`fsync` 和原子重命名；
- 使用 `async-mutex` 建立用户级写锁；
- 每次写入检查并递增 `configVersion`；
- 文件名不直接使用邮箱或请求参数；
- 实现不包含完整配置和敏感数据的审计日志；
- 所有存储变更封装在 Service 中，API Handler 不直接操作文件。

### 验收

- 同版本并发写入时一个成功、一个冲突；
- 写入失败后原文件仍保持完整；
- 不同用户的数据严格隔离；
- 新用户能够获得默认配置。

## 步骤 4：实现 9 个 Nitro API

### 建议目录

```text
server/api/
  stock-config.get.ts
  stock-groups/
    index.post.ts
    reorder.put.ts
    [groupId].patch.ts
    [groupId].delete.ts
    [groupId]/members.post.ts
    [groupId]/members/[securityId].delete.ts
    [groupId]/members/transfer.post.ts
  stock-alerts/
    [securityId].put.ts
```

### 任务

- 实现 PRD 规定的 9 个接口；
- 写请求统一读取 `If-Match`；
- 使用 Zod 校验路径参数、查询参数和请求体；
- 限制请求体大小；
- 实现默认分组保护、数量限制和名称去重；
- 添加证券保持幂等；
- MOVE/COPY 在同一个用户写锁内完成；
- 实现 401、404、409、422、500 统一响应；
- 为每个接口补齐正常、异常和冲突测试。

### 验收对应

- AC-01：后端边界；
- AC-02：分组 CRUD；
- AC-06：持久化；
- T01、T02、T03、T13、T14。

## 步骤 5：Pinia 与前端 API 客户端

### 建议目录

```text
app/
  stores/
    user-config.ts
    market.ts
    notifications.ts
  services/api/
    stock-config.ts
  composables/
    useStockGroups.ts
```

### 任务

- 首次加载完整用户配置；
- 提取去重后的证券订阅列表；
- 实现统一 API 客户端和错误转换；
- 配置写操作采用乐观更新；
- 请求失败时回滚本地状态；
- 409 时重新获取完整配置并提示用户；
- 写入成功后更新 `configVersion`；
- 配置 Store 和实时行情 Store 保持分离。

### 验收

- 页面刷新后配置恢复；
- 乐观更新失败后状态正确回滚；
- 版本冲突不会覆盖其他页面的修改。

## 步骤 6：分组与证券管理 UI

### 建议组件

```text
app/components/
  monitor/MonitorStatusBar.vue
  groups/GroupSidebar.vue
  groups/GroupFormDialog.vue
  securities/SecurityTable.vue
  securities/AddSecurityDialog.vue
  securities/TransferSecurityDialog.vue
  common/ConfirmDialog.vue
```

### 任务

- 将现有 Demo 组件逐步替换为正式业务组件；
- 实现“全部”系统视图和默认分组；
- 实现新建、重命名、删除和排序；
- P0 排序先提供上下移动，拖拽放到 P2；
- 实现添加、删除、移动和复制证券；
- 实现证券搜索和手动添加兜底；
- 实现证券 ID、Provider Symbol 和板块标签规则；
- 显示创、科、北标签，ETF 不显示板块标签；
- 完善加载、空数据、失败和确认状态。

### 验收对应

- AC-02；
- T01、T02、T03、T15、T16。

---

# 阶段三：实时行情与提醒 P0

## 步骤 7：Provider Adapter

### 建议目录

```text
app/services/quotes/
  types.ts
  encoding.ts
  tencent.adapter.ts
  sina.adapter.ts
  eastmoney.adapter.ts
  provider-manager.ts
```

### 任务

- 每个 Adapter 独立完成代码转换、请求构建、解析和标准化；
- 处理 GBK 或其他响应编码；
- 输出统一的 `NormalizedQuote`；
- 根据 Provider 上限拆分证券批次；
- 使用 `AbortController` 实现 3 秒超时；
- 实现至少 80% 有效返回的成功判定；
- 部分证券失败时保留旧行情并标记 `STALE`；
- P0 实现顺序切换，完整熔断放到阶段四；
- 使用固定响应 Fixture 测试解析器，不依赖真实网络完成单元测试。

## 步骤 8：Worker 轮询与行情状态

### 建议目录

```text
app/
  workers/
    quote-monitor.worker.ts
  composables/
    useQuoteMonitor.ts
  utils/
    market-calendar.ts
    quote-scheduler.ts
```

### 任务

- 建立类型安全的 Worker 消息协议；
- 使用基于绝对时间的 `setTimeout`，禁止裸 `setInterval`；
- 交易时段按 5 秒边界轮询；
- 09:25、11:30、15:00 执行快照；
- 任意时刻只允许一个行情批次；
- 超时取消后重新计算下一次运行时间；
- 错过的历史轮询不补发；
- 支持暂停、继续、手动刷新和 `FORCE_REFRESH`；
- 非交易时段停止自动轮询，但保留手动刷新；
- 批量更新 `market` Store；
- 日历缺失时按工作日运行并提示“交易日历未校准”。

### 验收

- 5 秒边界长期运行无明显漂移；
- 慢请求不产生重叠；
- T06、T17、T18。

## 步骤 9：提醒引擎与通知

### 建议目录

```text
app/
  utils/
    alert-engine.ts
  composables/
    useNotifications.ts
  components/alerts/
    AlertRuleDialog.vue
  components/notifications/
    NotificationCenter.vue
```

### 任务

- 将 Demo 提醒抽屉替换为正式表单；
- 实现四种提醒规则；
- 校验涨跌幅、价格、小数精度、冷却和触发次数；
- 在 Worker 中实现 `armed` 状态机；
- 只有真正穿越阈值才触发；
- 首次加载、新增规则、恢复、重建和切换 Provider 时只建立基准；
- 实现冷却时间和每日触发次数；
- 按 `Asia/Shanghai` 交易日期重置计数；
- 浏览器通知失败或被拒绝时仍写入站内消息；
- 点击通知后定位证券并打开提醒详情；
- 自定义提醒文案始终按纯文本展示。

### 验收对应

- AC-05；
- T08、T09、T10、T11、T12。

---

# 阶段四：P1 稳定性

## 步骤 10：多标签页单 Leader

### 建议目录

```text
app/composables/
  useMonitorLeader.ts
  useMonitorBroadcast.ts
```

### 任务

- 使用 Web Locks 竞争 `stock-monitor-leader`；
- 只有 Leader 创建 Worker；
- Leader 通过 BroadcastChannel 广播行情和状态；
- Follower 只更新本地 Store；
- Leader 退出后自动重新选举；
- 不支持 Web Locks 时使用 localStorage 租约；
- 租约 15 秒过期、5 秒续约；
- 配置修改成功后同步其他标签页；
- 防止失去租约的旧 Leader 继续轮询。

### 验收

- T04、T05；
- 同一用户多标签页中只有一个页面请求行情源。

## 步骤 11：生命周期恢复、心跳、熔断和异常处理

### 任务

- Worker 每 10 秒发送心跳；
- 前台 20 秒未收到心跳时重建 Worker；
- 后台页面只记录状态，不反复重建；
- 监听 `visibilitychange`、`focus`、`pageshow`、`pagehide`、`online`、`offline`；
- 页面恢复后 2 秒内执行强制刷新；
- 恢复第一批行情只校准提醒基准；
- Provider 连续失败 3 次后熔断 10 分钟；
- 熔断结束后执行一次半开探测；
- 行情异常不影响配置 CRUD；
- 状态栏显示 RUNNING、BACKGROUND、PAUSED、MARKET_CLOSED、STALE、ERROR。

### 验收对应

- AC-03、AC-04；
- T04、T05、T06、T07、T08、T17。

---

# 阶段五：P2 与上线验收

## 步骤 12：体验增强

### P2 功能

- 使用 `vue-draggable-plus` 实现分组拖拽；
- 批量添加证券；
- 批量移动和复制证券；
- 站内提醒历史筛选；
- 自定义提示音；
- 用户主动开启的 Screen Wake Lock；
- Provider 调试面板。

## 上线验收

### 功能验收

- 完整执行 PRD T01 至 T18；
- 9 个配置 API 均具备正常、异常和权限测试；
- Network 面板确认行情请求不经过本站 Nitro；
- 多标签页确认只有一个行情 Worker Leader；
- 通知权限拒绝时站内消息仍正常工作。

### 性能验收

- 初始配置 API P95 小于 300ms；
- JSON 写入 P95 小于 500ms；
- 500 只证券配置文件小于 2MB；
- 普通表格 500 行、5 秒更新保持可接受的交互流畅度；
- Worker 解析和提醒判断不阻塞主线程。

### 安全验收

- 用户 ID 仅来自服务端会话；
- 文件名不使用未经处理的邮箱或请求参数；
- 所有自定义文本按纯文本输出；
- 请求体大小受到限制；
- 日志不记录完整用户配置和敏感令牌。

### 部署验收

- `.data/user-stocks` 已挂载持久化卷；
- JSON 存储方案固定为单实例部署；
- 容器重启后用户配置仍存在；
- Chrome、Edge 和目标移动端完成后台恢复测试；
- Provider 在生产 HTTPS 域名下重新验证通过。

---

# 4. 建议实施节奏

以下为单人开发的粗略工作量：

| 阶段 | 内容 | 预计时间 |
|---|---|---:|
| 阶段一 | 工程基础、共享模型、Provider 风险验证 | 3–5 个工作日 |
| 阶段二 | JSON 存储、9 个 API、Pinia 和配置管理 UI | 7–10 个工作日 |
| 阶段三 | Provider Adapter、Worker、提醒和通知 | 8–12 个工作日 |
| 阶段四 | 多标签页、恢复、心跳和熔断 | 5–8 个工作日 |
| 阶段五 | P2、完整测试和上线验收 | 4–7 个工作日 |

工期主要受以下因素影响：

- 行情 Provider 的 CORS 和生产环境可用性；
- 登录会话方案是否已确定；
- 腾讯、新浪、东方财富响应格式的稳定性；
- 目标移动端浏览器范围；
- P2 功能是否需要随首个版本上线。

# 5. 下一步

UI Demo 确认后，建议按以下顺序进入正式开发：

1. 完成步骤 1：共享领域类型和 Zod Schema；
2. 同步执行步骤 2：Provider/CORS 可行性验证；
3. 完成步骤 3：JSON 原子存储；
4. 完成步骤 4：9 个 Nitro API；
5. 再将当前 Demo UI 接入 Pinia 和真实配置数据。


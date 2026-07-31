# ValueTicker Supabase 用户系统接入指南

本文档对应 ValueTicker 的首期用户系统接入：使用 **Supabase Auth** 负责身份认证，继续使用现有 **Upstash Redis** 存储自选分组、证券顺序、提醒规则与提醒记录。

在开始编码前，请一并参考 [股票实时监测与提醒系统 PRD V2 精简版](./股票实时监测与提醒系统_PRD_V2_精简版_Nuxt技术方案.md) 与 [ValueTicker 五阶段开发执行计划](./ValueTicker_五阶段开发执行计划.md)。

## 1. 本期边界

本期不把用户配置迁移到 Supabase Postgres。Supabase 只解决注册、登录、会话和用户唯一身份；Redis 继续承担当前的配置读取与高频写入。

```text
浏览器登录 Supabase Auth
        │
        ▼
Supabase user.id（UUID，经服务端验证）
        │
        ▼
Upstash Redis
value-ticker:user-stock-config:{user.id}
        │
        ▼
分组 / 证券 / 排序 / 提醒设置 / 提醒动态
```

这样不会改变现有行情轮询、浏览器提醒、交易日历和 Redis 配置版本控制的职责。现有 `local-dev-user` 仅作为未接入登录前的本地开发身份，正式环境必须移除该兜底。

## 2. 需要准备的账号

1. 在 [Supabase Dashboard 注册或登录](https://supabase.com/dashboard/sign-up)。可用 GitHub 或邮箱注册。
2. 在 [Vercel](https://vercel.com/signup) 注册或登录，并确保当前仓库已导入为一个 Project。
3. 保留现有 Upstash Redis 数据库；本期不新建或替换 Redis。

建议为 `Development/Preview` 与 `Production` 建立不同 Supabase 项目，避免测试邮件、测试用户和正式用户混在一起。若先只创建一个项目，也可先完成联调，正式上线前再拆分。

## 3. 创建 Supabase 项目并获取 Key

### 3.1 新建项目

1. 进入 Supabase Dashboard，选择组织后点击 **New project**。
2. 填写项目名，例如 `valueticker-prod`。
3. 设置数据库密码并保存到密码管理器。本期不会直接连接数据库，但它仍是项目管理员密码。
4. 选择靠近主要用户和 Vercel 部署区域的 Region，创建项目并等待初始化完成。

### 3.2 复制客户端连接信息

在项目的 **Connect** 弹窗，或 **Project Settings → API Keys** 页面获取：

| 用途 | Supabase 页面中的名称 | ValueTicker 环境变量 |
| --- | --- | --- |
| 项目地址 | Project URL | `NUXT_PUBLIC_SUPABASE_URL` |
| 浏览器与服务端认证客户端 | Publishable key（优先）或兼容的 anon key | `NUXT_PUBLIC_SUPABASE_KEY` |

示例：

```env
NUXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NUXT_PUBLIC_SUPABASE_KEY=sb_publishable_xxxxxxxxxxxxx
```

`NUXT_PUBLIC_SUPABASE_KEY` 是需要下发到浏览器的 publishable/anon key，属于公开客户端标识；它不能替代数据库权限控制。**绝对不要**把 `service_role` 或新的 secret key 写进该变量、提交到 Git，或放到前端代码中。

## 4. 配置邮箱验证码登录

当前使用邮箱 6 位 OTP（无密码登录）。它能减少密码重置、密码强度和账号找回成本；后续仍可增加邮箱密码或 OAuth 登录。

### 4.1 开启 Email Provider

进入 **Authentication → Providers → Email**：

1. 保持 Email provider 启用。
2. 前端使用 `signInWithOtp({ email })` 发送验证码，并使用 `verifyOtp({ email, token, type: 'email' })` 验证登录。`Magic Link` 邮件模板必须包含 `{{ .Token }}`，才能发送 6 位 OTP。
3. 开发阶段可使用 Supabase 默认邮件服务；正式环境请在 **Authentication → SMTP Settings** 配置自己的 SMTP 发件服务与发件人域名，以提升送达率并避免默认服务的限制。

### 4.2 URL Configuration

进入 **Authentication → URL Configuration**，按实际域名填写：

| 字段 | 建议值 |
| --- | --- |
| Site URL | 正式站点根地址，例如 `https://valueticker.example.com` |
| Redirect URLs | `http://localhost:3000/auth/callback` |
| Redirect URLs | `https://valueticker.example.com/auth/callback` |
| 可选预发布地址 | 固定 staging 域名的 `/auth/callback`，例如 `https://staging-valueticker.example.com/auth/callback` |

6 位 OTP 登录不会依赖邮件跳转；`/auth/callback` 仅作为旧 Magic Link 和兼容流程的保留路由。Site URL 与允许的回调地址仍应保持为受控域名。

不要为每一个临时 `*.vercel.app` 预览地址随意放开回调白名单。预览地址会变化，也容易使回调规则过宽。需要测试预发布登录时，应优先为 Preview 配置固定的 Vercel staging 域名，再把这个固定域名加入 Supabase。

## 5. 安装 Nuxt 依赖

在项目根目录执行：

```bash
pnpm add @nuxtjs/supabase
```

本项目已经使用 Nuxt 4，因此选用 `@nuxtjs/supabase`。该模块封装了 `supabase-js`、Vue composables、服务端路由上下文和 Nuxt 的会话集成；本期不需要额外手工安装 `@supabase/supabase-js` 或 `@supabase/ssr`。

项目已在 `nuxt.config.ts` 中启用 `@nuxtjs/supabase` 的会话重定向：首页和业务页要求登录，`/login` 与 `/auth/callback` 分别作为登录入口和回调页。开发环境允许非 HTTPS Cookie，生产环境自动启用 Secure Cookie。

```ts
supabase: {
  redirect: true,
  redirectOptions: {
    login: '/login',
    callback: '/auth/callback',
    exclude: []
  },
  cookieOptions: {
    maxAge: 60 * 60 * 8,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
}
```

## 6. 本地环境变量

项目当前开发命令会读取 `.env.development.local`。在根目录创建或补充该文件（该文件已被 `.gitignore` 忽略）：

```env
# 既有配置
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# 新增：从 Supabase Connect / API Keys 复制
NUXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NUXT_PUBLIC_SUPABASE_KEY=sb_publishable_xxxxxxxxxxxxx
```

不要在 `.env`、`.env.development.local` 或任何截图、日志中记录 secret/service-role key。建议新建一个可提交的 `.env.example`，只保留变量名和无效占位值：

```env
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
NUXT_PUBLIC_SUPABASE_URL=
NUXT_PUBLIC_SUPABASE_KEY=
```

填完后重启 `pnpm dev`。环境变量修改不会自动注入已运行的 Nuxt 进程。

## 7. Vercel 配置

### 7.1 在 Vercel 填写变量

进入 **Vercel Project → Settings → Environment Variables**，分别新增下列变量：

| 变量 | Development | Preview | Production |
| --- | --- | --- | --- |
| `NUXT_PUBLIC_SUPABASE_URL` | 开发项目 URL | staging 项目 URL | 生产项目 URL |
| `NUXT_PUBLIC_SUPABASE_KEY` | 对应 publishable/anon key | 对应 publishable/anon key | 对应 publishable/anon key |
| `UPSTASH_REDIS_REST_URL` | 现有开发值 | 对应环境值 | 生产值 |
| `UPSTASH_REDIS_REST_TOKEN` | 现有开发 token | 对应环境 token | 生产 token |

初期若暂时只建了一个 Supabase 项目，三种环境可先填同一套 `NUXT_PUBLIC_SUPABASE_URL` 和 `NUXT_PUBLIC_SUPABASE_KEY`，但上线前应分离至少 Production 与非 Production。`UPSTASH_REDIS_REST_TOKEN` 是服务端敏感凭据；不应通过 `NUXT_PUBLIC_` 前缀暴露。

变量保存后需要重新部署，旧部署不会自动取得新值。Vercel 的 Development 环境仅供 `vercel dev` / `vercel env pull` 等本地工作流使用；本项目日常 `pnpm dev` 仍以 `.env.development.local` 为准。

### 7.2 域名与认证回调

1. 在 **Vercel Project → Settings → Domains** 绑定正式域名。
2. 将该正式域名写入 Supabase 的 **Site URL** 与 **Redirect URLs**（见第 4 节）。
3. 如果有固定 staging 域名，也单独绑定到 Vercel 并加入 Supabase Redirect URLs。
4. 使用 Vercel 的默认预览 URL 时，不要把未知的动态预览 URL 作为正式认证回调；登录验证改在本地或固定 staging 域名完成。

不需要为 Supabase 新建 `vercel.json`、Edge Function 或数据库连接字符串。当前 Nuxt server routes 仍部署在 Vercel 的标准运行时中。

## 8. 实施时的代码改动清单

以下是实际开发任务，不是仅配置 Key 后自动完成的内容：

1. 添加 Supabase Nuxt 模块与登录页、`/auth/callback` 回调页。
2. 提供邮箱 6 位 OTP 的发送、校验、登录状态展示和退出登录。
3. 在服务端替换 `server/utils/require-user.ts` 中固定的 `DEFAULT_USER_ID`：从已验证的 Supabase JWT claims 取 `sub`（即 `user.id`），未登录请求返回 401。
4. 所有用户配置 API 继续调用现有 Redis 服务，但 Key 改为 `value-ticker:user-stock-config:{verified-user-id}`。
5. 退出登录时清除 Pinia 中的用户配置、提醒动态和按用户隔离的浏览器缓存；重新登录后重新拉取配置。
6. 将轮询 Worker / BroadcastChannel 的互斥标识加上用户 ID，防止同一浏览器切换账号后复用旧会话状态。
7. 完成一个一次性迁移工具：由管理员指定一个 Supabase `user.id`，把旧 `local-dev-user` 的 Redis 配置复制给该账号。迁移必须显式执行、可审计，不能在用户首次登录时自动覆盖其配置。

服务端授权必须以验证后的 claims 为准，不能信任浏览器传来的 `userId`、localStorage 或未经验证的 session 对象。

## 9. 验收清单

- [x] 受保护配置 API 已统一校验 Supabase claims；未登录返回 401，不再读取 `local-dev-user`。
- [ ] 邮箱能收到 6 位 OTP，输入正确验证码后建立会话并进入首页。
- [ ] 两个账号创建不同分组或提醒后，Redis Key 与页面数据互相隔离。
- [ ] 刷新页面后登录会话仍有效；退出后配置不再显示。
- [ ] 本地、Preview、Production 的回调地址都能登录，且不存在未列入白名单的开放重定向。
- [ ] Vercel 新部署后变量生效，`pnpm typecheck` 与现有行情、提醒功能正常。
- [ ] 仅存在 `NUXT_PUBLIC_SUPABASE_URL`、publishable/anon key 和 Upstash 服务端变量；仓库、客户端包与日志中均没有 service-role/secret key。

## 10. 常见问题

| 现象 | 优先检查 |
| --- | --- |
| 邮件仍发送登录链接而不是验证码 | 检查 Magic Link 邮件模板是否使用 `{{ .Token }}`，而不是 `{{ .ConfirmationURL }}`。 |
| 本地有 Key 但 Nuxt 读不到 | 是否写在 `.env.development.local`，以及是否重启了 `pnpm dev`。 |
| Vercel 已新增变量但线上仍旧报错 | 环境范围是否选对，新增变量后是否创建了新的部署。 |
| 登录后仍拿到 `local-dev-user` 配置 | `requireUserId` 是否已改为校验 Supabase JWT；生产环境不可保留固定 ID 兜底。 |
| 用户 A 能看到用户 B 的分组 | 检查服务端是否只使用已验证 `sub` 生成 Redis Key，绝不能使用请求体中的用户 ID。 |

## 11. 官方参考

- [Nuxt Supabase 模块文档](https://supabase.nuxtjs.org/)
- [Supabase Auth：选择服务端集成包](https://supabase.com/docs/guides/auth/choosing-a-server-package)
- [Supabase Auth：服务端客户端与会话校验](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Vercel：环境变量](https://vercel.com/docs/environment-variables)
- [Vercel：Project Settings](https://vercel.com/docs/project-configuration/project-settings)

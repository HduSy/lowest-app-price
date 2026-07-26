# App Store 全区比价

Next.js 15 + TypeScript + Tailwind CSS v4 + Cloudflare Pages（OpenNext）+ D1。

粘贴 App Store 链接或 App ID，添加到数据库；点击 App 进入详情，后端并发抓取 18 个地区的 IAP 价格，按汇率换算后从低到高排名。哪国买最便宜，一目了然。

## 功能

- **添加 App**：粘贴链接或 App ID，后端通过 iTunes Lookup 拿到 name / icon / developer / **category** / **compatibility**（iPhone/iPad/Mac）入 D1
- **18 区比价**：详情页首次访问时，后端并发抓取 apps.apple.com 18 区页面，解析 IAP 档位价格入库（6h TTL 缓存）
- **实时换算**：选币种即时换算排序，综合地区排行 + 每个 IAP 档位的价格表

## 数据流

```
添加 App：
  用户输入 → POST /api/apps → iTunes Lookup（拿元信息）→ 入 D1 apps 表

详情比价：
  GET /apps/[appId] (SSR)
    → D1 查 app + prices
    → 若 last_fetched_at 过期(6h) 或从未抓取
      → 并发抓 18 区 apps.apple.com HTML
      → 解析 IAP textPair → 按汇率换算 → 写 D1 prices 表（覆盖）
    → 渲染 PriceTable（客户端按当前汇率再换算排序）
```

## 数据库表（D1 / SQLite）

| 表 | 作用 |
|----|------|
| `regions` | 18 个地区种子（code, currency, flag） |
| `apps` | App 主表（app_id, name, icon, category, genres, compatibility, last_fetched_at） |
| `prices` | 价格（app × region × iap_key，覆盖更新，amount_usd 换算值） |

详见 `migrations/`。

## 部署

### 1. 安装依赖

```bash
npm install
```

### 2. 创建 D1 数据库

```bash
npx wrangler login
npx wrangler d1 create appstore-price
# 输出的 database_id 填入 wrangler.toml
```

### 3. 执行 migrations

```bash
npm run db:init    # 建 3 张表
npm run db:seed    # 种子 18 个地区
```

### 4. 本地预览（端口 8788，完整 D1）

```bash
npm run preview
# → http://localhost:8788
```

### 5. 部署到 Cloudflare Pages

```bash
npm run deploy
```

## 开发

```bash
npm run dev      # Next.js 开发模式（端口 3000，无 D1，调 API 会报错）
npm run build    # 生产构建
npm run preview  # 本地 wrangler 预览（端口 8788，完整 D1，推荐）
npm run lint     # 独立 lint
```

**注意**：`npm run dev` 不能测试 D1 相关功能（添加 App、看价格），因为开发模式下没有 Cloudflare bindings。要测试完整流程用 `npm run preview`。

## 目录结构

```
.
├── migrations/                  D1 schema + 种子
├── src/
│   ├── app/
│   │   ├── layout.tsx           根布局 + 导航
│   │   ├── page.tsx             首页（Hero + 地区展示 + FAQ）
│   │   ├── apps/
│   │   │   ├── page.tsx         全部应用列表（SSR + 无限滚动）
│   │   │   ├── AppsListClient.tsx
│   │   │   └── [appId]/
│   │   │       ├── page.tsx     App 详情（SSR + 懒抓）
│   │   │       ├── refresh.ts   抓取逻辑（API 复用）
│   │   │       └── RefreshButton.tsx
│   │   └── api/                 Route Handlers
│   │       ├── regions/route.ts
│   │       └── apps/
│   │           ├── route.ts             GET 列表 / POST 添加
│   │           └── [appId]/prices/route.ts
│   ├── components/              Nav / AppCard / PriceTable / RegionRank / AddAppForm
│   └── lib/                     regions / currencies / exchange / itunes / crawler / compare / db / types
├── open-next.config.ts          OpenNext 配置
├── wrangler.toml                Cloudflare 配置（D1 binding）
├── env.d.ts                     CloudflareEnv 类型增强
└── next.config.mjs
```

## API

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/regions` | 18 个地区 |
| GET | `/api/apps?q=&page=&limit=` | 已入库 App 列表（分页 + 搜索） |
| POST | `/api/apps` `{ input }` | 添加 App（解析 → iTunes Lookup → 入库） |
| GET | `/api/apps/:appid/prices?force=1` | 价格（缓存 6h，过期懒抓） |

## 已知局限

- apps.apple.com 偶尔对 Worker 限流，单区失败不影响其他区
- 首次访问详情需 1–3 秒（18 区并发抓取），之后 6h 内毫秒级
- 价格表覆盖更新，不保留历史
- `npm run dev` 模式无法测试 D1 功能，必须 `npm run preview`

不附属于 Apple Inc.。价格数据来自公开 App Store，仅供参考。

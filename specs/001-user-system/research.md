# 技术调研: 家庭记账本用户系统

**功能分支**: `001-user-system`
**日期**: 2026-02-07

## 调研目标

为家庭记账本的用户系统选择最简单的技术栈，满足以下约束:
- 部署在 Vercel 上（Serverless 环境）
- 现有前端: React 19 + TypeScript + Vite
- 需要: 用户认证、后台数据库、管理员功能
- 宪章原则: 简洁优先、最小依赖、快速交付

## 决策 1: 后端框架

**决策**: Vercel Serverless Functions（api/ 目录约定）

**理由**:
- Vercel 原生支持，零配置
- api/ 目录下每个 .ts 文件自动成为一个 API 端点
- TypeScript 自动编译，无需额外构建步骤
- 与现有 Vite 前端共存于同一仓库

**备选方案**:
- Express.js → 需要额外的服务器进程，不适合 Vercel Serverless
- Next.js API Routes → 需要将整个前端迁移到 Next.js，改动过大
- Hono/Fastify → 额外框架依赖，增加复杂度

## 决策 2: 数据库

**决策**: Vercel Postgres（基于 Neon）

**理由**:
- 从 Vercel 控制台一键创建，环境变量自动注入
- 免费额度 0.5GB，足够 <100 用户使用
- 标准 PostgreSQL，生态成熟
- @vercel/postgres 包专为 Serverless 优化（内置连接池）
- 无需注册额外服务

**备选方案**:
- Turso (libSQL) → 5GB 免费空间更大，但需注册额外服务
- Supabase → 功能过多（自带 Auth/Storage/Realtime），过度复杂
- PlanetScale → 已取消免费额度（2024 年起最低 $29/月）

## 决策 3: 密码哈希

**决策**: bcryptjs

**理由**:
- 纯 JavaScript 实现，无原生 C++ 依赖
- 在 Vercel Serverless 上稳定运行（原生 bcrypt 频繁部署失败）
- bcrypt 算法安全性成熟，无已知漏洞

**备选方案**:
- bcrypt (原生) → C++ 编译在 Vercel Serverless 上不可靠
- argon2 → 同样有原生依赖问题
- @node-rs/bcrypt → Rust 实现，更新活跃但增加复杂性

## 决策 4: JWT 库

**决策**: jose

**理由**:
- 零依赖
- 原生 ESM 支持（Vite 项目必需，jsonwebtoken 不支持 ESM）
- 支持所有运行时（Node.js、Edge、浏览器）
- Promise 风格 API，现代且简洁
- 包体积小，冷启动快

**备选方案**:
- jsonwebtoken → 不支持 ESM（在 Vite 中需要额外配置），
  回调风格 API 过时，多个子依赖

## 决策 5: ORM vs 原生 SQL

**决策**: 原生 SQL（通过 @vercel/postgres）

**理由**:
- 仅 3 张表，ORM 是过度工程
- @vercel/postgres 提供参数化查询，防止 SQL 注入
- 减少一个依赖（符合最小依赖原则）
- SQL 查询直观透明，易于调试

**备选方案**:
- Drizzle ORM → 类型安全，但对 3 张表而言增加不必要的复杂度
- Prisma → 重量级，冷启动慢，schema 文件额外维护成本

## 最终技术栈总结

| 层级 | 技术 | 理由 |
|------|------|------|
| 前端 | React 19 + TypeScript + Vite | 已有，保持不变 |
| 后端 API | Vercel Serverless Functions | 零配置，原生支持 |
| 数据库 | Vercel Postgres (Neon) | 一键创建，免费 |
| 密码哈希 | bcryptjs | 纯 JS，Serverless 兼容 |
| JWT | jose | 零依赖，原生 ESM |
| 部署 | Vercel | 用户指定 |

### 新增依赖清单

**运行时依赖** (3 个):
- `bcryptjs` — 密码哈希
- `jose` — JWT 签发与验证
- `@vercel/postgres` — 数据库客户端

**开发依赖** (2 个):
- `@types/bcryptjs` — TypeScript 类型
- `@vercel/node` — Serverless 函数类型

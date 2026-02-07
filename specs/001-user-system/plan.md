# 实现计划: 家庭记账本用户系统

**分支**: `001-user-system` | **日期**: 2026-02-07 | **规格**: [spec.md](spec.md)
**输入**: 功能规格 `/specs/001-user-system/spec.md`

## 概要

为现有 iOS 风格家庭记账本前端（React 19 + Vite）添加用户系统。
采用 Vercel Serverless Functions 作为后端 API，Vercel Postgres
作为数据库，bcryptjs + jose 实现认证。现有前端从 backup 目录
拷贝到项目根目录，修改数据层从 localStorage 切换为 API 调用，
新增登录/注册页面和管理员页面。

## 技术上下文

**语言/版本**: TypeScript 5.8 + Node.js 18+
**主要依赖**: React 19, Vite 6, bcryptjs, jose, @vercel/postgres
**存储**: Vercel Postgres (Neon)
**测试**: 手动验证（首版，参见 quickstart.md 验证清单）
**目标平台**: Web（移动端竖版优先）
**项目类型**: Web 应用（前端 + Serverless API）
**性能目标**: API 响应 <2 秒，页面加载 <3 秒
**约束**: Vercel Serverless 无持久文件系统，Serverless 冷启动
**规模**: <100 用户，<10 并发

## 宪章合规检查

*门禁: Phase 0 前必须通过。Phase 1 设计后复查。*

| 原则 | 状态 | 说明 |
|------|------|------|
| I. 简洁优先 | ✅ 通过 | 3 个运行时依赖，无 ORM，api/ 目录约定零配置 |
| II. 快速交付 | ✅ 通过 | 复用现有前端，最小改动实现用户系统 |
| III. 中文文档 | ✅ 通过 | 所有文档中文，代码注释中文 |
| IV. 务实测试 | ✅ 通过 | 首版手动验证，quickstart.md 含验证清单 |
| V. 最小依赖 | ✅ 通过 | 新增仅 3 个运行时依赖（bcryptjs, jose, @vercel/postgres） |
| 技术栈约束 | ✅ 通过 | React/TS 已有经验，Vercel 是唯一新平台 |

**复查（Phase 1 后）**: 所有门禁仍然通过。目录嵌套最深 3 层
（api/admin/users/），未超过宪章限制。

## 项目结构

### 文档（本功能）

```text
specs/001-user-system/
├── plan.md              # 本文件
├── spec.md              # 功能规格说明
├── research.md          # 技术调研
├── data-model.md        # 数据模型
├── quickstart.md        # 快速开始指南
├── contracts/
│   └── api.md           # API 接口契约
└── checklists/
    └── requirements.md  # 规格质量清单
```

### 源代码（仓库根目录）

```text
wallet/
├── api/                        # Vercel Serverless Functions
│   ├── auth/
│   │   ├── register.ts         # POST /api/auth/register
│   │   ├── login.ts            # POST /api/auth/login
│   │   └── me.ts               # GET /api/auth/me
│   ├── persons/
│   │   ├── index.ts            # GET/POST /api/persons
│   │   └── [id].ts             # PUT/DELETE /api/persons/:id
│   ├── transactions.ts         # GET/POST /api/transactions
│   └── admin/
│       ├── users.ts            # GET /api/admin/users
│       ├── users/
│       │   └── [id].ts         # DELETE /api/admin/users/:id
│       └── reset-password.ts   # POST /api/admin/reset-password
├── lib/                        # 共享工具（前后端共用类型，后端工具）
│   ├── db.ts                   # 数据库查询封装
│   └── auth.ts                 # JWT 验证中间件
├── App.tsx                     # 前端主组件（来自 backup）
├── index.tsx                   # 前端入口
├── types.ts                    # TypeScript 类型
├── hooks/
│   └── useLongPress.ts         # 长按 Hook
├── index.html                  # Vite 入口
├── package.json
├── vite.config.ts
├── vercel.json                 # Vercel 配置
├── tsconfig.json               # 前端 TypeScript 配置
└── .env.local                  # 环境变量
```

**结构决策**: 采用扁平结构。前端文件保留在根目录（与现有代码
一致），后端 API 放在 api/ 目录（Vercel 约定），共享工具放在
lib/ 目录。不使用 src/ 子目录以避免不必要的嵌套。

## 复杂度追踪

> 无宪章违规，无需记录。

## 关键实现要点

### 认证流程

1. 注册: 前端 POST /api/auth/register → 后端 bcryptjs 哈希
   密码 → 存入 users 表 → 签发 JWT → 返回 token
2. 登录: 前端 POST /api/auth/login → 后端验证密码 → 签发 JWT
3. 会话保持: JWT 存储在 localStorage，每次 API 请求通过
   Authorization: Bearer <token> 携带
4. 管理员判定: 登录时检查 username 是否在 ADMIN_USERNAMES 环境
   变量中，写入 JWT payload 的 isAdmin 字段

### 前端改造要点

1. 新增登录/注册页面组件（保持 iOS 风格）
2. 新增管理员页面组件
3. App.tsx 添加认证状态判断（已登录 → 主界面，未登录 → 登录页）
4. 数据操作从 localStorage 改为 API 调用:
   - 初始化: 登录后 GET /api/persons + GET /api/transactions
   - 增删改成员: POST/PUT/DELETE /api/persons
   - 增减余额: POST /api/transactions + PUT /api/persons/:id
   - 清空余额: POST /api/transactions + PUT /api/persons/:id
5. undo/redo 保持纯前端逻辑，不涉及后端

### Vercel 配置

vercel.json:
```json
{
  "buildCommand": "vite build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### 环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| POSTGRES_URL | 数据库连接串（Vercel 自动注入） | postgres://... |
| JWT_SECRET | JWT 签名密钥 | random-string-here |
| ADMIN_USERNAMES | 管理员用户名列表（逗号分隔） | admin,zhangsan |

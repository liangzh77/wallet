# 快速开始: 家庭记账本

**功能分支**: `001-user-system`
**日期**: 2026-02-07

## 前置条件

- Node.js 18+
- Vercel 账号（https://vercel.com）
- Vercel CLI: `npm i -g vercel`

## 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env.local` 文件:

```env
# Vercel Postgres 连接（从 Vercel 控制台获取）
POSTGRES_URL=postgres://...
POSTGRES_URL_NON_POOLING=postgres://...

# JWT 密钥（自定义随机字符串）
JWT_SECRET=your-random-secret-key-here

# 管理员用户名（逗号分隔多个）
ADMIN_USERNAMES=admin
```

### 3. 初始化数据库

首次运行前，执行建表脚本:

```bash
# 使用 Vercel Postgres 控制台的 SQL Editor
# 或通过 psql 连接后执行 data-model.md 中的建表 SQL
```

### 4. 启动开发服务器

```bash
# 方式一: 使用 Vercel CLI（推荐，前后端一体）
vercel dev

# 方式二: 仅启动前端（API 需单独处理）
npm run dev
```

应用默认运行在 http://localhost:3000

## 部署到 Vercel

### 1. 关联 Vercel 项目

```bash
vercel link
```

### 2. 创建 Vercel Postgres 数据库

1. 进入 Vercel 控制台 → 项目 → Storage
2. 点击 Create Database → Postgres
3. 环境变量会自动注入

### 3. 配置环境变量

在 Vercel 控制台 → Settings → Environment Variables 中添加:

- `JWT_SECRET`: 随机密钥
- `ADMIN_USERNAMES`: 管理员用户名

### 4. 部署

```bash
vercel --prod
```

## 验证清单

- [ ] 访问应用，看到登录页面
- [ ] 注册新账号，自动登录进入主界面
- [ ] 添加家庭成员，刷新页面数据不丢失
- [ ] 增减余额，交易记录正确保存
- [ ] 退出登录后无法访问主界面
- [ ] 使用管理员账号登录，可进入管理页面
- [ ] 管理员可查看用户列表、重置密码、删除用户

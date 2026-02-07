# Wallet 开发指南

从功能计划自动生成。最后更新: 2026-02-07

## 技术栈

- **前端**: React 19 + TypeScript 5.8 + Vite 6
- **后端**: Vercel Serverless Functions (TypeScript)
- **数据库**: Vercel Postgres (Neon)
- **认证**: bcryptjs + jose (JWT)
- **部署**: Vercel

## 项目结构

```text
wallet/
├── api/                # Vercel Serverless Functions (后端 API)
├── lib/                # 共享工具 (数据库、认证)
├── hooks/              # React 自定义 Hooks
├── App.tsx             # 前端主组件
├── index.tsx           # 前端入口
├── types.ts            # TypeScript 类型定义
├── index.html          # Vite 入口
├── vercel.json         # Vercel 配置
└── specs/              # 功能规格文档
```

## 常用命令

```bash
# 开发
npm run dev             # 启动 Vite 开发服务器
vercel dev              # 启动 Vercel 开发环境（含 API）

# 构建
npm run build           # Vite 生产构建

# 部署
vercel --prod           # 部署到 Vercel
```

## 代码风格

- 文档和代码注释使用中文
- 变量名和函数名使用英文
- Git 提交信息使用中文

## 当前功能分支

- `001-user-system`: 添加用户系统（注册/登录/管理员）

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->

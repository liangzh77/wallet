# 任务清单: 家庭记账本用户系统

**输入**: 设计文档 `/specs/001-user-system/`
**前置条件**: plan.md, spec.md, research.md, data-model.md, contracts/

**测试**: 首版手动验证，不生成自动化测试任务（参见 quickstart.md 验证清单）

**组织方式**: 按用户故事分组，支持独立实现和验证

## 格式: `[ID] [P?] [Story?] 描述含文件路径`

- **[P]**: 可并行（不同文件，无依赖）
- **[Story]**: 所属用户故事（US1, US2, US3, US4）
- 路径基于 plan.md 的扁平结构（前端在根目录，API 在 api/）

## Phase 1: 项目初始化

**目的**: 搭建项目结构，拷贝现有前端，安装依赖

- [ ] T001 将 backup/ios-style-family-wallet/ 下所有文件拷贝到项目根目录（App.tsx, index.tsx, types.ts, index.html, hooks/, vite.config.ts, tsconfig.json, package.json）
- [ ] T002 更新 package.json，添加运行时依赖（bcryptjs, jose, @vercel/postgres）和开发依赖（@types/bcryptjs, @vercel/node）
- [ ] T003 [P] 创建 vercel.json 配置文件（buildCommand, outputDirectory, rewrites 规则），参见 plan.md Vercel 配置章节
- [ ] T004 [P] 创建 .env.local 模板文件，包含 POSTGRES_URL, JWT_SECRET, ADMIN_USERNAMES 环境变量占位
- [ ] T005 [P] 创建 api/tsconfig.json，配置 Node.js 目标环境（与前端 tsconfig.json 分离）

---

## Phase 2: 基础设施（阻塞所有用户故事）

**目的**: 数据库连接、认证中间件、共享类型 — 所有 API 端点的前置条件

**⚠️ 关键**: 此阶段未完成前，任何用户故事都不能开始

- [ ] T006 创建 lib/db.ts，封装 @vercel/postgres 连接和建表 SQL 执行函数（参见 data-model.md 建表 SQL）
- [ ] T007 创建 lib/auth.ts，实现 JWT 签发（signToken）和验证（verifyToken）函数，使用 jose 库，包含从请求头提取 token 的辅助函数
- [ ] T008 更新 types.ts，添加 API 相关类型定义：AuthResponse, ApiError, 以及后端用的 JwtPayload（userId, username, isAdmin）

**检查点**: 基础设施就绪，可以开始实现用户故事

---

## Phase 3: 用户故事 1 — 用户注册与登录 (P1) 🎯 MVP

**目标**: 用户可以注册账号、登录、关闭浏览器后保持登录状态

**独立测试**: 注册新账号 → 自动登录进入主界面 → 刷新页面仍保持登录 → 用错误密码登录看到错误提示

### 后端实现

- [ ] T009 [P] [US1] 实现 POST /api/auth/register 注册端点 in api/auth/register.ts — 校验用户名密码非空、用户名唯一性检查、bcryptjs 哈希密码、插入 users 表、检查 ADMIN_USERNAMES 环境变量设置 isAdmin、签发 JWT 返回 token+user（参见 contracts/api.md 注册接口）
- [ ] T010 [P] [US1] 实现 POST /api/auth/login 登录端点 in api/auth/login.ts — 查询用户、bcryptjs 比对密码、签发 JWT 返回 token+user，错误时返回统一提示"用户名或密码错误"（参见 contracts/api.md 登录接口）
- [ ] T011 [P] [US1] 实现 GET /api/auth/me 当前用户端点 in api/auth/me.ts — 验证 JWT、返回用户信息（id, username, isAdmin）（参见 contracts/api.md me 接口）

### 前端实现

- [ ] T012 [US1] 在 App.tsx 中创建登录/注册页面 UI（保持 iOS 风格：圆角输入框、蓝色按钮、玻璃态背景），包含用户名输入、密码输入、确认密码（仅注册）、登录/注册切换按钮、错误提示显示
- [ ] T013 [US1] 在 App.tsx 中添加认证状态管理 — useState 管理 token 和 user，从 localStorage 读取 token 初始化登录状态，调用 /api/auth/me 验证 token 有效性，未登录时显示登录页、已登录时显示主界面

**检查点**: 用户可以注册、登录、保持会话。此时为最小可用产品（MVP）

---

## Phase 4: 用户故事 2 — 云端数据同步 (P2)

**目标**: 家庭成员和交易记录保存在云端数据库，跨设备数据一致

**独立测试**: 登录后添加家庭成员 → 增减余额 → 刷新页面数据不丢失 → 换浏览器登录数据一致

### 后端实现

- [ ] T014 [P] [US2] 实现 GET/POST /api/persons 端点 in api/persons/index.ts — GET 返回当前用户所有家庭成员（WHERE user_id），POST 创建新成员（参见 contracts/api.md 家庭成员接口）
- [ ] T015 [P] [US2] 实现 PUT/DELETE /api/persons/[id] 端点 in api/persons/[id].ts — PUT 更新成员信息（name, dailyWage, balance），DELETE 删除成员（级联删除交易记录），均校验数据归属（参见 contracts/api.md）
- [ ] T016 [P] [US2] 实现 GET/POST /api/transactions 端点 in api/transactions.ts — GET 按 personId 查询交易记录，POST 创建交易记录，均校验 person 归属当前用户（参见 contracts/api.md 交易记录接口）

### 前端改造

- [ ] T017 [US2] 改造 App.tsx 数据初始化逻辑 — 登录成功后调用 GET /api/persons 和 GET /api/transactions 加载数据（替代 localStorage 读取），将返回数据设置到 people 和 transactions state
- [ ] T018 [US2] 改造 App.tsx 家庭成员操作 — 添加成员时调用 POST /api/persons，编辑成员时调用 PUT /api/persons/[id]，删除成员时调用 DELETE /api/persons/[id]（替代直接修改 state + localStorage）
- [ ] T019 [US2] 改造 App.tsx 余额操作 — 点击"应用"按钮时调用 POST /api/transactions 创建交易记录并调用 PUT /api/persons/[id] 更新余额，清空余额同理（+1/-1/+10/-10 按钮仅修改本地 adjustmentAmount state，不触发 API 调用）
- [ ] T020 [US2] 移除 App.tsx 中所有 localStorage 读写逻辑（wallet_people, wallet_txs），改为完全依赖 API 数据

**检查点**: 所有数据通过 API 持久化到云端数据库，localStorage 不再使用

---

## Phase 5: 用户故事 3 — 退出登录 (P3)

**目标**: 用户可以退出登录，退出后无法访问主界面

**独立测试**: 点击退出 → 回到登录页 → 直接访问主页被拦截到登录页

- [ ] T021 [US3] 在 App.tsx 设置页面或底部标签栏添加"退出登录"按钮，点击后清除 localStorage 中的 token、重置 user state 为 null，显示登录页面
- [ ] T022 [US3] 确保 App.tsx 认证状态检查覆盖所有入口 — 无 token 或 /api/auth/me 返回 401 时强制显示登录页

**检查点**: 退出登录功能完整，未登录无法访问数据

---

## Phase 6: 用户故事 4 — 管理员管理用户 (P4)

**目标**: 管理员可以查看所有用户、删除用户、重置密码

**独立测试**: 用 .env 中配置的管理员账号登录 → 看到管理入口 → 查看用户列表 → 重置密码 → 删除用户 → 普通用户看不到管理入口

### 后端实现

- [ ] T023 [P] [US4] 实现 GET /api/admin/users 端点 in api/admin/users.ts — 验证 JWT 且 isAdmin=true，返回所有用户列表（id, username, isAdmin, createdAt），非管理员返回 403（参见 contracts/api.md 管理员接口）
- [ ] T024 [P] [US4] 实现 DELETE /api/admin/users/[id] 端点 in api/admin/users/[id].ts — 验证管理员权限，删除用户（级联删除所有数据），返回 204（参见 contracts/api.md）
- [ ] T025 [P] [US4] 实现 POST /api/admin/reset-password 端点 in api/admin/reset-password.ts — 验证管理员权限，生成随机新密码，bcryptjs 哈希后更新 users 表，返回明文新密码给管理员（参见 contracts/api.md）

### 前端实现

- [ ] T026 [US4] 在 App.tsx 中创建管理员页面 UI（保持 iOS 风格） — 用户列表展示（用户名、注册时间）、每行有"重置密码"和"删除"按钮、重置后弹窗显示新密码、删除前确认弹窗
- [ ] T027 [US4] 在 App.tsx 中添加管理员入口 — 仅当 user.isAdmin=true 时在设置页面或底部标签栏显示"管理"按钮，点击切换到管理员页面，普通用户不可见

**检查点**: 管理员功能完整，权限隔离正确

---

## Phase 7: 收尾与部署

**目的**: 整体验证和生产部署

- [ ] T028 按 quickstart.md 验证清单逐项验证所有功能（注册、登录、数据同步、退出、管理员）
- [ ] T029 部署到 Vercel 并验证生产环境功能正常（vercel --prod）

---

## 依赖关系与执行顺序

### 阶段依赖

- **Phase 1 (初始化)**: 无依赖，立即开始
- **Phase 2 (基础设施)**: 依赖 Phase 1 完成 — **阻塞所有用户故事**
- **Phase 3-6 (用户故事)**: 依赖 Phase 2 完成
  - US1 (注册登录) 必须最先完成（US2-4 都依赖登录功能）
  - US2 (数据同步) 依赖 US1
  - US3 (退出登录) 依赖 US1
  - US4 (管理员) 依赖 US1
- **Phase 7 (收尾)**: 依赖所有用户故事完成

### 用户故事依赖

- **US1 (P1)**: Phase 2 完成后即可开始，无其他依赖
- **US2 (P2)**: 依赖 US1（需要登录后才能测试数据同步）
- **US3 (P3)**: 依赖 US1（需要登录后才能测试退出）
- **US4 (P4)**: 依赖 US1（需要管理员登录后才能测试）
- US3 和 US4 可以并行开发（互不依赖）

### 并行机会

- Phase 1: T003, T004, T005 可并行（不同文件）
- Phase 3 后端: T009, T010, T011 可并行（不同 API 文件）
- Phase 4 后端: T014, T015, T016 可并行（不同 API 文件）
- Phase 6 后端: T023, T024, T025 可并行（不同 API 文件）
- US2 完成后: US3 和 US4 可并行

---

## 并行示例: Phase 3 后端

```bash
# 同时启动 US1 的三个后端端点（不同文件，无依赖）:
Task: "实现 POST /api/auth/register in api/auth/register.ts"
Task: "实现 POST /api/auth/login in api/auth/login.ts"
Task: "实现 GET /api/auth/me in api/auth/me.ts"
```

---

## 实现策略

### MVP 优先（仅 US1）

1. 完成 Phase 1: 初始化
2. 完成 Phase 2: 基础设施（关键 — 阻塞所有后续工作）
3. 完成 Phase 3: US1 注册登录
4. **停下验证**: 注册、登录、会话保持是否正常
5. 可部署为最简版本

### 增量交付

1. Phase 1 + 2 → 基础设施就绪
2. + US1 → 可注册登录（MVP）
3. + US2 → 数据云端同步（核心价值）
4. + US3 + US4 → 退出 + 管理员（完整功能）
5. Phase 7 → 生产部署

---

## 备注

- [P] 任务 = 不同文件，无依赖，可并行执行
- [Story] 标签对应 spec.md 中的用户故事编号
- 每个用户故事可独立完成和验证
- 每完成一个任务或逻辑组后提交代码
- 在任何检查点可停下独立验证该故事

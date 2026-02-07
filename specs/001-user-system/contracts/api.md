# API 接口契约: 家庭记账本用户系统

**功能分支**: `001-user-system`
**日期**: 2026-02-07
**基础路径**: `/api`
**认证方式**: JWT Bearer Token（通过 Authorization 请求头传递）

## 通用约定

- 所有请求/响应使用 JSON 格式
- 认证接口（注册/登录）无需 Token
- 其他接口必须携带 `Authorization: Bearer <token>`
- 管理员接口额外校验 is_admin 标记
- 错误响应统一格式: `{ "error": "错误描述" }`

## 认证接口

### POST /api/auth/register

注册新用户。

**请求体**:
```json
{
  "username": "zhangsan",
  "password": "123456"
}
```

**成功响应** (201):
```json
{
  "token": "eyJhbG...",
  "user": {
    "id": 1,
    "username": "zhangsan",
    "isAdmin": false
  }
}
```

**错误响应**:
- 400: `{ "error": "用户名和密码不能为空" }`
- 409: `{ "error": "该用户名已被占用" }`

---

### POST /api/auth/login

用户登录。

**请求体**:
```json
{
  "username": "zhangsan",
  "password": "123456"
}
```

**成功响应** (200):
```json
{
  "token": "eyJhbG...",
  "user": {
    "id": 1,
    "username": "zhangsan",
    "isAdmin": false
  }
}
```

**错误响应**:
- 401: `{ "error": "用户名或密码错误" }`

---

### GET /api/auth/me

获取当前登录用户信息。**需要认证**。

**成功响应** (200):
```json
{
  "id": 1,
  "username": "zhangsan",
  "isAdmin": false
}
```

**错误响应**:
- 401: `{ "error": "未登录" }`

## 家庭成员接口

### GET /api/persons

获取当前用户的所有家庭成员。**需要认证**。

**成功响应** (200):
```json
[
  {
    "id": 1,
    "name": "我",
    "dailyWage": 100,
    "balance": 500,
    "createdAt": "2026-02-07T10:00:00Z"
  }
]
```

---

### POST /api/persons

创建家庭成员。**需要认证**。

**请求体**:
```json
{
  "name": "小明",
  "dailyWage": 50
}
```

**成功响应** (201):
```json
{
  "id": 2,
  "name": "小明",
  "dailyWage": 50,
  "balance": 0,
  "createdAt": "2026-02-07T10:00:00Z"
}
```

---

### PUT /api/persons/[id]

更新家庭成员信息。**需要认证**。

**请求体**（部分更新）:
```json
{
  "name": "小明改名",
  "dailyWage": 80,
  "balance": 1000
}
```

**成功响应** (200):
```json
{
  "id": 2,
  "name": "小明改名",
  "dailyWage": 80,
  "balance": 1000,
  "createdAt": "2026-02-07T10:00:00Z"
}
```

**错误响应**:
- 404: `{ "error": "成员不存在" }`

---

### DELETE /api/persons/[id]

删除家庭成员（级联删除其交易记录）。**需要认证**。

**成功响应** (204): 无响应体

**错误响应**:
- 404: `{ "error": "成员不存在" }`

## 交易记录接口

### GET /api/transactions?personId=1

获取指定家庭成员的交易记录。**需要认证**。

**查询参数**:
- `personId` (必填): 家庭成员 ID

**成功响应** (200):
```json
[
  {
    "id": 1,
    "personId": 1,
    "type": "add",
    "amount": 100,
    "description": "增加",
    "createdAt": "2026-02-07T10:30:00Z"
  }
]
```

---

### POST /api/transactions

创建交易记录。**需要认证**。

**请求体**:
```json
{
  "personId": 1,
  "type": "add",
  "amount": 100,
  "description": "增加"
}
```

**成功响应** (201):
```json
{
  "id": 2,
  "personId": 1,
  "type": "add",
  "amount": 100,
  "description": "增加",
  "createdAt": "2026-02-07T10:30:00Z"
}
```

**type 枚举值**: `add` | `subtract` | `clear` | `daily_wage`

## 管理员接口

### GET /api/admin/users

获取所有注册用户列表。**需要管理员认证**。

**成功响应** (200):
```json
[
  {
    "id": 1,
    "username": "zhangsan",
    "isAdmin": false,
    "createdAt": "2026-02-07T10:00:00Z"
  }
]
```

**错误响应**:
- 403: `{ "error": "无管理员权限" }`

---

### DELETE /api/admin/users/[id]

删除用户及其所有数据。**需要管理员认证**。

**成功响应** (204): 无响应体

**错误响应**:
- 403: `{ "error": "无管理员权限" }`
- 404: `{ "error": "用户不存在" }`

---

### POST /api/admin/reset-password

重置用户密码。**需要管理员认证**。

**请求体**:
```json
{
  "userId": 2
}
```

**成功响应** (200):
```json
{
  "newPassword": "aB3kX9mQ"
}
```

**错误响应**:
- 403: `{ "error": "无管理员权限" }`
- 404: `{ "error": "用户不存在" }`

## Vercel 文件路由映射

| 文件路径 | URL | 方法 |
|----------|-----|------|
| api/auth/register.ts | /api/auth/register | POST |
| api/auth/login.ts | /api/auth/login | POST |
| api/auth/me.ts | /api/auth/me | GET |
| api/persons/index.ts | /api/persons | GET, POST |
| api/persons/[id].ts | /api/persons/:id | PUT, DELETE |
| api/transactions.ts | /api/transactions | GET, POST |
| api/admin/users.ts | /api/admin/users | GET |
| api/admin/users/[id].ts | /api/admin/users/:id | DELETE |
| api/admin/reset-password.ts | /api/admin/reset-password | POST |

# 家庭钱包 / Family Wallet

## 中文

一个轻量的家庭钱包应用，运行时只需要一个 Go 二进制和一个 SQLite 数据库文件。适合少量用户、低内存、低 CPU 的服务器环境。

### 技术栈

- 后端：Go 标准库 HTTP 服务
- 数据库：SQLite + WAL
- 前端：原生 HTML/CSS/JavaScript，无构建步骤
- 认证：bcrypt 密码哈希 + HS256 JWT

### 本地运行

```bash
go run .
```

默认读取 `config.local.json`。该文件已加入 `.gitignore`，不会提交到仓库。可以复制 `config.example.json` 作为模板。

```json
{
  "addr": "127.0.0.1:18081",
  "dbPath": "wallet-local.db",
  "jwtSecret": "请替换为长随机字符串",
  "adminUsername": "admin",
  "adminPassword": "admin123",
  "adminUsernames": [],
  "bcryptCost": 10
}
```

打开：

```text
http://127.0.0.1:18081
```

### 管理员

管理员账号由配置文件决定，默认是：

```text
admin / admin123
```

管理员只用于用户管理，可以查看用户列表、删除用户、重置用户密码。普通用户登录后只看到自己的钱包成员和流水。

### 构建

```bash
go build -trimpath -ldflags="-s -w" -o wallet .
```

Linux 服务器运行示例：

```bash
WALLET_CONFIG=/var/lib/wallet/config.local.json ./wallet
```

### 测试

```bash
go test ./...
```

### 健康检查

```text
GET /healthz
```

正常返回：

```json
{"ok":true}
```

## English

A lightweight family wallet app. At runtime it only needs one Go binary and one SQLite database file, making it suitable for small-user, low-memory, low-CPU server deployments.

### Stack

- Backend: Go standard-library HTTP server
- Database: SQLite + WAL
- Frontend: Plain HTML/CSS/JavaScript, no build step
- Auth: bcrypt password hashing + HS256 JWT

### Run Locally

```bash
go run .
```

The app reads `config.local.json` by default. This file is ignored by Git. Use `config.example.json` as a template.

```json
{
  "addr": "127.0.0.1:18081",
  "dbPath": "wallet-local.db",
  "jwtSecret": "replace-with-a-long-random-secret",
  "adminUsername": "admin",
  "adminPassword": "admin123",
  "adminUsernames": [],
  "bcryptCost": 10
}
```

Open:

```text
http://127.0.0.1:18081
```

### Admin

The admin account is configured in the local config file. The default is:

```text
admin / admin123
```

The admin account is only for user management: listing users, deleting users, and resetting passwords. Regular users only see their own wallet members and transaction history.

### Build

```bash
go build -trimpath -ldflags="-s -w" -o wallet .
```

Example Linux server command:

```bash
WALLET_CONFIG=/var/lib/wallet/config.local.json ./wallet
```

### Test

```bash
go test ./...
```

### Health Check

```text
GET /healthz
```

Expected response:

```json
{"ok":true}
```

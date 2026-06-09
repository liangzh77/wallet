# Wallet 开发指南

最后更新: 2026-06-09

## 技术栈

- **服务端**: Go 标准库 HTTP 服务
- **数据库**: SQLite + WAL
- **前端**: 原生 HTML/CSS/JavaScript，无构建步骤
- **认证**: bcrypt 密码哈希 + HS256 JWT
- **部署**: 单个 Go 二进制 + 一个 SQLite 数据库文件

## 项目结构

```text
wallet/
├── main.go             # 服务入口，内嵌 web 静态文件
├── internal/app/       # 配置、数据库、认证、API 处理器
├── web/                # 无构建静态前端
├── go.mod              # Go 模块依赖
└── AGENTS.md           # 开发指南
```

## 常用命令

```bash
# 开发运行
go run .

# 指定监听地址和数据库文件
WALLET_ADDR=0.0.0.0:8080 WALLET_DB_PATH=wallet.db JWT_SECRET=请替换为长随机字符串 go run .

# 测试
go test ./...

# 构建 Linux 服务器二进制
go build -trimpath -ldflags="-s -w" -o wallet .
```

## 运行配置

- `WALLET_ADDR`: 监听地址，默认 `127.0.0.1:8080`
- `WALLET_DB_PATH`: SQLite 数据库路径，默认 `wallet.db`
- `JWT_SECRET`: JWT 签名密钥，生产环境必须设置
- `ADMIN_USERNAMES`: 逗号分隔的额外管理员用户名
- `ADMIN_USERNAME`: 默认管理员用户名，默认 `admin`
- `ADMIN_PASSWORD`: 默认管理员密码，默认 `admin123`
- `BCRYPT_COST`: bcrypt 成本，默认 `10`，可在低配服务器上按需调低到 `8`
- `WALLET_CONFIG`: 配置文件路径，默认读取已忽略的 `config.local.json`

推荐通过 `config.local.json` 配置管理员密码、数据库路径和监听端口；环境变量只作为覆盖项。

## 轻量化原则

- 生产运行时不依赖 Node.js、Vite、Vercel 或 Postgres。
- SQLite 使用 WAL、`busy_timeout=5000`、`synchronous=NORMAL` 和外键约束。
- 数据库连接池限制为最多 4 个连接，适合少量用户、低内存占用场景。
- 前端只使用静态文件和原生浏览器 API。

## 代码风格

- 文档和代码注释使用中文
- 变量名和函数名使用英文
- Git 提交信息使用中文

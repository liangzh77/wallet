# 数据模型: 家庭记账本用户系统

**功能分支**: `001-user-system`
**日期**: 2026-02-07
**数据库**: Vercel Postgres (PostgreSQL)

## 实体关系

```
User 1──* Person 1──* Transaction
```

一个用户拥有多个家庭成员，一个家庭成员拥有多条交易记录。
删除用户时级联删除其所有家庭成员和交易记录。

## 表结构

### users（用户表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | SERIAL | PRIMARY KEY | 自增主键 |
| username | VARCHAR(50) | UNIQUE NOT NULL | 用户名，唯一 |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt 哈希后的密码 |
| is_admin | BOOLEAN | DEFAULT FALSE | 是否管理员 |
| created_at | TIMESTAMP | DEFAULT NOW() | 注册时间 |

**唯一性约束**: username 全局唯一
**管理员判定**: 登录时比对 .env 中的 ADMIN_USERNAMES 列表

### persons（家庭成员表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | SERIAL | PRIMARY KEY | 自增主键 |
| user_id | INTEGER | REFERENCES users(id) ON DELETE CASCADE | 所属用户 |
| name | VARCHAR(100) | NOT NULL | 成员姓名 |
| daily_wage | DECIMAL(10,2) | DEFAULT 0 | 日薪 |
| balance | DECIMAL(10,2) | DEFAULT 0 | 当前余额 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |

**级联删除**: 用户被删除时，其所有家庭成员自动删除

### transactions（交易记录表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | SERIAL | PRIMARY KEY | 自增主键 |
| person_id | INTEGER | REFERENCES persons(id) ON DELETE CASCADE | 所属成员 |
| type | VARCHAR(20) | NOT NULL | 类型: add/subtract/clear/daily_wage |
| amount | DECIMAL(10,2) | NOT NULL | 金额 |
| description | VARCHAR(255) | | 描述（如"增加"、"减少"） |
| created_at | TIMESTAMP | DEFAULT NOW() | 交易时间 |

**级联删除**: 家庭成员被删除时，其所有交易记录自动删除
**类型枚举**: add（增加）、subtract（减少）、clear（清空余额）、
daily_wage（日薪）

## 建表 SQL

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE persons (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  daily_wage DECIMAL(10,2) DEFAULT 0,
  balance DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_persons_user_id ON persons(user_id);
CREATE INDEX idx_transactions_person_id ON transactions(person_id);
```

## 数据隔离策略

- 所有查询必须包含 `WHERE user_id = $currentUserId` 条件
- persons 表通过 user_id 关联到当前登录用户
- transactions 表通过 person_id 间接关联到用户（JOIN persons）
- 管理员接口单独鉴权，不复用普通用户的数据查询逻辑

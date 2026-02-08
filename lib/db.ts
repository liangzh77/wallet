import { sql } from '@vercel/postgres';

// 建表 SQL — 首次请求时自动执行
export async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      is_admin BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS persons (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      daily_wage DECIMAL(10,2) DEFAULT 0,
      balance DECIMAL(10,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      type VARCHAR(20) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      description VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE persons ADD COLUMN IF NOT EXISTS last_wage_date DATE`;
  await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS undone BOOLEAN DEFAULT FALSE`;
  await sql`CREATE INDEX IF NOT EXISTS idx_persons_user_id ON persons(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_transactions_person_id ON transactions(person_id)`;
}

export { sql };

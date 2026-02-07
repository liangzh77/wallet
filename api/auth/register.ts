import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { sql, ensureTables } from '../../lib/db.js';
import { signToken, isAdminUsername } from '../../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '方法不允许' });
  }

  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  try {
    await ensureTables();

    // 检查用户名是否已存在
    const existing = await sql`SELECT id FROM users WHERE username = ${username}`;
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: '该用户名已被占用' });
    }

    // 哈希密码
    const passwordHash = await bcrypt.hash(password, 10);
    const isAdmin = isAdminUsername(username);

    // 插入用户
    const result = await sql`
      INSERT INTO users (username, password_hash, is_admin)
      VALUES (${username}, ${passwordHash}, ${isAdmin})
      RETURNING id, username, is_admin, created_at
    `;

    const user = result.rows[0];
    const token = await signToken({
      userId: user.id,
      username: user.username,
      isAdmin: user.is_admin,
    });

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        isAdmin: user.is_admin,
      },
    });
  } catch (err) {
    console.error('注册失败:', err);
    return res.status(500).json({ error: '服务器错误' });
  }
}

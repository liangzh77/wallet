import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { sql, ensureTables } from '../../lib/db';
import { signToken, isAdminUsername } from '../../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '方法不允许' });
  }

  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  try {
    await ensureTables();

    const result = await sql`
      SELECT id, username, password_hash, is_admin FROM users WHERE username = ${username}
    `;

    if (result.rows.length === 0) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 每次登录时重新检查管理员状态（以 .env 为准）
    const isAdmin = isAdminUsername(user.username);
    if (isAdmin !== user.is_admin) {
      await sql`UPDATE users SET is_admin = ${isAdmin} WHERE id = ${user.id}`;
    }

    const token = await signToken({
      userId: user.id,
      username: user.username,
      isAdmin,
    });

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        isAdmin,
      },
    });
  } catch (err) {
    console.error('登录失败:', err);
    return res.status(500).json({ error: '服务器错误' });
  }
}

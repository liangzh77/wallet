import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { sql, ensureTables } from '../../lib/db.js';
import { authenticate } from '../../lib/auth.js';

// 生成 8 位随机密码
function generatePassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '方法不允许' });
  }

  try {
    await ensureTables();
    const user = await authenticate(req);
    if (!user) {
      return res.status(401).json({ error: '未登录' });
    }
    if (!user.isAdmin) {
      return res.status(403).json({ error: '无管理员权限' });
    }

    const { userId } = req.body || {};
    if (!userId) {
      return res.status(400).json({ error: '用户 ID 不能为空' });
    }

    // 检查用户是否存在
    const check = await sql`SELECT id FROM users WHERE id = ${userId}`;
    if (check.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const newPassword = generatePassword();
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await sql`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${userId}`;

    return res.status(200).json({ newPassword });
  } catch (err) {
    console.error('重置密码失败:', err);
    return res.status(500).json({ error: '服务器错误' });
  }
}

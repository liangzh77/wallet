import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, ensureTables } from '../../lib/db.js';
import { authenticate } from '../../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
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

    const result = await sql`
      SELECT id, username, is_admin AS "isAdmin", created_at AS "createdAt"
      FROM users
      ORDER BY created_at ASC
    `;
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('获取用户列表失败:', err);
    return res.status(500).json({ error: '服务器错误' });
  }
}

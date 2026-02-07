import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, ensureTables } from '../../../lib/db.js';
import { authenticate } from '../../../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
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

    const { id } = req.query;
    const userId = Number(id);

    // 检查用户是否存在
    const check = await sql`SELECT id FROM users WHERE id = ${userId}`;
    if (check.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 级联删除（persons 和 transactions 会通过外键级联删除）
    await sql`DELETE FROM users WHERE id = ${userId}`;
    return res.status(204).end();
  } catch (err) {
    console.error('删除用户失败:', err);
    return res.status(500).json({ error: '服务器错误' });
  }
}

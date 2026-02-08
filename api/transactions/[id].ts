import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, ensureTables } from '../../lib/db.js';
import { authenticate } from '../../lib/auth.js';

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

    const { id } = req.query;
    const txId = Number(id);

    // 校验交易记录归属（通过 persons 表关联 user_id）
    const check = await sql`
      SELECT t.id FROM transactions t
      JOIN persons p ON t.person_id = p.id
      WHERE t.id = ${txId} AND p.user_id = ${user.userId}
    `;
    if (check.rows.length === 0) {
      return res.status(404).json({ error: '交易记录不存在' });
    }

    await sql`DELETE FROM transactions WHERE id = ${txId}`;
    return res.status(204).end();
  } catch (err) {
    console.error('删除交易记录失败:', err);
    return res.status(500).json({ error: '服务器错误' });
  }
}

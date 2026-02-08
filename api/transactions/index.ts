import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, ensureTables } from '../../lib/db.js';
import { authenticate } from '../../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await ensureTables();
    const user = await authenticate(req);
    if (!user) {
      return res.status(401).json({ error: '未登录' });
    }

    if (req.method === 'GET') {
      const { personId } = req.query;

      // 支持 personId=all 查询所有成员的交易记录（仅活跃交易 + 是否有可重做的）
      if (personId === 'all') {
        const [txResult, undoneResult] = await Promise.all([
          sql`
            SELECT t.id, t.person_id AS "personId", t.type, t.amount, t.description, t.created_at AS "createdAt"
            FROM transactions t
            JOIN persons p ON t.person_id = p.id
            WHERE p.user_id = ${user.userId} AND t.undone = false
            ORDER BY t.created_at DESC
          `,
          sql`
            SELECT EXISTS(
              SELECT 1 FROM transactions t
              JOIN persons p ON t.person_id = p.id
              WHERE p.user_id = ${user.userId} AND t.undone = true
            ) AS "hasUndone"
          `,
        ]);
        return res.status(200).json({
          transactions: txResult.rows,
          hasUndone: undoneResult.rows[0].hasUndone,
        });
      }

      if (!personId) {
        return res.status(400).json({ error: 'personId 不能为空' });
      }

      // 校验成员归属
      const check = await sql`
        SELECT id FROM persons WHERE id = ${Number(personId)} AND user_id = ${user.userId}
      `;
      if (check.rows.length === 0) {
        return res.status(404).json({ error: '成员不存在' });
      }

      const result = await sql`
        SELECT id, person_id AS "personId", type, amount, description, created_at AS "createdAt"
        FROM transactions
        WHERE person_id = ${Number(personId)} AND undone = false
        ORDER BY created_at DESC
      `;
      return res.status(200).json(result.rows);
    }

    if (req.method === 'POST') {
      const { personId, type, amount, description } = req.body || {};

      if (!personId || !type) {
        return res.status(400).json({ error: '参数不完整' });
      }

      // 校验成员归属
      const check = await sql`
        SELECT id FROM persons WHERE id = ${personId} AND user_id = ${user.userId}
      `;
      if (check.rows.length === 0) {
        return res.status(404).json({ error: '成员不存在' });
      }

      // 新操作前，清除所有已撤销的交易（等同于新操作丢弃 redo 栈）
      await sql`
        DELETE FROM transactions
        WHERE undone = true AND person_id IN (
          SELECT id FROM persons WHERE user_id = ${user.userId}
        )
      `;

      const result = await sql`
        INSERT INTO transactions (person_id, type, amount, description)
        VALUES (${personId}, ${type}, ${amount || 0}, ${description || ''})
        RETURNING id, person_id AS "personId", type, amount, description, created_at AS "createdAt"
      `;
      return res.status(201).json(result.rows[0]);
    }

    return res.status(405).json({ error: '方法不允许' });
  } catch (err) {
    console.error('交易记录接口错误:', err);
    return res.status(500).json({ error: '服务器错误' });
  }
}

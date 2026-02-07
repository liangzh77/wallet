import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, ensureTables } from '../../lib/db';
import { authenticate } from '../../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await ensureTables();
    const user = await authenticate(req);
    if (!user) {
      return res.status(401).json({ error: '未登录' });
    }

    const { id } = req.query;
    const personId = Number(id);

    // 校验成员归属
    const check = await sql`
      SELECT id FROM persons WHERE id = ${personId} AND user_id = ${user.userId}
    `;
    if (check.rows.length === 0) {
      return res.status(404).json({ error: '成员不存在' });
    }

    if (req.method === 'PUT') {
      const { name, dailyWage, balance } = req.body || {};

      // 构建动态更新
      const updates: string[] = [];
      const values: any[] = [];
      if (name !== undefined) { updates.push('name'); values.push(name); }
      if (dailyWage !== undefined) { updates.push('daily_wage'); values.push(dailyWage); }
      if (balance !== undefined) { updates.push('balance'); values.push(balance); }

      if (updates.length === 0) {
        return res.status(400).json({ error: '无更新内容' });
      }

      // 用参数化查询逐个更新（简洁，3 个字段无需动态 SQL）
      if (name !== undefined) await sql`UPDATE persons SET name = ${name} WHERE id = ${personId}`;
      if (dailyWage !== undefined) await sql`UPDATE persons SET daily_wage = ${dailyWage} WHERE id = ${personId}`;
      if (balance !== undefined) await sql`UPDATE persons SET balance = ${balance} WHERE id = ${personId}`;

      const result = await sql`
        SELECT id, name, daily_wage AS "dailyWage", balance, created_at AS "createdAt"
        FROM persons WHERE id = ${personId}
      `;
      return res.status(200).json(result.rows[0]);
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM persons WHERE id = ${personId}`;
      return res.status(204).end();
    }

    return res.status(405).json({ error: '方法不允许' });
  } catch (err) {
    console.error('家庭成员操作错误:', err);
    return res.status(500).json({ error: '服务器错误' });
  }
}

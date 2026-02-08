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
      const result = await sql`
        SELECT id, name, daily_wage AS "dailyWage", balance, last_wage_date AS "lastWageDate", created_at AS "createdAt"
        FROM persons
        WHERE user_id = ${user.userId}
        ORDER BY created_at ASC
      `;
      return res.status(200).json(result.rows);
    }

    if (req.method === 'POST') {
      const { name, dailyWage } = req.body || {};
      if (!name) {
        return res.status(400).json({ error: '姓名不能为空' });
      }

      const result = await sql`
        INSERT INTO persons (user_id, name, daily_wage, balance)
        VALUES (${user.userId}, ${name}, ${dailyWage || 0}, 0)
        RETURNING id, name, daily_wage AS "dailyWage", balance, last_wage_date AS "lastWageDate", created_at AS "createdAt"
      `;
      return res.status(201).json(result.rows[0]);
    }

    return res.status(405).json({ error: '方法不允许' });
  } catch (err) {
    console.error('家庭成员接口错误:', err);
    return res.status(500).json({ error: '服务器错误' });
  }
}

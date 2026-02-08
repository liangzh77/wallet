import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, ensureTables } from '../lib/db.js';
import { authenticate } from '../lib/auth.js';

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

    // 找到最早的已撤销交易
    const txResult = await sql`
      SELECT t.id, t.person_id AS "personId", t.type, t.amount
      FROM transactions t
      JOIN persons p ON t.person_id = p.id
      WHERE p.user_id = ${user.userId} AND t.undone = true
      ORDER BY t.created_at ASC
      LIMIT 1
    `;

    if (txResult.rows.length === 0) {
      return res.status(400).json({ error: '没有可重做的操作' });
    }

    const tx = txResult.rows[0];
    const amount = Number(tx.amount);

    // 获取当前余额
    const personResult = await sql`SELECT balance FROM persons WHERE id = ${tx.personId}`;
    const currentBalance = Number(personResult.rows[0].balance);

    // 计算重做后的余额
    let newBalance: number;
    switch (tx.type) {
      case 'add':
      case 'daily_wage':
        newBalance = currentBalance + amount;
        break;
      case 'subtract':
        newBalance = currentBalance - amount;
        break;
      case 'clear':
        newBalance = 0;
        break;
      default:
        newBalance = currentBalance;
    }

    // 标记为活跃，更新余额
    await sql`UPDATE transactions SET undone = false WHERE id = ${tx.id}`;
    await sql`UPDATE persons SET balance = ${newBalance} WHERE id = ${tx.personId}`;

    return res.status(200).json({ personId: tx.personId });
  } catch (err) {
    console.error('重做操作错误:', err);
    return res.status(500).json({ error: '服务器错误' });
  }
}

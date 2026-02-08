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

    const { action, personId } = req.body || {};
    if (action !== 'undo' && action !== 'redo') {
      return res.status(400).json({ error: 'action 必须是 undo 或 redo' });
    }
    if (!personId) {
      return res.status(400).json({ error: 'personId 不能为空' });
    }

    // 校验成员归属
    const check = await sql`
      SELECT id FROM persons WHERE id = ${personId} AND user_id = ${user.userId}
    `;
    if (check.rows.length === 0) {
      return res.status(404).json({ error: '成员不存在' });
    }

    if (action === 'undo') {
      // 找到该成员最新的活跃交易
      const txResult = await sql`
        SELECT id, person_id AS "personId", type, amount
        FROM transactions
        WHERE person_id = ${personId} AND undone = false
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (txResult.rows.length === 0) {
        return res.status(400).json({ error: '没有可撤销的操作' });
      }

      const tx = txResult.rows[0];
      const amount = Number(tx.amount);

      const personResult = await sql`SELECT balance FROM persons WHERE id = ${personId}`;
      const currentBalance = Number(personResult.rows[0].balance);

      // 计算撤销后的余额
      let newBalance: number;
      switch (tx.type) {
        case 'add':
        case 'daily_wage':
          newBalance = currentBalance - amount;
          break;
        case 'subtract':
          newBalance = currentBalance + amount;
          break;
        case 'clear':
          newBalance = amount; // amount 存储了清空前的余额
          break;
        default:
          newBalance = currentBalance;
      }

      await sql`UPDATE transactions SET undone = true WHERE id = ${tx.id}`;
      await sql`UPDATE persons SET balance = ${newBalance} WHERE id = ${personId}`;

      return res.status(200).json({ personId });
    }

    // action === 'redo'
    // 找到该成员最早的已撤销交易
    const txResult = await sql`
      SELECT id, person_id AS "personId", type, amount
      FROM transactions
      WHERE person_id = ${personId} AND undone = true
      ORDER BY created_at ASC
      LIMIT 1
    `;

    if (txResult.rows.length === 0) {
      return res.status(400).json({ error: '没有可重做的操作' });
    }

    const tx = txResult.rows[0];
    const amount = Number(tx.amount);

    const personResult = await sql`SELECT balance FROM persons WHERE id = ${personId}`;
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

    await sql`UPDATE transactions SET undone = false WHERE id = ${tx.id}`;
    await sql`UPDATE persons SET balance = ${newBalance} WHERE id = ${personId}`;

    return res.status(200).json({ personId });
  } catch (err) {
    console.error('撤销/重做操作错误:', err);
    return res.status(500).json({ error: '服务器错误' });
  }
}

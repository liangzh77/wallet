import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, ensureTables } from '../../lib/db.js';
import { authenticate } from '../../lib/auth.js';

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

    // 获取今天的日期（Asia/Shanghai 时区，YYYY-MM-DD 格式）
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });

    // 查询该用户所有成员
    const persons = await sql`
      SELECT id, daily_wage, balance, last_wage_date
      FROM persons
      WHERE user_id = ${user.userId}
    `;

    const payments: Array<{ personId: number; days: number; amount: number }> = [];

    for (const person of persons.rows) {
      const dailyWage = Number(person.daily_wage);

      // 跳过日薪为 0 的成员
      if (dailyWage <= 0) continue;

      const lastWageDate = person.last_wage_date;

      if (lastWageDate === null || lastWageDate === undefined) {
        // 首次：设置 last_wage_date 为今天，不补发
        await sql`
          UPDATE persons SET last_wage_date = ${today} WHERE id = ${person.id}
        `;
        continue;
      }

      // 计算天数差
      const lastDateStr = typeof lastWageDate === 'string'
        ? lastWageDate.slice(0, 10)
        : new Date(lastWageDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
      const lastDate = new Date(lastDateStr + 'T00:00:00+08:00');
      const todayDate = new Date(today + 'T00:00:00+08:00');
      const diffMs = todayDate.getTime() - lastDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) continue; // 今天已发过

      const totalWage = diffDays * dailyWage;
      const newBalance = Number(person.balance) + totalWage;
      const description = `日薪发放（${diffDays}天 × ¥${dailyWage}）`;

      // 清除该成员的已撤销交易（日薪发放等同于新操作，丢弃该成员的 redo 栈）
      await sql`
        DELETE FROM transactions
        WHERE undone = true AND person_id = ${person.id}
      `;

      // 更新余额和 last_wage_date，插入交易记录
      await sql`UPDATE persons SET balance = ${newBalance}, last_wage_date = ${today} WHERE id = ${person.id}`;
      await sql`
        INSERT INTO transactions (person_id, type, amount, description)
        VALUES (${person.id}, 'daily_wage', ${totalWage}, ${description})
      `;

      payments.push({ personId: person.id, days: diffDays, amount: totalWage });
    }

    return res.status(200).json({ payments, today });
  } catch (err) {
    console.error('日薪检查错误:', err);
    return res.status(500).json({ error: '服务器错误' });
  }
}

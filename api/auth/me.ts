import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate } from '../../lib/auth.js';
import { ensureTables } from '../../lib/db.js';

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

    return res.status(200).json({
      id: user.userId,
      username: user.username,
      isAdmin: user.isAdmin,
    });
  } catch (err) {
    console.error('获取用户信息失败:', err);
    return res.status(500).json({ error: '服务器错误' });
  }
}

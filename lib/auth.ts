import { SignJWT, jwtVerify } from 'jose';
import type { VercelRequest } from '@vercel/node';
import type { JwtPayload } from '../types.js';

const getSecret = () => new TextEncoder().encode(process.env.JWT_SECRET);

// 签发 JWT，有效期 7 天
export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload } as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(getSecret());
}

// 验证 JWT，返回 payload
export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as unknown as JwtPayload;
}

// 从请求头提取并验证 token，返回用户信息
export async function authenticate(req: VercelRequest): Promise<JwtPayload | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    return await verifyToken(auth.slice(7));
  } catch {
    return null;
  }
}

// 检查是否为管理员
export function isAdminUsername(username: string): boolean {
  const admins = (process.env.ADMIN_USERNAMES || '').split(',').map(s => s.trim()).filter(Boolean);
  return admins.includes(username);
}

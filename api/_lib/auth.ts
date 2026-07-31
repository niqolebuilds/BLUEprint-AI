import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHmac } from 'crypto';

const TOKEN_TTL_MINUTES = 480; // 8 hours, same as apps-script/Code.gs

export { randomUUID };

export function generateSalt(): string {
  return randomBytes(16).toString('hex');
}

export function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex');
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  const candidate = Buffer.from(hashPassword(password, salt), 'hex');
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'; // no 0/O/1/l/I
  let pwd = '';
  for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

function getSigningSecret(): string {
  const secret = process.env.AUTH_TOKEN_SECRET;
  if (!secret) throw new Error('AUTH_TOKEN_SECRET is not configured.');
  return secret;
}

function hmac(text: string): string {
  return createHmac('sha256', getSigningSecret()).update(text).digest('hex');
}

export type Level = 'L1' | 'L2' | 'L3' | 'L4' | 'Admin';

export interface TokenPayload {
  u: string; // username
  n: string; // name
  lvl: Level;
  sub: string; // sub-function
  exp: number;
}

export function issueToken(user: { username: string; name: string; level: string; subFunction: string }): string {
  const payload: TokenPayload = {
    u: user.username,
    n: user.name,
    lvl: user.level as Level,
    sub: user.subFunction,
    exp: Date.now() + TOKEN_TTL_MINUTES * 60 * 1000,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${payloadB64}.${hmac(payloadB64)}`;
}

export function verifyToken(token: string | undefined): TokenPayload {
  if (!token || !token.includes('.')) throw new Error('Not signed in.');
  const [payloadB64, signature] = token.split('.');
  if (signature !== hmac(payloadB64)) throw new Error('Invalid session, please sign in again.');
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as TokenPayload;
  if (Date.now() > payload.exp) throw new Error('Session expired, please sign in again.');
  return payload;
}

export function requireAuth(token?: string): TokenPayload {
  return verifyToken(token);
}

export function requireAdmin(token?: string): TokenPayload {
  const payload = verifyToken(token);
  if (payload.lvl !== 'Admin') throw new Error('Admin access required.');
  return payload;
}

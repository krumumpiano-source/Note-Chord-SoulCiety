export const ADMIN_EMAIL = 'krumum.piano@gmail.com';
export const SESSION_HOURS = 24;

export function uuid() { return crypto.randomUUID(); }
export function now() { return new Date().toISOString(); }

export async function hashPassword(pw, salt) {
  const data = new TextEncoder().encode(salt + pw);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function jsonOk(data) {
  return Response.json({ success: true, data });
}

export function jsonErr(msg, status = 400) {
  return Response.json({ success: false, error: msg }, { status });
}

export async function verifyAdmin(db, token) {
  if (!token) return null;
  const s = await db.prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > ?')
    .bind(token, now()).first();
  if (!s || s.role !== 'admin') return null;
  return s;
}

export async function verifyUser(db, token) {
  if (!token) return null;
  return await db.prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > ?')
    .bind(token, now()).first();
}



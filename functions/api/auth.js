import { ADMIN_EMAIL, SESSION_HOURS, uuid, now, hashPassword, jsonOk, jsonErr, verifyUser } from '../_helpers.js';

export async function onRequestGet(context) {
  const db = context.env.DB;
  const url = new URL(context.request.url);
  const action = url.searchParams.get('action');

  if (action === 'verify') {
    const token = url.searchParams.get('token');
    const s = await verifyUser(db, token);
    if (!s) return jsonErr('เซสชันหมดอายุ', 401);
    return jsonOk({ uid: s.uid, email: s.email, name: s.name, role: s.role, package: s.package });
  }
  return jsonErr('Unknown action');
}

export async function onRequestPost(context) {
  const db = context.env.DB;
  const body = await context.request.json();
  const { action } = body;

  if (action === 'register') {
    const { name, email, password } = body;
    if (!name || !email || !password) return jsonErr('กรุณากรอกข้อมูลให้ครบ');
    if (password.length < 6) return jsonErr('รหัสผ่านต้องมีอย่างน้อย 6 ตัว');

    const exists = await db.prepare('SELECT uid FROM users WHERE email = ?').bind(email).first();
    if (exists) return jsonErr('อีเมลนี้ถูกใช้แล้ว');

    const uid = uuid();
    const salt = uuid();
    const hash = await hashPassword(password, salt);
    const isAdmin = email === ADMIN_EMAIL;
    const status = isAdmin ? 'approved' : 'pending';

    await db.prepare(
      'INSERT INTO users (uid, email, name, password_hash, salt, status, package, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(uid, email, name, hash, salt, status, 'free', now()).run();

    if (isAdmin) {
      const token = uuid();
      const exp = new Date(Date.now() + SESSION_HOURS * 3600000).toISOString();
      await db.prepare(
        'INSERT INTO sessions (token, uid, email, name, role, package, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(token, uid, email, name, 'admin', 'free', now(), exp).run();
      return jsonOk({ token, uid, email, name, role: 'admin', package: 'free' });
    }
    return jsonOk({ message: 'สมัครสำเร็จ รอ Admin อนุมัติ' });
  }

  if (action === 'login') {
    const { email, password } = body;
    if (!email || !password) return jsonErr('กรุณากรอกอีเมลและรหัสผ่าน');

    const user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
    if (!user) return jsonErr('ไม่พบบัญชีนี้');

    const hash = await hashPassword(password, user.salt);
    if (hash !== user.password_hash) return jsonErr('รหัสผ่านไม่ถูกต้อง');
    if (user.status === 'pending') return jsonErr('บัญชีรอการอนุมัติ');
    if (user.status === 'rejected') return jsonErr('บัญชีถูกปฏิเสธ');
    if (user.status === 'blocked') return jsonErr('บัญชีถูกบล็อก');

    const token = uuid();
    const role = email === ADMIN_EMAIL ? 'admin' : 'member';
    const exp = new Date(Date.now() + SESSION_HOURS * 3600000).toISOString();
    await db.prepare(
      'INSERT INTO sessions (token, uid, email, name, role, package, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(token, user.uid, user.email, user.name, role, user.package, now(), exp).run();

    return jsonOk({ token, uid: user.uid, email: user.email, name: user.name, role, package: user.package });
  }

  if (action === 'logout') {
    const { token } = body;
    if (token) await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    return jsonOk({ message: 'Logged out' });
  }

  if (action === 'change-password') {
    const { token, old_password, new_password } = body;
    const s = await verifyUser(db, token);
    if (!s) return jsonErr('ไม่ได้เข้าสู่ระบบ', 401);
    if (!new_password || new_password.length < 6) return jsonErr('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัว');

    const user = await db.prepare('SELECT * FROM users WHERE uid = ?').bind(s.uid).first();
    const oldHash = await hashPassword(old_password, user.salt);
    if (oldHash !== user.password_hash) return jsonErr('รหัสผ่านเดิมไม่ถูกต้อง');

    const newSalt = uuid();
    const newHash = await hashPassword(new_password, newSalt);
    await db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE uid = ?')
      .bind(newHash, newSalt, s.uid).run();
    return jsonOk({ message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
  }

  return jsonErr('Unknown action');
}
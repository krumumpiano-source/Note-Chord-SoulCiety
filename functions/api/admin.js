import { ADMIN_EMAIL, uuid, now, hashPassword, jsonOk, jsonErr, verifyAdmin } from '../_helpers.js';

export async function onRequestGet(context) {
  const db = context.env.DB;
  const url = new URL(context.request.url);
  const token = url.searchParams.get('token');
  const action = url.searchParams.get('action');

  const adm = await verifyAdmin(db, token);
  if (!adm) return jsonErr('ไม่มีสิทธิ์', 403);

  if (action === 'list-users') {
    const { results: users } = await db.prepare(
      `SELECT u.uid, u.email, u.name, u.status, u.package, u.created_at,
        (SELECT COUNT(*) FROM favorites f WHERE f.uid = u.uid) as fav_count,
        (SELECT COUNT(*) FROM setlists s WHERE s.uid = u.uid) as set_count,
        (SELECT COUNT(*) FROM recent r WHERE r.uid = u.uid) as rec_count
       FROM users u ORDER BY u.created_at DESC`
    ).all();
    return jsonOk(users);
  }

  if (action === 'list-songs') {
    const { results: songs } = await db.prepare(
      'SELECT id, name, mime_type, uploaded_at FROM songs ORDER BY name'
    ).all();
    return jsonOk(songs);
  }

  return jsonErr('Unknown action');
}

export async function onRequestPost(context) {
  const db = context.env.DB;
  const body = await context.request.json();
  const { action, token } = body;

  const adm = await verifyAdmin(db, token);
  if (!adm) return jsonErr('ไม่มีสิทธิ์', 403);

  if (action === 'approve') {
    await db.prepare("UPDATE users SET status = 'approved' WHERE uid = ?").bind(body.uid).run();
    return jsonOk({ message: 'อนุมัติแล้ว' });
  }
  if (action === 'reject') {
    await db.prepare("UPDATE users SET status = 'rejected' WHERE uid = ?").bind(body.uid).run();
    return jsonOk({ message: 'ปฏิเสธแล้ว' });
  }
  if (action === 'set-package') {
    await db.prepare('UPDATE users SET package = ? WHERE uid = ?').bind(body.package, body.uid).run();
    await db.prepare('UPDATE sessions SET package = ? WHERE uid = ?').bind(body.package, body.uid).run();
    return jsonOk({ message: 'อัพเดทแพ็คเกจแล้ว' });
  }
  if (action === 'block') {
    await db.prepare("UPDATE users SET status = 'blocked' WHERE uid = ?").bind(body.uid).run();
    await db.prepare('DELETE FROM sessions WHERE uid = ?').bind(body.uid).run();
    return jsonOk({ message: 'บล็อกแล้ว' });
  }
  if (action === 'unblock') {
    await db.prepare("UPDATE users SET status = 'approved' WHERE uid = ?").bind(body.uid).run();
    return jsonOk({ message: 'ปลดบล็อกแล้ว' });
  }
  if (action === 'reset-pw') {
    const salt = uuid();
    const hash = await hashPassword('123456', salt);
    await db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE uid = ?')
      .bind(hash, salt, body.uid).run();
    return jsonOk({ message: 'รีเซ็ตรหัสผ่านเป็น 123456' });
  }
  if (action === 'delete-user') {
    const uid = body.uid;
    await db.prepare('DELETE FROM favorites WHERE uid = ?').bind(uid).run();
    await db.prepare('DELETE FROM setlists WHERE uid = ?').bind(uid).run();
    await db.prepare('DELETE FROM recent WHERE uid = ?').bind(uid).run();
    await db.prepare('DELETE FROM sessions WHERE uid = ?').bind(uid).run();
    await db.prepare('DELETE FROM users WHERE uid = ?').bind(uid).run();
    return jsonOk({ message: 'ลบผู้ใช้แล้ว' });
  }
  if (action === 'delete-song') {
    await db.prepare('DELETE FROM favorites WHERE song_url = ?').bind(String(body.song_id)).run();
    await db.prepare('DELETE FROM recent WHERE song_url = ?').bind(String(body.song_id)).run();
    await db.prepare('DELETE FROM songs WHERE id = ?').bind(body.song_id).run();
    return jsonOk({ message: 'ลบเพลงแล้ว' });
  }

  return jsonErr('Unknown action');
}
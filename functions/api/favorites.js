import { uuid, now, jsonOk, jsonErr, verifyUser } from '../_helpers.js';

export async function onRequestGet(context) {
  const db = context.env.DB;
  const url = new URL(context.request.url);
  const token = url.searchParams.get('token');

  const s = await verifyUser(db, token);
  if (!s) return jsonErr('ไม่ได้เข้าสู่ระบบ', 401);

  const { results } = await db.prepare(
    'SELECT song_name, song_url FROM favorites WHERE uid = ? ORDER BY added_at DESC'
  ).bind(s.uid).all();
  return jsonOk(results);
}

export async function onRequestPost(context) {
  const db = context.env.DB;
  const body = await context.request.json();
  const { token, song_name, song_url } = body;

  const s = await verifyUser(db, token);
  if (!s) return jsonErr('ไม่ได้เข้าสู่ระบบ', 401);

  const exists = await db.prepare(
    'SELECT id FROM favorites WHERE uid = ? AND song_url = ?'
  ).bind(s.uid, song_url).first();

  if (exists) {
    await db.prepare('DELETE FROM favorites WHERE uid = ? AND song_url = ?')
      .bind(s.uid, song_url).run();
    return jsonOk({ status: 'removed' });
  }

  await db.prepare(
    'INSERT INTO favorites (id, uid, song_name, song_url, added_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(uuid(), s.uid, song_name, song_url, now()).run();
  return jsonOk({ status: 'added' });
}
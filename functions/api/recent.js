import { uuid, now, jsonOk, jsonErr, verifyUser } from '../_helpers.js';

export async function onRequestGet(context) {
  const db = context.env.DB;
  const url = new URL(context.request.url);
  const token = url.searchParams.get('token');

  const s = await verifyUser(db, token);
  if (!s) return jsonErr('ไม่ได้เข้าสู่ระบบ', 401);

  const { results } = await db.prepare(
    'SELECT song_name, song_url, viewed_at FROM recent WHERE uid = ? ORDER BY viewed_at DESC LIMIT 50'
  ).bind(s.uid).all();
  return jsonOk(results);
}

export async function onRequestPost(context) {
  const db = context.env.DB;
  const body = await context.request.json();
  const { token, song_name, song_url } = body;

  const s = await verifyUser(db, token);
  if (!s) return jsonErr('ไม่ได้เข้าสู่ระบบ', 401);

  await db.prepare('DELETE FROM recent WHERE uid = ? AND song_url = ?')
    .bind(s.uid, song_url).run();

  await db.prepare(
    'INSERT INTO recent (id, uid, song_name, song_url, viewed_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(uuid(), s.uid, song_name, song_url, now()).run();

  const { count } = await db.prepare(
    'SELECT COUNT(*) as count FROM recent WHERE uid = ?'
  ).bind(s.uid).first();

  if (count > 50) {
    await db.prepare(
      `DELETE FROM recent WHERE id IN (
        SELECT id FROM recent WHERE uid = ? ORDER BY viewed_at DESC LIMIT -1 OFFSET 50
      )`
    ).bind(s.uid).run();
  }

  return jsonOk({ message: 'ok' });
}
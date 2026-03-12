import { uuid, now, jsonOk, jsonErr, verifyUser } from '../_helpers.js';

export async function onRequestGet(context) {
  const db = context.env.DB;
  const url = new URL(context.request.url);
  const token = url.searchParams.get('token');

  const s = await verifyUser(db, token);
  if (!s) return jsonErr('ไม่ได้เข้าสู่ระบบ', 401);

  const { results } = await db.prepare(
    'SELECT id, name, songs, updated_at FROM setlists WHERE uid = ? ORDER BY updated_at DESC'
  ).bind(s.uid).all();

  const list = results.map(r => ({
    id: r.id, name: r.name, songs: JSON.parse(r.songs || '[]'), updated_at: r.updated_at
  }));
  return jsonOk(list);
}

export async function onRequestPost(context) {
  const db = context.env.DB;
  const body = await context.request.json();
  const { token, action } = body;

  const s = await verifyUser(db, token);
  if (!s) return jsonErr('ไม่ได้เข้าสู่ระบบ', 401);

  if (action === 'save') {
    const { setlist_id, name, songs_json } = body;
    const songsStr = typeof songs_json === 'string' ? songs_json : JSON.stringify(songs_json || []);

    if (setlist_id) {
      await db.prepare('UPDATE setlists SET name = ?, songs = ?, updated_at = ? WHERE id = ? AND uid = ?')
        .bind(name, songsStr, now(), setlist_id, s.uid).run();
      return jsonOk({ id: setlist_id });
    }

    const newId = uuid();
    await db.prepare(
      'INSERT INTO setlists (id, uid, name, songs, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(newId, s.uid, name, songsStr, now()).run();
    return jsonOk({ id: newId });
  }

  if (action === 'delete') {
    await db.prepare('DELETE FROM setlists WHERE id = ? AND uid = ?')
      .bind(body.setlist_id, s.uid).run();
    return jsonOk({ message: 'ลบแล้ว' });
  }

  return jsonErr('Unknown action');
}
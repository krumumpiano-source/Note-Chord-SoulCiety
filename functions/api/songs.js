import { jsonOk, jsonErr, verifyUser, uint8ToBase64 } from '../_helpers.js';

export async function onRequestGet(context) {
  const db = context.env.DB;
  const r2 = context.env.SONGS;
  const url = new URL(context.request.url);
  const token = url.searchParams.get('token');
  const id = url.searchParams.get('id');

  if (id) {
    const s = await verifyUser(db, token);
    if (!s) return jsonErr('ไม่ได้เข้าสู่ระบบ', 401);

    const song = await db.prepare('SELECT * FROM songs WHERE id = ?').bind(id).first();
    if (!song) return jsonErr('ไม่พบเพลง');

    const obj = await r2.get(song.r2_key);
    if (!obj) return jsonErr('ไม่พบไฟล์เพลง');

    const buf = await obj.arrayBuffer();
    const content = uint8ToBase64(new Uint8Array(buf));
    return jsonOk({ content, mimeType: song.mime_type });
  }

  const { results } = await db.prepare('SELECT id, name FROM songs ORDER BY name').all();
  const list = results.map(r => ({ name: r.name, url: String(r.id) }));
  return jsonOk(list);
}
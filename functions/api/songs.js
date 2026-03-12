import { jsonOk, jsonErr, verifyUser } from '../_helpers.js';

export async function onRequestGet(context) {
  const db = context.env.DB;
  const url = new URL(context.request.url);
  const token = url.searchParams.get('token');
  const id = url.searchParams.get('id');

  if (id) {
    const s = await verifyUser(db, token);
    if (!s) return jsonErr('ไม่ได้เข้าสู่ระบบ', 401);

    const song = await db.prepare('SELECT * FROM songs WHERE id = ?').bind(id).first();
    if (!song) return jsonErr('ไม่พบเพลง');

    if (song.mime_type === 'drive/preview') {
      return jsonOk({ driveUrl: song.file_data });
    }
    return jsonOk({ content: song.file_data, mimeType: song.mime_type });
  }

  const { results } = await db.prepare(
    "SELECT id, name, CASE WHEN mime_type = 'drive/preview' THEN file_data ELSE NULL END AS drive_url FROM songs ORDER BY name"
  ).all();
  const list = results.map(r => ({
    name: r.name,
    url: r.drive_url || String(r.id)
  }));
  return jsonOk({ songs: list, total: list.length });
}
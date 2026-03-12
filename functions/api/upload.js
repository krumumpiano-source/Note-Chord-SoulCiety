import { now, jsonOk, jsonErr, verifyAdmin } from '../_helpers.js';

export async function onRequestPost(context) {
  const db = context.env.DB;
  const body = await context.request.json();
  const { token, name, base64, mime_type } = body;

  const adm = await verifyAdmin(db, token);
  if (!adm) return jsonErr('ไม่มีสิทธิ์', 403);
  if (!name || !base64 || !mime_type) return jsonErr('ข้อมูลไม่ครบ');

  await db.prepare(
    'INSERT INTO songs (name, mime_type, file_data, uploaded_at) VALUES (?, ?, ?, ?)'
  ).bind(name, mime_type, base64, now()).run();

  return jsonOk({ message: 'อัพโหลดสำเร็จ' });
}
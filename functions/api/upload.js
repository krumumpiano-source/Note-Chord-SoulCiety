import { uuid, now, jsonOk, jsonErr, verifyAdmin, base64ToUint8 } from '../_helpers.js';

export async function onRequestPost(context) {
  const db = context.env.DB;
  const r2 = context.env.SONGS;
  const body = await context.request.json();
  const { token, name, base64, mime_type } = body;

  const adm = await verifyAdmin(db, token);
  if (!adm) return jsonErr('ไม่มีสิทธิ์', 403);
  if (!name || !base64 || !mime_type) return jsonErr('ข้อมูลไม่ครบ');

  const r2Key = `songs/${uuid()}`;
  const binary = base64ToUint8(base64);

  await r2.put(r2Key, binary.buffer, {
    httpMetadata: { contentType: mime_type }
  });

  await db.prepare(
    'INSERT INTO songs (name, mime_type, r2_key, uploaded_at) VALUES (?, ?, ?, ?)'
  ).bind(name, mime_type, r2Key, now()).run();

  return jsonOk({ message: 'อัพโหลดสำเร็จ' });
}
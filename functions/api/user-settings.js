import { jsonOk, jsonErr, verifyUser, now } from '../_helpers.js';

// Validate Google Drive folder URL (must be drive.google.com with /folders/ path)
function isValidDriveUrl(url) {
  if (!url) return true; // empty = clear the setting
  try {
    const u = new URL(url);
    return u.hostname === 'drive.google.com' && /\/folders\/[a-zA-Z0-9_-]+/.test(u.pathname);
  } catch { return false; }
}

// GET /api/user-settings?token=... — returns the authenticated user's own settings
export async function onRequestGet(context) {
  const db = context.env.DB;
  const url = new URL(context.request.url);
  const token = url.searchParams.get('token');

  const user = await verifyUser(db, token);
  if (!user) return jsonErr('ไม่ได้รับอนุญาต', 403);

  const row = await db.prepare(
    'SELECT google_drive_url FROM user_settings WHERE uid = ?'
  ).bind(user.uid).first();

  return jsonOk({
    google_drive_url: row ? row.google_drive_url : ''
  });
}

// POST /api/user-settings — save the authenticated user's own Drive folder URL
export async function onRequestPost(context) {
  const db = context.env.DB;
  let body;
  try {
    body = await context.request.json();
  } catch {
    return jsonErr('ข้อมูล JSON ไม่ถูกต้อง');
  }

  const token = body.token;
  const user = await verifyUser(db, token);
  if (!user) return jsonErr('ไม่ได้รับอนุญาต', 403);

  const driveUrl = (body.google_drive_url ?? '').trim();

  if (!isValidDriveUrl(driveUrl)) {
    return jsonErr('Google Drive URL ไม่ถูกต้อง — ต้องเป็นลิงก์โฟลเดอร์จาก drive.google.com/drive/folders/...');
  }

  const ts = now();
  await db.prepare(
    `INSERT INTO user_settings (uid, google_sheet_url, google_drive_url, created_at, updated_at)
     VALUES (?, '', ?, ?, ?)
     ON CONFLICT(uid) DO UPDATE SET
       google_drive_url = excluded.google_drive_url,
       updated_at = excluded.updated_at`
  ).bind(user.uid, driveUrl, ts, ts).run();

  return jsonOk({
    message: 'บันทึกการตั้งค่าเรียบร้อย',
    google_drive_url: driveUrl
  });
}

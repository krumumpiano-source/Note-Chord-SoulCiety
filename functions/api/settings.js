import { jsonOk, jsonErr, verifyAdmin, verifyUser, now } from '../_helpers.js';

// GET /api/settings — Read settings (admin sees all, user sees public)
export async function onRequestGet(context) {
  const db = context.env.DB;
  const token = context.request.headers.get('Authorization') || context.request.url.searchParams.get('token');
  const user = await verifyUser(db, token);

  if (!user) return jsonErr('ไม่ได้รับอนุญาต', 403);

  // Non-admin users can only read 'google_sheet_url' and 'google_drive_folder'
  if (user.role === 'admin') {
    const { results } = await db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const row of results) {
      settings[row.key] = row.value;
    }
    return jsonOk({ settings });
  } else {
    // Regular users can read the sheet URL
    const sheetRow = await db.prepare("SELECT value FROM settings WHERE key = 'google_sheet_url'").first();
    const driveRow = await db.prepare("SELECT value FROM settings WHERE key = 'google_drive_folder'").first();
    return jsonOk({
      settings: {
        google_sheet_url: sheetRow ? sheetRow.value : '',
        google_drive_folder: driveRow ? driveRow.value : ''
      }
    });
  }
}

// POST /api/settings — Save settings (admin only)
export async function onRequestPost(context) {
  const db = context.env.DB;
  const body = await context.request.json();
  const adm = await verifyAdmin(db, body.token);
  if (!adm) return jsonErr('ไม่มีสิทธิ์ — เฉพาะ Admin เท่านั้น', 403);

  const allowedKeys = ['google_sheet_url', 'google_drive_folder'];
  const nowStr = now();

  try {
    const stmt = db.prepare(
      'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)'
    );

    const binds = [];
    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        binds.push(stmt.bind(key, body[key], nowStr));
      }
    }

    if (binds.length > 0) {
      await db.batch(binds);
    }

    // Return all settings after save
    const { results } = await db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const row of results) {
      settings[row.key] = row.value;
    }

    return jsonOk({ settings, message: 'บันทึกการตั้งค่าเรียบร้อย' });
  } catch (e) {
    return jsonErr('ไม่สามารถบันทึกการตั้งค่า: ' + e.message);
  }
}
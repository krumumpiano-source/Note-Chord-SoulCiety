import { jsonOk, jsonErr, verifyAdmin, now } from '../_helpers.js';

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/17znwgPpX-Kp4dcGRRWDtzyGfIrdh_DAZoNxA9c2o0wg/gviz/tq?tqx=out:csv&sheet=SheetMusic_Index';
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Parse Google Sheet CSV into [{name, url}]
function parseCsv(csv) {
  const songs = [];
  const regex = /"([^"]+)","(https:\/\/drive\.google\.com\/file\/d\/[^"]+)"/g;
  let m;
  while ((m = regex.exec(csv)) !== null) {
    songs.push({ name: m[1], url: m[2] });
  }
  return songs;
}

// Core sync logic — callable from anywhere
export async function syncFromSheet(db) {
  const res = await fetch(SHEET_CSV_URL);
  if (!res.ok) throw new Error('Failed to fetch Google Sheet: ' + res.status);
  const csv = await res.text();
  const songs = parseCsv(csv);
  if (songs.length === 0) throw new Error('No songs parsed from CSV');

  // Get existing drive songs from D1
  const { results: existing } = await db.prepare(
    "SELECT file_data FROM songs WHERE mime_type = 'drive/preview'"
  ).all();
  const existingUrls = new Set(existing.map(r => r.file_data));
  const sheetUrls = new Set(songs.map(s => s.url));

  // Find new songs (in sheet but not in D1)
  const toAdd = songs.filter(s => !existingUrls.has(s.url));

  // Find removed songs (in D1 but not in sheet)
  const toRemove = [...existingUrls].filter(u => !sheetUrls.has(u));

  const ts = now();

  // Batch insert new songs
  if (toAdd.length > 0) {
    const stmt = db.prepare(
      "INSERT INTO songs (name, mime_type, file_data, uploaded_at) VALUES (?, 'drive/preview', ?, ?)"
    );
    const batches = [];
    for (let i = 0; i < toAdd.length; i += 50) {
      const batch = toAdd.slice(i, i + 50).map(s => stmt.bind(s.name, s.url, ts));
      batches.push(db.batch(batch));
    }
    await Promise.all(batches);
  }

  // Batch delete removed songs
  if (toRemove.length > 0) {
    const stmt = db.prepare(
      "DELETE FROM songs WHERE mime_type = 'drive/preview' AND file_data = ?"
    );
    const batches = [];
    for (let i = 0; i < toRemove.length; i += 50) {
      const batch = toRemove.slice(i, i + 50).map(u => stmt.bind(u));
      batches.push(db.batch(batch));
    }
    await Promise.all(batches);
  }

  // Update sync timestamp
  await db.prepare(
    "INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('last_sync', ?)"
  ).bind(ts).run();

  return { added: toAdd.length, removed: toRemove.length, total: songs.length };
}

// Check if sync is needed (>5 min since last sync)
export async function shouldSync(db) {
  const row = await db.prepare("SELECT value FROM sync_meta WHERE key = 'last_sync'").first();
  if (!row) return true;
  const last = new Date(row.value).getTime();
  return (Date.now() - last) > SYNC_INTERVAL_MS;
}

// Admin manual trigger: POST /api/sync-songs
export async function onRequestPost(context) {
  const db = context.env.DB;
  const body = await context.request.json();
  const adm = await verifyAdmin(db, body.token);
  if (!adm) return jsonErr('ไม่มีสิทธิ์', 403);

  try {
    const result = await syncFromSheet(db);
    return jsonOk(result);
  } catch (e) {
    return jsonErr('Sync failed: ' + e.message);
  }
}

import { jsonOk, jsonErr, verifyUser } from '../_helpers.js';
import { shouldSync, syncFromSheet } from './sync-songs.js';

// Extract Google Drive folder ID from a folder URL
// Supports: /drive/folders/{id} and /drive/u/0/folders/{id}
function extractFolderId(url) {
  const m = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

// Strip file extension from a filename to use as song name
// e.g. "ยังรัก (Bb).pdf" → "ยังรัก (Bb)"
function nameFromFilename(filename) {
  return filename.replace(/\.[^.]+$/, '').trim();
}

// List files in a Drive folder using Drive API v3 (API key, no OAuth)
// Returns [{name, url}] or throws on error
async function listDriveFolder(folderId, apiKey) {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType)',
    pageSize: '1000',
    orderBy: 'name',
    key: apiKey
  });
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Drive API ${res.status}: ${err.error?.message || res.statusText}`);
  }
  const data = await res.json();
  const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  return (data.files || [])
    .filter(f => allowed.includes(f.mimeType))
    .map(f => ({
      name: nameFromFilename(f.name),
      url: `https://drive.google.com/file/d/${f.id}/preview`
    }));
}

export async function onRequestGet(context) {
  const db = context.env.DB;
  const apiKey = context.env.GOOGLE_DRIVE_API_KEY || context.env.GOOGLE_API_KEY || '';
  const url = new URL(context.request.url);
  const token = url.searchParams.get('token');
  const id = url.searchParams.get('id');

  // Auto-sync global songs from Google Sheet if stale (>5 min)
  try {
    if (await shouldSync(db)) {
      context.waitUntil(syncFromSheet(db));
    }
  } catch (_) { /* ignore sync errors, serve cached data */ }

  if (id) {
    const s = await verifyUser(db, token);
    if (!s) return jsonErr('ไม่ได้เข้าสู่ระบบ', 401);

    // If id is a full Google Drive preview URL, return it directly
    if (id.startsWith('https://drive.google.com/')) {
      return jsonOk({ driveUrl: id });
    }

    const song = await db.prepare('SELECT * FROM songs WHERE id = ?').bind(Number(id)).first();
    if (!song) return jsonErr('ไม่พบเพลง');

    if (song.mime_type === 'drive/preview') {
      return jsonOk({ driveUrl: song.file_data });
    }
    return jsonOk({ content: song.file_data, mimeType: song.mime_type });
  }

  // Song list — serve from user's own Drive folder if configured
  if (token && apiKey) {
    const user = await verifyUser(db, token);
    if (user) {
      const userCfg = await db.prepare(
        'SELECT google_drive_url FROM user_settings WHERE uid = ?'
      ).bind(user.uid).first();

      if (userCfg && userCfg.google_drive_url) {
        const folderId = extractFolderId(userCfg.google_drive_url);
        if (folderId) {
          try {
            const driveSongs = await listDriveFolder(folderId, apiKey);
            if (driveSongs.length > 0) {
              return jsonOk({ songs: driveSongs, total: driveSongs.length, source: 'drive' });
            }
            // Empty folder — fall through to global songs
          } catch (e) {
            // Drive unavailable (403 = not public, no API key, etc.) — fall through
            console.error('[songs] Drive API error:', e.message);
          }
        }
      }
    }
  }

  // Default: global songs from D1
  const { results } = await db.prepare(
    "SELECT id, name, CASE WHEN mime_type = 'drive/preview' THEN file_data ELSE NULL END AS drive_url FROM songs ORDER BY name"
  ).all();
  const list = results.map(r => ({
    name: r.name,
    url: r.drive_url || String(r.id)
  }));
  return jsonOk({ songs: list, total: list.length });
}
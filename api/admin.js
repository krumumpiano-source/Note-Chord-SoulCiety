const { getDb } = require('../lib/db');
const { uuid, now, hashPassword, jsonOk, jsonErr, ADMIN_EMAIL, verifyAdmin, cors } = require('../lib/helpers');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  const db = getDb();

  if (req.method === 'GET') {
    const { action, token } = req.query;
    switch (action) {
      case 'list-users': return await handleListUsers(db, token, res);
      case 'list-songs': return await handleListSongs(db, token, res);
      default: return res.status(400).json(jsonErr('Unknown action'));
    }
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    switch (body.action) {
      case 'approve':     return await handleApprove(db, body, res);
      case 'reject':      return await handleReject(db, body, res);
      case 'set-package': return await handleSetPackage(db, body, res);
      case 'block':       return await handleBlock(db, body, res);
      case 'unblock':     return await handleUnblock(db, body, res);
      case 'reset-pw':    return await handleResetPassword(db, body, res);
      case 'delete-user': return await handleDeleteUser(db, body, res);
      case 'delete-song': return await handleDeleteSong(db, body, res);
      default: return res.status(400).json(jsonErr('Unknown action'));
    }
  }
  return res.status(405).json(jsonErr('Method not allowed'));
};

async function handleListUsers(db, token, res) {
  if (!await verifyAdmin(db, token)) return res.json(jsonErr('\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e23\u0e31\u0e1a\u0e2d\u0e19\u0e38\u0e0d\u0e32\u0e15', 403));
  const users = (await db.execute('SELECT uid, email, name, status, package, created_at FROM users')).rows;
  const favs = (await db.execute('SELECT uid FROM favorites')).rows;
  const sets = (await db.execute('SELECT uid FROM setlists')).rows;
  const recs = (await db.execute('SELECT uid FROM recent')).rows;

  const list = users.map(u => ({
    uid: u.uid, email: u.email, name: u.name, status: u.status,
    package: u.package || 'free', created_at: u.created_at,
    fav_count: favs.filter(f => f.uid === u.uid).length,
    setlist_count: sets.filter(s => s.uid === u.uid).length,
    recent_count: recs.filter(r => r.uid === u.uid).length
  }));
  res.json(jsonOk({ users: list }));
}

async function handleListSongs(db, token, res) {
  if (!await verifyAdmin(db, token)) return res.json(jsonErr('\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e23\u0e31\u0e1a\u0e2d\u0e19\u0e38\u0e0d\u0e32\u0e15', 403));
  const songs = (await db.execute('SELECT id, name, mime_type, uploaded_at FROM songs ORDER BY name')).rows;
  res.json(jsonOk({ songs }));
}

async function handleApprove(db, body, res) {
  if (!await verifyAdmin(db, body.token)) return res.json(jsonErr('\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e23\u0e31\u0e1a\u0e2d\u0e19\u0e38\u0e0d\u0e32\u0e15', 403));
  if (!body.uid) return res.json(jsonErr('\u0e44\u0e21\u0e48\u0e21\u0e35 uid'));
  await db.execute({ sql: 'UPDATE users SET status = ? WHERE uid = ?', args: ['approved', body.uid] });
  res.json(jsonOk({ message: '\u0e2d\u0e19\u0e38\u0e21\u0e31\u0e15\u0e34\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08' }));
}

async function handleReject(db, body, res) {
  if (!await verifyAdmin(db, body.token)) return res.json(jsonErr('\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e23\u0e31\u0e1a\u0e2d\u0e19\u0e38\u0e0d\u0e32\u0e15', 403));
  if (!body.uid) return res.json(jsonErr('\u0e44\u0e21\u0e48\u0e21\u0e35 uid'));
  await db.execute({ sql: 'UPDATE users SET status = ? WHERE uid = ?', args: ['rejected', body.uid] });
  res.json(jsonOk({ message: '\u0e1b\u0e0f\u0e34\u0e40\u0e2a\u0e18\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08' }));
}

async function handleSetPackage(db, body, res) {
  if (!await verifyAdmin(db, body.token)) return res.json(jsonErr('\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e23\u0e31\u0e1a\u0e2d\u0e19\u0e38\u0e0d\u0e32\u0e15', 403));
  if (!body.uid || !body.package) return res.json(jsonErr('\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e44\u0e21\u0e48\u0e04\u0e23\u0e1a'));
  if (!['free', 'silver', 'gold'].includes(body.package)) return res.json(jsonErr('Package \u0e44\u0e21\u0e48\u0e16\u0e39\u0e01\u0e15\u0e49\u0e2d\u0e07'));
  await db.execute({ sql: 'UPDATE users SET package = ? WHERE uid = ?', args: [body.package, body.uid] });
  res.json(jsonOk({ message: '\u0e40\u0e1b\u0e25\u0e35\u0e48\u0e22\u0e19 package \u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08' }));
}

async function handleBlock(db, body, res) {
  if (!await verifyAdmin(db, body.token)) return res.json(jsonErr('\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e23\u0e31\u0e1a\u0e2d\u0e19\u0e38\u0e0d\u0e32\u0e15', 403));
  if (!body.uid) return res.json(jsonErr('\u0e44\u0e21\u0e48\u0e21\u0e35 uid'));
  const user = await db.execute({ sql: 'SELECT email FROM users WHERE uid = ?', args: [body.uid] });
  if (user.rows.length === 0) return res.json(jsonErr('\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49'));
  if (user.rows[0].email === ADMIN_EMAIL) return res.json(jsonErr('\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e1a\u0e25\u0e47\u0e2d\u0e01 Admin \u0e44\u0e14\u0e49'));
  await db.execute({ sql: 'UPDATE users SET status = ? WHERE uid = ?', args: ['blocked', body.uid] });
  await db.execute({ sql: 'DELETE FROM sessions WHERE uid = ?', args: [body.uid] });
  res.json(jsonOk({ message: '\u0e1a\u0e25\u0e47\u0e2d\u0e01\u0e2a\u0e21\u0e32\u0e0a\u0e34\u0e01\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08' }));
}

async function handleUnblock(db, body, res) {
  if (!await verifyAdmin(db, body.token)) return res.json(jsonErr('\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e23\u0e31\u0e1a\u0e2d\u0e19\u0e38\u0e0d\u0e32\u0e15', 403));
  if (!body.uid) return res.json(jsonErr('\u0e44\u0e21\u0e48\u0e21\u0e35 uid'));
  await db.execute({ sql: 'UPDATE users SET status = ? WHERE uid = ?', args: ['approved', body.uid] });
  res.json(jsonOk({ message: '\u0e1b\u0e25\u0e14\u0e1a\u0e25\u0e47\u0e2d\u0e01\u0e2a\u0e21\u0e32\u0e0a\u0e34\u0e01\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08' }));
}

async function handleResetPassword(db, body, res) {
  if (!await verifyAdmin(db, body.token)) return res.json(jsonErr('\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e23\u0e31\u0e1a\u0e2d\u0e19\u0e38\u0e0d\u0e32\u0e15', 403));
  if (!body.uid || !body.new_password) return res.json(jsonErr('\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e44\u0e21\u0e48\u0e04\u0e23\u0e1a'));
  if (body.new_password.length < 6) return res.json(jsonErr('\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19\u0e15\u0e49\u0e2d\u0e07\u0e21\u0e35\u0e2d\u0e22\u0e48\u0e32\u0e07\u0e19\u0e49\u0e2d\u0e22 6 \u0e15\u0e31\u0e27\u0e2d\u0e31\u0e01\u0e29\u0e23'));
  const newSalt = uuid(), newHash = hashPassword(body.new_password, newSalt);
  await db.execute({ sql: 'UPDATE users SET password_hash = ?, salt = ? WHERE uid = ?', args: [newHash, newSalt, body.uid] });
  await db.execute({ sql: 'DELETE FROM sessions WHERE uid = ?', args: [body.uid] });
  res.json(jsonOk({ message: '\u0e23\u0e35\u0e40\u0e0b\u0e47\u0e15\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08' }));
}

async function handleDeleteUser(db, body, res) {
  if (!await verifyAdmin(db, body.token)) return res.json(jsonErr('\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e23\u0e31\u0e1a\u0e2d\u0e19\u0e38\u0e0d\u0e32\u0e15', 403));
  if (!body.uid) return res.json(jsonErr('\u0e44\u0e21\u0e48\u0e21\u0e35 uid'));
  const user = await db.execute({ sql: 'SELECT name, email FROM users WHERE uid = ?', args: [body.uid] });
  if (user.rows.length === 0) return res.json(jsonErr('\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49'));
  if (user.rows[0].email === ADMIN_EMAIL) return res.json(jsonErr('\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e25\u0e1a Admin \u0e44\u0e14\u0e49'));

  const uid = body.uid;
  await db.execute({ sql: 'DELETE FROM recent WHERE uid = ?', args: [uid] });
  await db.execute({ sql: 'DELETE FROM setlists WHERE uid = ?', args: [uid] });
  await db.execute({ sql: 'DELETE FROM favorites WHERE uid = ?', args: [uid] });
  await db.execute({ sql: 'DELETE FROM sessions WHERE uid = ?', args: [uid] });
  await db.execute({ sql: 'DELETE FROM users WHERE uid = ?', args: [uid] });

  res.json(jsonOk({ message: '\u0e25\u0e1a\u0e2a\u0e21\u0e32\u0e0a\u0e34\u0e01 ' + user.rows[0].name + ' \u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08' }));
}

async function handleDeleteSong(db, body, res) {
  if (!await verifyAdmin(db, body.token)) return res.json(jsonErr('\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e23\u0e31\u0e1a\u0e2d\u0e19\u0e38\u0e0d\u0e32\u0e15', 403));
  if (!body.song_id) return res.json(jsonErr('\u0e44\u0e21\u0e48\u0e21\u0e35 song_id'));
  const song = await db.execute({ sql: 'SELECT name FROM songs WHERE id = ?', args: [body.song_id] });
  if (song.rows.length === 0) return res.json(jsonErr('\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e40\u0e1e\u0e25\u0e07'));
  await db.execute({ sql: 'DELETE FROM songs WHERE id = ?', args: [body.song_id] });
  res.json(jsonOk({ message: '\u0e25\u0e1a\u0e40\u0e1e\u0e25\u0e07 ' + song.rows[0].name + ' \u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08' }));
}

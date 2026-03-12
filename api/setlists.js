const { getDb } = require('../lib/db');
const { uuid, now, jsonOk, jsonErr, verifyUser, cors } = require('../lib/helpers');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  const db = getDb();

  if (req.method === 'GET') {
    const sess = await verifyUser(db, req.query.token);
    if (!sess) return res.json(jsonErr('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e40\u0e02\u0e49\u0e32\u0e2a\u0e39\u0e48\u0e23\u0e30\u0e1a\u0e1a', 401));

    const rows = (await db.execute({ sql: 'SELECT setlist_id, name, songs_json, created_at, updated_at FROM setlists WHERE uid = ?', args: [sess.uid] })).rows;
    return res.json(jsonOk({ setlists: rows }));
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const sess = await verifyUser(db, body.token);
    if (!sess) return res.json(jsonErr('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e40\u0e02\u0e49\u0e32\u0e2a\u0e39\u0e48\u0e23\u0e30\u0e1a\u0e1a', 401));

    if (body.action === 'delete') {
      if (!body.setlist_id) return res.json(jsonErr('\u0e44\u0e21\u0e48\u0e21\u0e35 setlist_id'));
      await db.execute({ sql: 'DELETE FROM setlists WHERE uid = ? AND setlist_id = ?', args: [sess.uid, body.setlist_id] });
      return res.json(jsonOk({ message: '\u0e25\u0e1a setlist \u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08' }));
    }

    // Save (create or update)
    const name = (body.name || '').trim();
    if (!name) return res.json(jsonErr('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e15\u0e31\u0e49\u0e07\u0e0a\u0e37\u0e48\u0e2d setlist'));
    const sid = body.setlist_id || '';

    if (sid) {
      const existing = await db.execute({ sql: 'SELECT id FROM setlists WHERE uid = ? AND setlist_id = ?', args: [sess.uid, sid] });
      if (existing.rows.length > 0) {
        await db.execute({
          sql: 'UPDATE setlists SET name = ?, songs_json = ?, updated_at = ? WHERE uid = ? AND setlist_id = ?',
          args: [name, body.songs_json || '[]', now(), sess.uid, sid]
        });
        return res.json(jsonOk({ setlist_id: sid, message: '\u0e2d\u0e31\u0e1e\u0e40\u0e14\u0e17 setlist \u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08' }));
      }
    }

    const newSid = uuid();
    await db.execute({
      sql: 'INSERT INTO setlists (uid, setlist_id, name, songs_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: [sess.uid, newSid, name, body.songs_json || '[]', now(), now()]
    });
    return res.json(jsonOk({ setlist_id: newSid, message: '\u0e2a\u0e23\u0e49\u0e32\u0e07 setlist \u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08' }));
  }

  return res.status(405).json(jsonErr('Method not allowed'));
};

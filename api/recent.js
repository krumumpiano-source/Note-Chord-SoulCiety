const { getDb } = require('../lib/db');
const { now, jsonOk, jsonErr, verifyUser, cors } = require('../lib/helpers');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  const db = getDb();

  if (req.method === 'GET') {
    const sess = await verifyUser(db, req.query.token);
    if (!sess) return res.json(jsonErr('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e40\u0e02\u0e49\u0e32\u0e2a\u0e39\u0e48\u0e23\u0e30\u0e1a\u0e1a', 401));

    const rows = (await db.execute({
      sql: 'SELECT song_name, song_url, opened_at FROM recent WHERE uid = ? ORDER BY opened_at DESC',
      args: [sess.uid]
    })).rows;
    const list = rows.map(r => ({ name: r.song_name, url: r.song_url, opened_at: r.opened_at }));
    return res.json(jsonOk({ recent: list }));
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const sess = await verifyUser(db, body.token);
    if (!sess) return res.json(jsonErr('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e40\u0e02\u0e49\u0e32\u0e2a\u0e39\u0e48\u0e23\u0e30\u0e1a\u0e1a', 401));
    if (!body.song_name) return res.json(jsonErr('\u0e44\u0e21\u0e48\u0e21\u0e35\u0e0a\u0e37\u0e48\u0e2d\u0e40\u0e1e\u0e25\u0e07'));

    // Remove existing entry for this song
    await db.execute({
      sql: 'DELETE FROM recent WHERE uid = ? AND song_name = ?',
      args: [sess.uid, body.song_name]
    });

    // Add new entry
    await db.execute({
      sql: 'INSERT INTO recent (uid, song_name, song_url, opened_at) VALUES (?, ?, ?, ?)',
      args: [sess.uid, body.song_name, body.song_url || '', now()]
    });

    // Keep max 50
    const count = (await db.execute({
      sql: 'SELECT COUNT(*) as cnt FROM recent WHERE uid = ?',
      args: [sess.uid]
    })).rows[0].cnt;

    if (count > 50) {
      await db.execute({
        sql: 'DELETE FROM recent WHERE uid = ? AND id NOT IN (SELECT id FROM recent WHERE uid = ? ORDER BY opened_at DESC LIMIT 50)',
        args: [sess.uid, sess.uid]
      });
    }

    return res.json(jsonOk({ message: '\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e40\u0e1e\u0e25\u0e07\u0e25\u0e48\u0e32\u0e2a\u0e38\u0e14\u0e41\u0e25\u0e49\u0e27' }));
  }

  return res.status(405).json(jsonErr('Method not allowed'));
};

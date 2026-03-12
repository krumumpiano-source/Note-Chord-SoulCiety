const { getDb } = require('../lib/db');
const { now, jsonOk, jsonErr, verifyUser, cors } = require('../lib/helpers');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  const db = getDb();

  if (req.method === 'GET') {
    const sess = await verifyUser(db, req.query.token);
    if (!sess) return res.json(jsonErr('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e40\u0e02\u0e49\u0e32\u0e2a\u0e39\u0e48\u0e23\u0e30\u0e1a\u0e1a', 401));

    const favs = (await db.execute({ sql: 'SELECT song_name, song_url FROM favorites WHERE uid = ?', args: [sess.uid] })).rows;
    const list = favs.map(f => ({ name: f.song_name, url: f.song_url }));
    return res.json(jsonOk({ favorites: list }));
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const sess = await verifyUser(db, body.token);
    if (!sess) return res.json(jsonErr('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e40\u0e02\u0e49\u0e32\u0e2a\u0e39\u0e48\u0e23\u0e30\u0e1a\u0e1a', 401));
    if (!body.song_name) return res.json(jsonErr('\u0e44\u0e21\u0e48\u0e21\u0e35\u0e0a\u0e37\u0e48\u0e2d\u0e40\u0e1e\u0e25\u0e07'));

    // Check if already favorited
    const existing = await db.execute({
      sql: 'SELECT id FROM favorites WHERE uid = ? AND song_name = ?',
      args: [sess.uid, body.song_name]
    });

    if (existing.rows.length > 0) {
      await db.execute({ sql: 'DELETE FROM favorites WHERE uid = ? AND song_name = ?', args: [sess.uid, body.song_name] });
      return res.json(jsonOk({ favorited: false, message: '\u0e25\u0e1a\u0e2d\u0e2d\u0e01\u0e08\u0e32\u0e01\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e42\u0e1b\u0e23\u0e14\u0e41\u0e25\u0e49\u0e27' }));
    }

    await db.execute({
      sql: 'INSERT INTO favorites (uid, song_name, song_url, added_at) VALUES (?, ?, ?, ?)',
      args: [sess.uid, body.song_name, body.song_url || '', now()]
    });
    return res.json(jsonOk({ favorited: true, message: '\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e43\u0e19\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e42\u0e1b\u0e23\u0e14\u0e41\u0e25\u0e49\u0e27' }));
  }

  return res.status(405).json(jsonErr('Method not allowed'));
};

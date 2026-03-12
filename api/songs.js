const { getDb } = require('../lib/db');
const { jsonOk, jsonErr, verifyUser, cors } = require('../lib/helpers');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  const db = getDb();

  if (req.method === 'GET') {
    const { id, token } = req.query;

    // Get specific song file
    if (id) {
      const sess = await verifyUser(db, token);
      if (!sess) return res.json(jsonErr('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e40\u0e02\u0e49\u0e32\u0e2a\u0e39\u0e48\u0e23\u0e30\u0e1a\u0e1a', 401));

      const song = await db.execute({ sql: 'SELECT file_data, mime_type FROM songs WHERE id = ?', args: [id] });
      if (song.rows.length === 0) return res.json(jsonErr('\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e40\u0e1e\u0e25\u0e07', 404));

      return res.json(jsonOk({ content: song.rows[0].file_data, mimeType: song.rows[0].mime_type }));
    }

    // List all songs (public)
    const songs = await db.execute('SELECT id, name FROM songs ORDER BY name');
    const list = songs.rows.map(s => ({ name: s.name, url: String(s.id) }));
    return res.json(jsonOk({ songs: list, total: list.length }));
  }

  return res.status(405).json(jsonErr('Method not allowed'));
};

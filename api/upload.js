const { getDb } = require('../lib/db');
const { now, jsonOk, jsonErr, verifyAdmin, cors } = require('../lib/helpers');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json(jsonErr('Method not allowed'));

  const db = getDb();
  const body = req.body || {};

  if (!await verifyAdmin(db, body.token)) return res.json(jsonErr('\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e23\u0e31\u0e1a\u0e2d\u0e19\u0e38\u0e0d\u0e32\u0e15', 403));
  if (!body.name || !body.base64 || !body.mime_type) return res.json(jsonErr('\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e44\u0e21\u0e48\u0e04\u0e23\u0e1a'));

  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/bmp'];
  if (!allowed.includes(body.mime_type)) return res.json(jsonErr('\u0e1b\u0e23\u0e30\u0e40\u0e20\u0e17\u0e44\u0e1f\u0e25\u0e4c\u0e44\u0e21\u0e48\u0e23\u0e2d\u0e07\u0e23\u0e31\u0e1a'));

  // Check for duplicate name
  const existing = await db.execute({ sql: 'SELECT id FROM songs WHERE name = ?', args: [body.name] });
  if (existing.rows.length > 0) return res.json(jsonErr('\u0e0a\u0e37\u0e48\u0e2d\u0e40\u0e1e\u0e25\u0e07\u0e19\u0e35\u0e49\u0e21\u0e35\u0e2d\u0e22\u0e39\u0e48\u0e41\u0e25\u0e49\u0e27'));

  await db.execute({
    sql: 'INSERT INTO songs (name, mime_type, file_data, uploaded_at) VALUES (?, ?, ?, ?)',
    args: [body.name, body.mime_type, body.base64, now()]
  });

  res.json(jsonOk({ message: '\u0e2d\u0e31\u0e1e\u0e42\u0e2b\u0e25\u0e14 "' + body.name + '" \u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08' }));
};

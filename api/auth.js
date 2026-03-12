const { getDb } = require('../lib/db');
const { uuid, now, hashPassword, jsonOk, jsonErr, ADMIN_EMAIL, SESSION_HOURS, verifyUser, cors } = require('../lib/helpers');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  const db = getDb();

  if (req.method === 'GET') {
    const { action, token } = req.query;
    if (action === 'verify') return await handleVerifySession(db, token, res);
    return res.status(400).json(jsonErr('Unknown action'));
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    switch (body.action) {
      case 'register':        return await handleRegister(db, body, res);
      case 'login':           return await handleLogin(db, body, res);
      case 'logout':          return await handleLogout(db, body, res);
      case 'change-password': return await handleChangePassword(db, body, res);
      default: return res.status(400).json(jsonErr('Unknown action'));
    }
  }
  return res.status(405).json(jsonErr('Method not allowed'));
};

async function handleRegister(db, body, res) {
  const email = (body.email || '').trim().toLowerCase();
  const name = (body.name || '').trim();
  const pw = body.password || '';
  if (!email || !name || !pw) return res.json(jsonErr('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e01\u0e23\u0e2d\u0e01\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e43\u0e2b\u0e49\u0e04\u0e23\u0e1a'));
  if (pw.length < 6) return res.json(jsonErr('\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19\u0e15\u0e49\u0e2d\u0e07\u0e21\u0e35\u0e2d\u0e22\u0e48\u0e32\u0e07\u0e19\u0e49\u0e2d\u0e22 6 \u0e15\u0e31\u0e27\u0e2d\u0e31\u0e01\u0e29\u0e23'));

  const existing = await db.execute({ sql: 'SELECT uid FROM users WHERE email = ?', args: [email] });
  if (existing.rows.length > 0) return res.json(jsonErr('\u0e2d\u0e35\u0e40\u0e21\u0e25\u0e19\u0e35\u0e49\u0e16\u0e39\u0e01\u0e43\u0e0a\u0e49\u0e41\u0e25\u0e49\u0e27'));

  const salt = uuid(), hash = hashPassword(pw, salt), uid = uuid();
  const isAdmin = email === ADMIN_EMAIL;
  await db.execute({
    sql: 'INSERT INTO users (uid, email, name, password_hash, salt, status, package, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [uid, email, name, hash, salt, isAdmin ? 'approved' : 'pending', isAdmin ? 'gold' : 'free', now()]
  });

  const msg = isAdmin
    ? '\u0e2a\u0e21\u0e31\u0e04\u0e23\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08! (Admin) \u0e40\u0e02\u0e49\u0e32\u0e2a\u0e39\u0e48\u0e23\u0e30\u0e1a\u0e1a\u0e44\u0e14\u0e49\u0e40\u0e25\u0e22'
    : '\u0e2a\u0e21\u0e31\u0e04\u0e23\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08! \u0e01\u0e23\u0e38\u0e13\u0e32\u0e23\u0e2d\u0e41\u0e2d\u0e14\u0e21\u0e34\u0e19\u0e2d\u0e19\u0e38\u0e21\u0e31\u0e15\u0e34';
  res.json(jsonOk({ message: msg }));
}

async function handleLogin(db, body, res) {
  const email = (body.email || '').trim().toLowerCase();
  const pw = body.password || '';
  if (!email || !pw) return res.json(jsonErr('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e01\u0e23\u0e2d\u0e01\u0e2d\u0e35\u0e40\u0e21\u0e25\u0e41\u0e25\u0e30\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19'));

  const result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] });
  if (result.rows.length === 0) return res.json(jsonErr('\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e1a\u0e31\u0e0d\u0e0a\u0e35\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49\u0e19\u0e35\u0e49'));

  const user = result.rows[0];
  if (hashPassword(pw, user.salt) !== user.password_hash) return res.json(jsonErr('\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19\u0e44\u0e21\u0e48\u0e16\u0e39\u0e01\u0e15\u0e49\u0e2d\u0e07'));
  if (user.status === 'pending') return res.json(jsonErr('\u0e1a\u0e31\u0e0d\u0e0a\u0e35\u0e02\u0e2d\u0e07\u0e04\u0e38\u0e13\u0e22\u0e31\u0e07\u0e23\u0e2d\u0e01\u0e32\u0e23\u0e2d\u0e19\u0e38\u0e21\u0e31\u0e15\u0e34\u0e08\u0e32\u0e01\u0e41\u0e2d\u0e14\u0e21\u0e34\u0e19'));
  if (user.status === 'rejected') return res.json(jsonErr('\u0e1a\u0e31\u0e0d\u0e0a\u0e35\u0e02\u0e2d\u0e07\u0e04\u0e38\u0e13\u0e16\u0e39\u0e01\u0e1b\u0e0f\u0e34\u0e40\u0e2a\u0e18'));
  if (user.status === 'blocked') return res.json(jsonErr('\u0e1a\u0e31\u0e0d\u0e0a\u0e35\u0e02\u0e2d\u0e07\u0e04\u0e38\u0e13\u0e16\u0e39\u0e01\u0e23\u0e30\u0e07\u0e31\u0e1a \u0e01\u0e23\u0e38\u0e13\u0e32\u0e15\u0e34\u0e14\u0e15\u0e48\u0e2d\u0e41\u0e2d\u0e14\u0e21\u0e34\u0e19'));

  const token = uuid();
  const role = email === ADMIN_EMAIL ? 'admin' : 'member';
  const exp = new Date();
  exp.setHours(exp.getHours() + SESSION_HOURS);

  await db.execute({
    sql: 'INSERT INTO sessions (token, uid, email, name, role, package, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [token, user.uid, user.email, user.name, role, user.package || 'free', now(), exp.toISOString()]
  });

  res.json(jsonOk({
    token,
    user: { uid: user.uid, email: user.email, name: user.name, role, package: user.package || 'free' }
  }));
}

async function handleVerifySession(db, token, res) {
  if (!token) return res.json(jsonErr('\u0e44\u0e21\u0e48\u0e21\u0e35 token', 401));

  const result = await db.execute({ sql: 'SELECT * FROM sessions WHERE token = ?', args: [token] });
  if (result.rows.length === 0) return res.json(jsonErr('Session \u0e44\u0e21\u0e48\u0e16\u0e39\u0e01\u0e15\u0e49\u0e2d\u0e07', 401));

  const sess = result.rows[0];
  if (new Date(sess.expires_at) <= new Date()) {
    await db.execute({ sql: 'DELETE FROM sessions WHERE token = ?', args: [token] });
    return res.json(jsonErr('Session \u0e2b\u0e21\u0e14\u0e2d\u0e32\u0e22\u0e38', 401));
  }

  res.json(jsonOk({
    user: { uid: sess.uid, email: sess.email, name: sess.name, role: sess.role, package: sess.package || 'free' }
  }));
}

async function handleLogout(db, body, res) {
  const token = body.token || '';
  if (token) {
    await db.execute({ sql: 'DELETE FROM sessions WHERE token = ?', args: [token] });
  }
  res.json(jsonOk({ message: '\u0e2d\u0e2d\u0e01\u0e08\u0e32\u0e01\u0e23\u0e30\u0e1a\u0e1a\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08' }));
}

async function handleChangePassword(db, body, res) {
  const sess = await verifyUser(db, body.token);
  if (!sess) return res.json(jsonErr('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e40\u0e02\u0e49\u0e32\u0e2a\u0e39\u0e48\u0e23\u0e30\u0e1a\u0e1a', 401));

  const oldPw = body.old_password || '';
  const newPw = body.new_password || '';
  if (!oldPw || !newPw) return res.json(jsonErr('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e01\u0e23\u0e2d\u0e01\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19\u0e40\u0e01\u0e48\u0e32\u0e41\u0e25\u0e30\u0e43\u0e2b\u0e21\u0e48'));
  if (newPw.length < 6) return res.json(jsonErr('\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19\u0e43\u0e2b\u0e21\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e21\u0e35\u0e2d\u0e22\u0e48\u0e32\u0e07\u0e19\u0e49\u0e2d\u0e22 6 \u0e15\u0e31\u0e27\u0e2d\u0e31\u0e01\u0e29\u0e23'));

  const result = await db.execute({ sql: 'SELECT * FROM users WHERE uid = ?', args: [sess.uid] });
  if (result.rows.length === 0) return res.json(jsonErr('\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49'));

  const user = result.rows[0];
  if (hashPassword(oldPw, user.salt) !== user.password_hash) return res.json(jsonErr('\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19\u0e40\u0e01\u0e48\u0e32\u0e44\u0e21\u0e48\u0e16\u0e39\u0e01\u0e15\u0e49\u0e2d\u0e07'));

  const newSalt = uuid(), newHash = hashPassword(newPw, newSalt);
  await db.execute({
    sql: 'UPDATE users SET password_hash = ?, salt = ? WHERE uid = ?',
    args: [newHash, newSalt, user.uid]
  });

  res.json(jsonOk({ message: '\u0e40\u0e1b\u0e25\u0e35\u0e48\u0e22\u0e19\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08' }));
}

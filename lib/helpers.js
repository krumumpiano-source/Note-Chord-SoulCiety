const crypto = require('crypto');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'krumum.piano@gmail.com';
const SESSION_HOURS = parseInt(process.env.SESSION_HOURS || '24');

function uuid() { return crypto.randomUUID(); }
function now() { return new Date().toISOString(); }

function hashPassword(pw, salt) {
  return crypto.createHash('sha256').update(salt + pw, 'utf8').digest('hex');
}

function jsonOk(data) { return { success: true, data }; }
function jsonErr(msg, code) { return { success: false, error: msg, code: code || 400 }; }

async function verifyAdmin(db, token) {
  if (!token) return null;
  const result = await db.execute({
    sql: 'SELECT * FROM sessions WHERE token = ? AND role = ? AND expires_at > ?',
    args: [token, 'admin', now()]
  });
  return result.rows.length > 0 ? result.rows[0] : null;
}

async function verifyUser(db, token) {
  if (!token) return null;
  const result = await db.execute({
    sql: 'SELECT * FROM sessions WHERE token = ? AND expires_at > ?',
    args: [token, now()]
  });
  return result.rows.length > 0 ? result.rows[0] : null;
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = {
  uuid, now, hashPassword, jsonOk, jsonErr,
  ADMIN_EMAIL, SESSION_HOURS,
  verifyAdmin, verifyUser, cors
};

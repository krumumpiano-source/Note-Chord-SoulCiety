const { jsonOk, cors } = require('../lib/helpers');

module.exports = function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  res.json(jsonOk({ message: 'Note Chord SoulCiety API ready', time: new Date().toISOString() }));
};

/* ============================================
   Note Chord SoulCiety — API Client
   Fetch wrapper for Vercel serverless endpoints
   ============================================ */

const API = {
  _pending: {},

  /* ---------- Core request methods ---------- */

  async get(endpoint, params = {}) {
    const key = endpoint + '|' + JSON.stringify(params);
    if (this._pending[key]) return this._pending[key];

    const url = new URL(CONFIG.API_BASE_URL + '/api/' + endpoint, window.location.origin);
    Object.keys(params).forEach(k => {
      if (params[k] !== undefined && params[k] !== null) {
        url.searchParams.set(k, params[k]);
      }
    });

    const promise = (async () => {
      try {
        const res = await fetch(url.toString());
        return await res.json();
      } catch (err) {
        return { success: false, error: '\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e40\u0e0a\u0e37\u0e48\u0e2d\u0e21\u0e15\u0e48\u0e2d\u0e40\u0e0b\u0e34\u0e23\u0e4c\u0e1f\u0e40\u0e27\u0e2d\u0e23\u0e4c\u0e44\u0e14\u0e49' };
      } finally {
        delete this._pending[key];
      }
    })();

    this._pending[key] = promise;
    return promise;
  },

  async post(endpoint, data = {}) {
    try {
      const res = await fetch(CONFIG.API_BASE_URL + '/api/' + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await res.json();
    } catch (err) {
      return { success: false, error: '\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e40\u0e0a\u0e37\u0e48\u0e2d\u0e21\u0e15\u0e48\u0e2d\u0e40\u0e0b\u0e34\u0e23\u0e4c\u0e1f\u0e40\u0e27\u0e2d\u0e23\u0e4c\u0e44\u0e14\u0e49' };
    }
  },

  /* ---------- Auth ---------- */

  register(name, email, password) {
    return this.post('auth', { action: 'register', name, email, password });
  },

  login(email, password) {
    return this.post('auth', { action: 'login', email, password });
  },

  verifySession(token) {
    return this.get('auth', { action: 'verify', token });
  },

  logout(token) {
    return this.post('auth', { action: 'logout', token });
  },

  /* ---------- Songs ---------- */

  listSongs() {
    return this.get('songs');
  },

  getPdf(token, fileId) {
    return this.get('songs', { id: fileId, token });
  },

  /* ---------- Admin ---------- */

  adminListUsers(token) {
    return this.get('admin', { action: 'list-users', token });
  },

  adminListSongs(token) {
    return this.get('admin', { action: 'list-songs', token });
  },

  adminApprove(token, uid) {
    return this.post('admin', { action: 'approve', token, uid });
  },

  adminReject(token, uid) {
    return this.post('admin', { action: 'reject', token, uid });
  },

  adminSetPackage(token, uid, pkg) {
    return this.post('admin', { action: 'set-package', token, uid, 'package': pkg });
  },

  adminBlock(token, uid) {
    return this.post('admin', { action: 'block', token, uid });
  },

  adminUnblock(token, uid) {
    return this.post('admin', { action: 'unblock', token, uid });
  },

  adminResetPassword(token, uid, newPassword) {
    return this.post('admin', { action: 'reset-pw', token, uid, new_password: newPassword });
  },

  adminDeleteUser(token, uid) {
    return this.post('admin', { action: 'delete-user', token, uid });
  },

  adminDeleteSong(token, songId) {
    return this.post('admin', { action: 'delete-song', token, song_id: songId });
  },

  /* ---------- Upload ---------- */

  uploadSong(token, name, base64, mimeType) {
    return this.post('upload', { token, name, base64, mime_type: mimeType });
  },

  /* ---------- Favorites ---------- */

  getFavorites(token) {
    return this.get('favorites', { token });
  },

  toggleFavorite(token, songName, songUrl) {
    return this.post('favorites', { action: 'toggle', token, song_name: songName, song_url: songUrl });
  },

  /* ---------- Setlists ---------- */

  getSetlists(token) {
    return this.get('setlists', { token });
  },

  saveSetlist(token, setlistId, name, songsJson) {
    return this.post('setlists', { action: 'save', token, setlist_id: setlistId, name, songs_json: songsJson });
  },

  deleteSetlist(token, setlistId) {
    return this.post('setlists', { action: 'delete', token, setlist_id: setlistId });
  },

  /* ---------- Recent ---------- */

  getRecent(token) {
    return this.get('recent', { token });
  },

  addRecent(token, songName, songUrl) {
    return this.post('recent', { action: 'add', token, song_name: songName, song_url: songUrl });
  }
};
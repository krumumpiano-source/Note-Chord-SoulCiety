/* ============================================
   Note Chord SoulCiety — API Client
   Fetch wrapper for GAS Web App endpoints
   ============================================ */

const API = {
  /* ---------- Core request methods ---------- */

  async get(action, params = {}) {
    const url = new URL(CONFIG.GAS_URL);
    url.searchParams.set('action', action);
    Object.keys(params).forEach(k => {
      if (params[k] !== undefined && params[k] !== null) {
        url.searchParams.set(k, params[k]);
      }
    });

    try {
      const res = await fetch(url.toString(), { redirect: 'follow' });
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch (e) {
        // GAS sometimes returns HTML on error
        return { success: false, error: 'เซิร์ฟเวอร์ตอบกลับผิดพลาด' };
      }
    } catch (err) {
      return { success: false, error: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' };
    }
  },

  async post(action, data = {}) {
    const payload = { action, ...data };

    try {
      const res = await fetch(CONFIG.GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow'
      });
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch (e) {
        return { success: false, error: 'เซิร์ฟเวอร์ตอบกลับผิดพลาด' };
      }
    } catch (err) {
      return { success: false, error: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' };
    }
  },

  /* ---------- Auth ---------- */

  register(name, email, password) {
    return this.post('register', { name, email, password });
  },

  login(email, password) {
    return this.post('login', { email, password });
  },

  verifySession(token) {
    return this.get('verify-session', { token });
  },

  logout(token) {
    return this.post('logout', { token });
  },

  /* ---------- Songs ---------- */

  listSongs() {
    return this.get('list-songs');
  },

  /* ---------- Admin ---------- */

  adminListUsers(token) {
    return this.get('admin-list-users', { token });
  },

  adminApprove(token, uid) {
    return this.post('admin-approve', { token, uid });
  },

  adminReject(token, uid) {
    return this.post('admin-reject', { token, uid });
  },

  adminSetPackage(token, uid, pkg) {
    return this.post('admin-set-package', { token, uid, 'package': pkg });
  },

  /* ---------- Favorites ---------- */

  getFavorites(token) {
    return this.get('get-favorites', { token });
  },

  toggleFavorite(token, songName, songUrl) {
    return this.post('toggle-favorite', { token, song_name: songName, song_url: songUrl });
  },

  /* ---------- Setlists ---------- */

  getSetlists(token) {
    return this.get('get-setlists', { token });
  },

  saveSetlist(token, setlistId, name, songsJson) {
    return this.post('save-setlist', { token, setlist_id: setlistId, name, songs_json: songsJson });
  },

  deleteSetlist(token, setlistId) {
    return this.post('delete-setlist', { token, setlist_id: setlistId });
  },

  /* ---------- Recent ---------- */

  getRecent(token) {
    return this.get('get-recent', { token });
  },

  addRecent(token, songName, songUrl) {
    return this.post('add-recent', { token, song_name: songName, song_url: songUrl });
  },

  /* ---------- PDF ---------- */

  getPdf(token, fileId) {
    return this.get('get-pdf', { token, fileId });
  }
};

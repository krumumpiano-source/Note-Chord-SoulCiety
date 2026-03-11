/* ============================================
   Note Chord SoulCiety — Auth Module
   Login, Register, Session management
   ============================================ */

const Auth = {
  TOKEN_KEY: 'ncs-token',
  USER_KEY: 'ncs-user',

  getToken() {
    return sessionStorage.getItem(this.TOKEN_KEY);
  },

  getUser() {
    const raw = sessionStorage.getItem(this.USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); }
    catch (e) { return null; }
  },

  setSession(token, user) {
    sessionStorage.setItem(this.TOKEN_KEY, token);
    sessionStorage.setItem(this.USER_KEY, JSON.stringify(user));
  },

  clearSession() {
    sessionStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.USER_KEY);
  },

  isAdmin() {
    const user = this.getUser();
    return user && user.role === 'admin';
  },

  async verifySession() {
    const token = this.getToken();
    if (!token) return false;

    const res = await API.verifySession(token);
    if (res.success && res.data && res.data.user) {
      sessionStorage.setItem(this.USER_KEY, JSON.stringify(res.data.user));
      return true;
    }
    this.clearSession();
    return false;
  },

  async login(email, password) {
    const res = await API.login(email, password);
    if (res.success && res.data && res.data.token) {
      this.setSession(res.data.token, res.data.user);
      return { success: true };
    }
    return { success: false, error: res.error || 'เข้าสู่ระบบไม่สำเร็จ' };
  },

  async register(name, email, password) {
    const res = await API.register(name, email, password);
    if (res.success) {
      return { success: true, message: res.data.message };
    }
    return { success: false, error: res.error || 'สมัครสมาชิกไม่สำเร็จ' };
  },

  async logout() {
    const token = this.getToken();
    if (token) {
      API.logout(token); // fire and forget
    }
    this.clearSession();
    window.location.href = 'index.html';
  },

  requireAuth() {
    if (!this.getToken()) {
      window.location.href = 'index.html';
      return false;
    }
    return true;
  }
};

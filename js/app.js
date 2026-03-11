/* ============================================
   Note Chord SoulCiety — App Main Controller
   Routing, Sidebar, Toast, Initialization
   ============================================ */

const App = {
  currentView: 'library',

  /* ---------- Bootstrap ---------- */
  async init() {
    // Check auth
    if (!Auth.requireAuth()) return;

    const valid = await Auth.verifySession();
    if (!valid) {
      Auth.clearSession();
      window.location.href = 'index.html';
      return;
    }

    // Setup UI
    this.renderUserInfo();
    this.setupSidebar();
    this.setupTopbar();
    Theme.init();
    Search.init();

    // Load data in parallel
    await Promise.all([
      Library.load(),
      Favorites.load(),
      Recent.load(),
      Setlists.load()
    ]);

    // Update badges
    Favorites.updateBadge();
    Recent.updateBadge();

    // Default view
    this.navigate('library');
  },

  /* ---------- User Info in Sidebar ---------- */
  renderUserInfo() {
    const user = Auth.getUser();
    if (!user) return;

    const avatarEl = document.getElementById('user-avatar');
    const nameEl = document.getElementById('user-name');
    const pkgEl = document.getElementById('user-package');
    const adminNav = document.getElementById('nav-admin');

    if (avatarEl) avatarEl.textContent = (user.name || 'U').charAt(0).toUpperCase();
    if (nameEl) nameEl.textContent = user.name || user.email;

    if (pkgEl) {
      const pkg = CONFIG.PACKAGES[user.package || 'free'] || CONFIG.PACKAGES.free;
      pkgEl.textContent = pkg.icon + ' ' + pkg.label;
      pkgEl.className = 'sidebar-user-package pkg-' + (user.package || 'free');
    }

    // Show admin nav
    if (adminNav) {
      adminNav.style.display = user.role === 'admin' ? '' : 'none';
    }
  },

  /* ---------- Sidebar Navigation ---------- */
  setupSidebar() {
    // Nav items
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
      item.addEventListener('click', () => {
        const view = item.dataset.view;
        this.navigate(view);
        this.closeMobileSidebar();
      });
    });

    // Logout button
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => Auth.logout());
    }

    // Mobile sidebar
    const hamburger = document.getElementById('topbar-hamburger');
    const overlay = document.getElementById('sidebar-overlay');

    if (hamburger) {
      hamburger.addEventListener('click', () => this.toggleMobileSidebar());
    }
    if (overlay) {
      overlay.addEventListener('click', () => this.closeMobileSidebar());
    }
  },

  toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  },

  closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
  },

  /* ---------- Top Bar ---------- */
  setupTopbar() {
    // View toggle (grid/list)
    document.querySelectorAll('.topbar-view-toggle .topbar-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        Library.setViewMode(btn.dataset.view);
      });
    });

    // Restore saved view mode
    const savedView = localStorage.getItem('ncs-view-mode');
    if (savedView) Library.viewMode = savedView;
    Library.updateViewToggle();

    // Sort toggle
    const sortBtn = document.getElementById('sort-btn');
    const sortMenu = document.getElementById('sort-menu');
    if (sortBtn && sortMenu) {
      sortBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sortMenu.classList.toggle('open');
      });

      sortMenu.querySelectorAll('.sort-menu-item').forEach(item => {
        item.addEventListener('click', () => {
          Library.setSortMode(item.dataset.sort);
          sortMenu.querySelectorAll('.sort-menu-item').forEach(i => i.classList.remove('active'));
          item.classList.add('active');
          sortMenu.classList.remove('open');
        });
      });

      document.addEventListener('click', () => sortMenu.classList.remove('open'));
    }

    // Theme toggle
    const themeBtn = document.getElementById('theme-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => Theme.toggle());
    }
  },

  /* ---------- Navigation / Routing ---------- */
  navigate(view) {
    this.currentView = view;
    Search.clear();

    // Update active nav
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
      item.classList.toggle('active', item.dataset.view === view);
    });

    // Show/hide search & view controls based on view
    const searchEl = document.querySelector('.topbar-search');
    const viewToggle = document.querySelector('.topbar-view-toggle');
    const sortDropdown = document.querySelector('.sort-dropdown');
    const isLibrary = (view === 'library');
    if (searchEl) searchEl.style.display = (isLibrary || view === 'favorites') ? '' : 'none';
    if (viewToggle) viewToggle.style.display = (isLibrary || view === 'favorites') ? '' : 'none';
    if (sortDropdown) sortDropdown.style.display = isLibrary ? '' : 'none';

    switch (view) {
      case 'library':
        document.getElementById('topbar-title').textContent = 'คลังเพลง';
        Library.applyFilters();
        Library.render();
        break;
      case 'favorites':
        Favorites.renderView();
        break;
      case 'recent':
        Recent.renderView();
        break;
      case 'setlists':
        Setlists.renderView();
        break;
      case 'admin':
        Admin.renderView();
        break;
      case 'settings':
        this.renderSettings();
        break;
    }
  },

  renderSettings() {
    document.getElementById('topbar-title').textContent = 'เปลี่ยนรหัสผ่าน';
    const area = document.getElementById('content-area');
    area.innerHTML = `
      <div style="max-width:400px;margin:2rem auto;padding:1.5rem;">
        <h2 style="margin-bottom:1.5rem;color:var(--text-primary);">เปลี่ยนรหัสผ่าน</h2>
        <div style="margin-bottom:1rem;">
          <label style="display:block;margin-bottom:0.3rem;color:var(--text-secondary);font-size:0.9rem;">รหัสผ่านเก่า</label>
          <input type="password" id="old-password" style="width:100%;padding:0.7rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-secondary);color:var(--text-primary);font-size:1rem;" />
        </div>
        <div style="margin-bottom:1rem;">
          <label style="display:block;margin-bottom:0.3rem;color:var(--text-secondary);font-size:0.9rem;">รหัสผ่านใหม่</label>
          <input type="password" id="new-password" style="width:100%;padding:0.7rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-secondary);color:var(--text-primary);font-size:1rem;" />
        </div>
        <div style="margin-bottom:1.5rem;">
          <label style="display:block;margin-bottom:0.3rem;color:var(--text-secondary);font-size:0.9rem;">ยืนยันรหัสผ่านใหม่</label>
          <input type="password" id="confirm-password" style="width:100%;padding:0.7rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-secondary);color:var(--text-primary);font-size:1rem;" />
        </div>
        <button id="btn-change-pw" style="width:100%;padding:0.8rem;border:none;border-radius:8px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;font-size:1rem;font-weight:600;cursor:pointer;">บันทึกรหัสผ่านใหม่</button>
        <div id="pw-message" style="margin-top:1rem;text-align:center;font-size:0.9rem;"></div>
      </div>
    `;

    document.getElementById('btn-change-pw').addEventListener('click', async () => {
      const oldPw = document.getElementById('old-password').value;
      const newPw = document.getElementById('new-password').value;
      const confirmPw = document.getElementById('confirm-password').value;
      const msgEl = document.getElementById('pw-message');

      if (!oldPw || !newPw || !confirmPw) { msgEl.style.color = '#f44'; msgEl.textContent = 'กรุณากรอกข้อมูลให้ครบ'; return; }
      if (newPw.length < 6) { msgEl.style.color = '#f44'; msgEl.textContent = 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร'; return; }
      if (newPw !== confirmPw) { msgEl.style.color = '#f44'; msgEl.textContent = 'รหัสผ่านใหม่ไม่ตรงกัน'; return; }

      const btn = document.getElementById('btn-change-pw');
      btn.disabled = true; btn.textContent = 'กำลังบันทึก…';

      const token = localStorage.getItem('ncs-token');
      const res = await API.post('change-password', { token, old_password: oldPw, new_password: newPw });

      btn.disabled = false; btn.textContent = 'บันทึกรหัสผ่านใหม่';

      if (res.success) {
        msgEl.style.color = '#4f4'; msgEl.textContent = res.data.message;
        document.getElementById('old-password').value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-password').value = '';
        Toast.show('เปลี่ยนรหัสผ่านสำเร็จ', 'success');
      } else {
        msgEl.style.color = '#f44'; msgEl.textContent = res.error;
      }
    });
  }
};

/* ---------- Toast Utility ---------- */
const Toast = {
  show(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, CONFIG.TOAST_DURATION_MS + 300);
  }
};

/* ---------- Modal close on overlay click ---------- */
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

/* ---------- Start ---------- */
document.addEventListener('DOMContentLoaded', () => App.init());

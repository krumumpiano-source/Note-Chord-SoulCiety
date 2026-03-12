/* ============================================
   Note Chord SoulCiety — Admin Module
   Song upload + Member management (tabbed UI)
   ============================================ */

const Admin = {
  users: [],
  songs: [],
  searchQuery: '',
  activeTab: 'songs',

  async load() {
    const token = Auth.getToken();
    if (!token || !Auth.isAdmin()) return;
    const [uRes, sRes] = await Promise.all([
      API.adminListUsers(token),
      API.adminListSongs(token)
    ]);
    if (uRes.success && uRes.data) this.users = uRes.data.users || [];
    if (sRes.success && sRes.data) this.songs = sRes.data.songs || [];
  },

  renderView() {
    const container = document.getElementById('content-area');
    document.getElementById('topbar-title').textContent = '\u0e08\u0e31\u0e14\u0e01\u0e32\u0e23\u0e23\u0e30\u0e1a\u0e1a (Admin)';

    if (!Auth.isAdmin()) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">\ud83d\udd12</div><h3>\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e23\u0e31\u0e1a\u0e2d\u0e19\u0e38\u0e0d\u0e32\u0e15</h3><p>\u0e40\u0e09\u0e1e\u0e32\u0e30 Admin \u0e40\u0e17\u0e48\u0e32\u0e19\u0e31\u0e49\u0e19</p></div>';
      return;
    }

    container.innerHTML = '<div class="loading-overlay"><div class="loading-spinner"></div></div>';
    this.load().then(() => this.render());
  },

  render() {
    const container = document.getElementById('content-area');
    let html = '';

    // Tabs
    html += '<div class="admin-tabs">';
    html += '<button class="admin-tab' + (this.activeTab === 'songs' ? ' active' : '') + '" data-tab="songs">\ud83d\udcc4 \u0e42\u0e19\u0e49\u0e15\u0e40\u0e1e\u0e25\u0e07 (' + this.songs.length + ')</button>';
    html += '<button class="admin-tab' + (this.activeTab === 'members' ? ' active' : '') + '" data-tab="members">\ud83d\udc65 \u0e2a\u0e21\u0e32\u0e0a\u0e34\u0e01 (' + this.users.length + ')</button>';
    html += '</div>';

    if (this.activeTab === 'songs') {
      html += this.renderSongsTab();
    } else {
      html += this.renderMembersTab();
    }

    container.innerHTML = html;
    this.attachEvents();
  },

  /* ===== Songs Tab ===== */
  renderSongsTab() {
    let html = '';

    // Upload area
    html += '<div class="admin-upload-area" id="upload-area">';
    html += '<div class="upload-icon">\ud83d\udcc2</div>';
    html += '<p>\u0e25\u0e32\u0e01\u0e44\u0e1f\u0e25\u0e4c\u0e21\u0e32\u0e17\u0e35\u0e48\u0e19\u0e35\u0e48 \u0e2b\u0e23\u0e37\u0e2d\u0e04\u0e25\u0e34\u0e01\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e40\u0e25\u0e37\u0e2d\u0e01</p>';
    html += '<p class="upload-hint">PDF, JPEG, PNG, BMP (\u0e44\u0e21\u0e48\u0e40\u0e01\u0e34\u0e19 10MB)</p>';
    html += '<input type="file" id="upload-input" accept=".pdf,.jpg,.jpeg,.png,.bmp" multiple style="display:none;">';
    html += '<button class="btn btn-primary" id="upload-btn">\ud83d\udcc4 \u0e40\u0e25\u0e37\u0e2d\u0e01\u0e44\u0e1f\u0e25\u0e4c</button>';
    html += '</div>';

    // Upload progress (hidden by default)
    html += '<div class="upload-progress" id="upload-progress" style="display:none;"></div>';

    // Song list
    html += '<div class="admin-section-title">\ud83c\udfb5 \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e42\u0e19\u0e49\u0e15\u0e40\u0e1e\u0e25\u0e07 <span class="admin-section-count">(' + this.songs.length + ')</span></div>';
    if (this.songs.length === 0) {
      html += '<div style="color:var(--text-muted);padding:24px;text-align:center;">\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e42\u0e19\u0e49\u0e15\u0e40\u0e1e\u0e25\u0e07 — \u0e2d\u0e31\u0e1e\u0e42\u0e2b\u0e25\u0e14\u0e44\u0e1f\u0e25\u0e4c\u0e41\u0e23\u0e01\u0e44\u0e14\u0e49\u0e40\u0e25\u0e22!</div>';
    } else {
      html += '<div class="admin-song-list">';
      this.songs.forEach(s => {
        const date = s.uploaded_at ? new Date(s.uploaded_at).toLocaleDateString('th-TH', {year:'numeric',month:'short',day:'numeric'}) : '';
        html += '<div class="admin-song-item" data-id="' + s.id + '">';
        html += '<span class="admin-song-icon">' + (s.mime_type && s.mime_type.startsWith('image/') ? '\ud83d\uddbc\ufe0f' : '\ud83d\udcc4') + '</span>';
        html += '<span class="admin-song-name">' + Library.escapeHtml(s.name) + '</span>';
        html += '<span class="admin-song-date">' + date + '</span>';
        html += '<button class="admin-btn admin-btn-danger admin-song-del" data-id="' + s.id + '" data-name="' + Library.escapeAttr(s.name) + '" title="\u0e25\u0e1a">\ud83d\uddd1\ufe0f</button>';
        html += '</div>';
      });
      html += '</div>';
    }

    return html;
  },

  /* ===== Members Tab ===== */
  renderMembersTab() {
    const all = this.getFilteredUsers();
    const pending  = all.filter(u => u.status === 'pending');
    const approved = all.filter(u => u.status === 'approved');
    const blocked  = all.filter(u => u.status === 'blocked');
    const rejected = all.filter(u => u.status === 'rejected');

    let html = '';

    // Summary stats
    html += '<div class="admin-summary">';
    html += '<div class="admin-stat"><span class="admin-stat-num">' + this.users.length + '</span><span class="admin-stat-label">\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14</span></div>';
    html += '<div class="admin-stat"><span class="admin-stat-num" style="color:#f0c75e;">' + this.users.filter(u=>u.status==='pending').length + '</span><span class="admin-stat-label">\u0e23\u0e2d\u0e2d\u0e19\u0e38\u0e21\u0e31\u0e15\u0e34</span></div>';
    html += '<div class="admin-stat"><span class="admin-stat-num" style="color:#4caf50;">' + this.users.filter(u=>u.status==='approved').length + '</span><span class="admin-stat-label">\u0e2d\u0e19\u0e38\u0e21\u0e31\u0e15\u0e34</span></div>';
    html += '<div class="admin-stat"><span class="admin-stat-num" style="color:#f44336;">' + this.users.filter(u=>u.status==='blocked').length + '</span><span class="admin-stat-label">\u0e1a\u0e25\u0e47\u0e2d\u0e01</span></div>';
    html += '</div>';

    // Search bar
    html += '<div class="admin-search-bar">';
    html += '<input type="text" id="admin-search" class="form-input" placeholder="\ud83d\udd0d \u0e04\u0e49\u0e19\u0e2b\u0e32\u0e2a\u0e21\u0e32\u0e0a\u0e34\u0e01 (\u0e0a\u0e37\u0e48\u0e2d / \u0e2d\u0e35\u0e40\u0e21\u0e25)..." value="' + Library.escapeAttr(this.searchQuery) + '" style="width:100%;max-width:400px;">';
    html += '</div>';

    // Pending
    if (pending.length > 0) {
      html += this.renderSection('\u23f3 \u0e23\u0e2d\u0e01\u0e32\u0e23\u0e2d\u0e19\u0e38\u0e21\u0e31\u0e15\u0e34', pending.length, 'pending');
      pending.forEach(u => { html += this.renderUserCard(u); });
      html += '</div>';
    }

    // Approved
    html += this.renderSection('\u2705 \u0e2a\u0e21\u0e32\u0e0a\u0e34\u0e01\u0e17\u0e35\u0e48\u0e2d\u0e19\u0e38\u0e21\u0e31\u0e15\u0e34\u0e41\u0e25\u0e49\u0e27', approved.length, 'approved');
    if (approved.length === 0) {
      html += '<div style="color:var(--text-muted);padding:16px;">\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e2a\u0e21\u0e32\u0e0a\u0e34\u0e01</div>';
    }
    approved.forEach(u => { html += this.renderUserCard(u); });
    html += '</div>';

    // Blocked
    if (blocked.length > 0) {
      html += this.renderSection('\ud83d\udeab \u0e16\u0e39\u0e01\u0e1a\u0e25\u0e47\u0e2d\u0e01', blocked.length, 'blocked');
      blocked.forEach(u => { html += this.renderUserCard(u); });
      html += '</div>';
    }

    // Rejected
    if (rejected.length > 0) {
      html += this.renderSection('\u274c \u0e1b\u0e0f\u0e34\u0e40\u0e2a\u0e18\u0e41\u0e25\u0e49\u0e27', rejected.length, 'rejected');
      rejected.forEach(u => { html += this.renderUserCard(u); });
      html += '</div>';
    }

    return html;
  },

  getFilteredUsers() {
    if (!this.searchQuery) return this.users;
    const q = this.searchQuery.toLowerCase();
    return this.users.filter(u =>
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  },

  renderSection(title, count, type) {
    return '<div class="admin-section-title">' + title + ' <span class="admin-section-count">(' + count + ')</span></div><div class="admin-user-list" data-section="' + type + '">';
  },

  renderUserCard(user) {
    const pkgInfo = CONFIG.PACKAGES[user.package || 'free'] || CONFIG.PACKAGES.free;
    const date = user.created_at ? new Date(user.created_at).toLocaleDateString('th-TH', {year:'numeric',month:'short',day:'numeric'}) : '';
    const isAdmin = user.email === CONFIG.ADMIN_EMAIL;
    const esc = Library.escapeAttr;
    const escH = Library.escapeHtml;

    const statusMap = {
      pending:  {icon: '\u23f3', label: '\u0e23\u0e2d\u0e2d\u0e19\u0e38\u0e21\u0e31\u0e15\u0e34', cls: 'status-pending'},
      approved: {icon: '\u2705', label: '\u0e2d\u0e19\u0e38\u0e21\u0e31\u0e15\u0e34', cls: 'status-approved'},
      blocked:  {icon: '\ud83d\udeab', label: '\u0e16\u0e39\u0e01\u0e1a\u0e25\u0e47\u0e2d\u0e01', cls: 'status-blocked'},
      rejected: {icon: '\u274c', label: '\u0e1b\u0e0f\u0e34\u0e40\u0e2a\u0e18', cls: 'status-rejected'}
    };
    const st = statusMap[user.status] || statusMap.pending;

    const dataInfo = '\u2b50' + (user.fav_count || 0) + ' \ud83d\udccb' + (user.setlist_count || 0) + ' \ud83d\udd50' + (user.recent_count || 0);

    let actions = '';
    if (!isAdmin) {
      if (user.status === 'pending') {
        actions = '<button class="admin-btn admin-btn-approve" data-uid="' + esc(user.uid) + '" data-action="approve" title="\u0e2d\u0e19\u0e38\u0e21\u0e31\u0e15\u0e34">\u2705 \u0e2d\u0e19\u0e38\u0e21\u0e31\u0e15\u0e34</button><button class="admin-btn admin-btn-reject" data-uid="' + esc(user.uid) + '" data-action="reject" title="\u0e1b\u0e0f\u0e34\u0e40\u0e2a\u0e18">\u274c \u0e1b\u0e0f\u0e34\u0e40\u0e2a\u0e18</button>';
      } else if (user.status === 'approved') {
        actions = '<select class="admin-pkg-select" data-uid="' + esc(user.uid) + '" title="\u0e40\u0e1b\u0e25\u0e35\u0e48\u0e22\u0e19 Package"><option value="free"' + (user.package === 'free' ? ' selected' : '') + '>\ud83c\udfb5 Free</option><option value="silver"' + (user.package === 'silver' ? ' selected' : '') + '>\ud83e\udd48 Silver</option><option value="gold"' + (user.package === 'gold' ? ' selected' : '') + '>\ud83e\udd47 Gold</option></select><button class="admin-btn admin-btn-more" data-uid="' + esc(user.uid) + '" title="\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e40\u0e15\u0e34\u0e21">\u22ef</button>';
      } else if (user.status === 'blocked') {
        actions = '<button class="admin-btn admin-btn-approve" data-uid="' + esc(user.uid) + '" data-action="unblock" title="\u0e1b\u0e25\u0e14\u0e1a\u0e25\u0e47\u0e2d\u0e01">\ud83d\udd13 \u0e1b\u0e25\u0e14\u0e1a\u0e25\u0e47\u0e2d\u0e01</button><button class="admin-btn admin-btn-more" data-uid="' + esc(user.uid) + '" title="\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e40\u0e15\u0e34\u0e21">\u22ef</button>';
      } else if (user.status === 'rejected') {
        actions = '<button class="admin-btn admin-btn-approve" data-uid="' + esc(user.uid) + '" data-action="approve" title="\u0e2d\u0e19\u0e38\u0e21\u0e31\u0e15\u0e34">\u2705 \u0e2d\u0e19\u0e38\u0e21\u0e31\u0e15\u0e34</button><button class="admin-btn admin-btn-more" data-uid="' + esc(user.uid) + '" title="\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e40\u0e15\u0e34\u0e21">\u22ef</button>';
      }
    }

    return '<div class="admin-user-card" data-uid="' + esc(user.uid) + '"><div class="admin-user-avatar' + (isAdmin ? ' admin-avatar' : '') + '">' + (user.name || 'U').charAt(0).toUpperCase() + '</div><div class="admin-user-info"><div class="admin-user-name">' + escH(user.name) + (isAdmin ? ' <span class="admin-badge">ADMIN</span>' : '') + '</div><div class="admin-user-email">' + escH(user.email) + '</div><div class="admin-user-meta"><span class="admin-status ' + st.cls + '">' + st.icon + ' ' + st.label + '</span><span class="admin-user-pkg pkg-' + (user.package || 'free') + '">' + pkgInfo.icon + ' ' + pkgInfo.label + '</span><span class="admin-user-data">' + dataInfo + '</span></div><div class="admin-user-date">\u0e2a\u0e21\u0e31\u0e04\u0e23: ' + date + '</div></div><div class="admin-user-actions">' + actions + '</div></div>';
  },

  showMoreMenu(uid, btnEl) {
    const existing = document.querySelector('.admin-context-menu');
    if (existing) existing.remove();

    const user = this.users.find(u => u.uid === uid);
    if (!user) return;

    const menu = document.createElement('div');
    menu.className = 'admin-context-menu';
    let items = '';
    if (user.status === 'approved') {
      items += '<button class="admin-ctx-item" data-action="block" data-uid="' + uid + '">\ud83d\udeab \u0e1a\u0e25\u0e47\u0e2d\u0e01\u0e2a\u0e21\u0e32\u0e0a\u0e34\u0e01</button>';
    }
    items += '<button class="admin-ctx-item" data-action="reset-pw" data-uid="' + uid + '">\ud83d\udd11 \u0e23\u0e35\u0e40\u0e0b\u0e47\u0e15\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19</button>';
    items += '<button class="admin-ctx-item admin-ctx-danger" data-action="delete" data-uid="' + uid + '">\ud83d\uddd1\ufe0f \u0e25\u0e1a\u0e2a\u0e21\u0e32\u0e0a\u0e34\u0e01</button>';
    menu.innerHTML = items;

    const rect = btnEl.getBoundingClientRect();
    menu.style.top = (rect.bottom + 4) + 'px';
    menu.style.right = (window.innerWidth - rect.right) + 'px';
    document.body.appendChild(menu);

    menu.addEventListener('click', async (e) => {
      const item = e.target.closest('.admin-ctx-item');
      if (!item) return;
      menu.remove();
      const action = item.dataset.action;
      const targetUid = item.dataset.uid;
      switch (action) {
        case 'block': await this.block(targetUid); break;
        case 'reset-pw': this.showResetPasswordDialog(targetUid); break;
        case 'delete': await this.deleteUser(targetUid); break;
      }
    });

    setTimeout(() => {
      const closer = (e) => {
        if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', closer); }
      };
      document.addEventListener('click', closer);
    }, 0);
  },

  showResetPasswordDialog(uid) {
    const user = this.users.find(u => u.uid === uid);
    if (!user) return;

    const overlay = document.createElement('div');
    overlay.className = 'admin-dialog-overlay';
    overlay.innerHTML = '<div class="admin-dialog"><h3>\ud83d\udd11 \u0e23\u0e35\u0e40\u0e0b\u0e47\u0e15\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19</h3><p style="color:var(--text-secondary);margin-bottom:16px;">\u0e2a\u0e21\u0e32\u0e0a\u0e34\u0e01: <strong>' + Library.escapeHtml(user.name) + '</strong> (' + Library.escapeHtml(user.email) + ')</p><input type="password" id="admin-new-pw" class="form-input" placeholder="\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19\u0e43\u0e2b\u0e21\u0e48 (\u0e2d\u0e22\u0e48\u0e32\u0e07\u0e19\u0e49\u0e2d\u0e22 6 \u0e15\u0e31\u0e27)" style="width:100%;margin-bottom:12px;box-sizing:border-box;"><div style="display:flex;gap:8px;justify-content:flex-end;"><button class="admin-btn admin-btn-cancel" id="admin-pw-cancel">\u0e22\u0e01\u0e40\u0e25\u0e34\u0e01</button><button class="admin-btn admin-btn-approve" id="admin-pw-confirm">\u0e23\u0e35\u0e40\u0e0b\u0e47\u0e15\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19</button></div><div id="admin-pw-msg" style="margin-top:8px;font-size:13px;"></div></div>';
    document.body.appendChild(overlay);

    overlay.querySelector('#admin-pw-cancel').onclick = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector('#admin-pw-confirm').onclick = async () => {
      const pw = document.getElementById('admin-new-pw').value;
      const msg = document.getElementById('admin-pw-msg');
      if (!pw || pw.length < 6) {
        msg.style.color = '#f44'; msg.textContent = '\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19\u0e15\u0e49\u0e2d\u0e07\u0e21\u0e35\u0e2d\u0e22\u0e48\u0e32\u0e07\u0e19\u0e49\u0e2d\u0e22 6 \u0e15\u0e31\u0e27\u0e2d\u0e31\u0e01\u0e29\u0e23';
        return;
      }
      const token = Auth.getToken();
      const res = await API.adminResetPassword(token, uid, pw);
      if (res.success) {
        overlay.remove();
        Toast.show('\u0e23\u0e35\u0e40\u0e0b\u0e47\u0e15\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08 \ud83d\udd11', 'success');
      } else {
        msg.style.color = '#f44'; msg.textContent = res.error || '\u0e40\u0e01\u0e34\u0e14\u0e02\u0e49\u0e2d\u0e1c\u0e34\u0e14\u0e1e\u0e25\u0e32\u0e14';
      }
    };
  },

  /* ===== Event Handlers ===== */
  attachEvents() {
    const container = document.getElementById('content-area');

    // Tab switching
    container.querySelectorAll('.admin-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.activeTab = tab.dataset.tab;
        this.render();
      });
    });

    // Upload area events (songs tab only)
    if (this.activeTab === 'songs') {
      const area = document.getElementById('upload-area');
      const input = document.getElementById('upload-input');
      const btn = document.getElementById('upload-btn');

      if (btn) btn.addEventListener('click', () => input.click());
      if (input) input.addEventListener('change', (e) => this.handleFiles(e.target.files));

      if (area) {
        area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('drag-over'); });
        area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
        area.addEventListener('drop', (e) => {
          e.preventDefault();
          area.classList.remove('drag-over');
          this.handleFiles(e.dataTransfer.files);
        });
      }

      // Song delete buttons
      container.querySelectorAll('.admin-song-del').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteSong(btn.dataset.id, btn.dataset.name);
        });
      });
    }

    // Members tab events
    if (this.activeTab === 'members') {
      const searchInput = document.getElementById('admin-search');
      if (searchInput) {
        let timer;
        searchInput.addEventListener('input', (e) => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            this.searchQuery = e.target.value.trim();
            this.render();
            const input = document.getElementById('admin-search');
            if (input) { input.focus(); input.selectionStart = input.selectionEnd = input.value.length; }
          }, 200);
        });
      }

      container.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('.admin-btn[data-action]');
        if (actionBtn) {
          const uid = actionBtn.dataset.uid;
          const action = actionBtn.dataset.action;
          switch (action) {
            case 'approve': this.approve(uid); break;
            case 'reject': this.reject(uid); break;
            case 'unblock': this.unblock(uid); break;
          }
          return;
        }
        const moreBtn = e.target.closest('.admin-btn-more');
        if (moreBtn) {
          e.stopPropagation();
          this.showMoreMenu(moreBtn.dataset.uid, moreBtn);
          return;
        }
      });

      container.addEventListener('change', (e) => {
        const select = e.target.closest('.admin-pkg-select');
        if (select) this.setPackage(select.dataset.uid, select.value);
      });
    }
  },

  /* ===== File Upload ===== */
  async handleFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    const token = Auth.getToken();
    const maxSize = 10 * 1024 * 1024;
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/bmp'];
    const progress = document.getElementById('upload-progress');
    let html = '';
    const files = Array.from(fileList);

    for (const file of files) {
      const name = file.name.replace(/\.[^.]+$/, '');
      html += '<div class="upload-item" id="upload-' + name + '">';
      html += '<span class="upload-item-name">' + Library.escapeHtml(file.name) + '</span>';
      html += '<span class="upload-item-status">\u23f3</span></div>';
    }
    progress.innerHTML = html;
    progress.style.display = 'block';

    for (const file of files) {
      const name = file.name.replace(/\.[^.]+$/, '');
      const el = document.getElementById('upload-' + name);
      const statusEl = el ? el.querySelector('.upload-item-status') : null;

      if (!allowed.includes(file.type)) {
        if (statusEl) { statusEl.textContent = '\u274c \u0e44\u0e1f\u0e25\u0e4c\u0e44\u0e21\u0e48\u0e23\u0e2d\u0e07\u0e23\u0e31\u0e1a'; statusEl.style.color = '#f44'; }
        continue;
      }
      if (file.size > maxSize) {
        if (statusEl) { statusEl.textContent = '\u274c \u0e44\u0e1f\u0e25\u0e4c\u0e43\u0e2b\u0e0d\u0e48\u0e40\u0e01\u0e34\u0e19 10MB'; statusEl.style.color = '#f44'; }
        continue;
      }

      if (statusEl) statusEl.textContent = '\u2b06\ufe0f \u0e01\u0e33\u0e25\u0e31\u0e07\u0e2d\u0e31\u0e1e\u0e42\u0e2b\u0e25\u0e14...';

      try {
        const base64 = await this.readFileAsBase64(file);
        const res = await API.uploadSong(token, name, base64, file.type);
        if (res.success) {
          if (statusEl) { statusEl.textContent = '\u2705 \u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08'; statusEl.style.color = '#4caf50'; }
        } else {
          if (statusEl) { statusEl.textContent = '\u274c ' + (res.error || '\u0e1c\u0e34\u0e14\u0e1e\u0e25\u0e32\u0e14'); statusEl.style.color = '#f44'; }
        }
      } catch (err) {
        if (statusEl) { statusEl.textContent = '\u274c \u0e2d\u0e48\u0e32\u0e19\u0e44\u0e1f\u0e25\u0e4c\u0e1c\u0e34\u0e14\u0e1e\u0e25\u0e32\u0e14'; statusEl.style.color = '#f44'; }
      }
    }

    // Reload songs list
    Toast.show('\u0e2d\u0e31\u0e1e\u0e42\u0e2b\u0e25\u0e14\u0e40\u0e2a\u0e23\u0e47\u0e08\u0e2a\u0e34\u0e49\u0e19!', 'success');
    const sRes = await API.adminListSongs(token);
    if (sRes.success && sRes.data) this.songs = sRes.data.songs || [];
    // Refresh library cache too
    if (typeof Library !== 'undefined' && Library.loadSongs) Library.loadSongs();
    setTimeout(() => this.render(), 1500);
  },

  readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  /* ===== Song Delete ===== */
  async deleteSong(songId, songName) {
    if (!confirm('\u0e25\u0e1a\u0e42\u0e19\u0e49\u0e15\u0e40\u0e1e\u0e25\u0e07 "' + songName + '"?\n\u0e01\u0e32\u0e23\u0e01\u0e23\u0e30\u0e17\u0e33\u0e19\u0e35\u0e49\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e40\u0e25\u0e34\u0e01\u0e17\u0e33\u0e44\u0e14\u0e49!')) return;
    const token = Auth.getToken();
    const res = await API.adminDeleteSong(token, songId);
    if (res.success) {
      Toast.show('\u0e25\u0e1a\u0e42\u0e19\u0e49\u0e15\u0e40\u0e1e\u0e25\u0e07\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08', 'success');
      this.songs = this.songs.filter(s => String(s.id) !== String(songId));
      this.render();
      if (typeof Library !== 'undefined' && Library.loadSongs) Library.loadSongs();
    } else {
      Toast.show(res.error || '\u0e40\u0e01\u0e34\u0e14\u0e02\u0e49\u0e2d\u0e1c\u0e34\u0e14\u0e1e\u0e25\u0e32\u0e14', 'error');
    }
  },

  /* ===== Member Management Actions ===== */
  async approve(uid) {
    const token = Auth.getToken();
    const res = await API.adminApprove(token, uid);
    if (res.success) { Toast.show('\u0e2d\u0e19\u0e38\u0e21\u0e31\u0e15\u0e34\u0e2a\u0e21\u0e32\u0e0a\u0e34\u0e01\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08 \u2705', 'success'); this.renderView(); }
    else Toast.show(res.error || '\u0e40\u0e01\u0e34\u0e14\u0e02\u0e49\u0e2d\u0e1c\u0e34\u0e14\u0e1e\u0e25\u0e32\u0e14', 'error');
  },

  async reject(uid) {
    if (!confirm('\u0e1b\u0e0f\u0e34\u0e40\u0e2a\u0e18\u0e2a\u0e21\u0e32\u0e0a\u0e34\u0e01\u0e19\u0e35\u0e49?')) return;
    const token = Auth.getToken();
    const res = await API.adminReject(token, uid);
    if (res.success) { Toast.show('\u0e1b\u0e0f\u0e34\u0e40\u0e2a\u0e18\u0e2a\u0e21\u0e32\u0e0a\u0e34\u0e01\u0e41\u0e25\u0e49\u0e27', 'info'); this.renderView(); }
    else Toast.show(res.error || '\u0e40\u0e01\u0e34\u0e14\u0e02\u0e49\u0e2d\u0e1c\u0e34\u0e14\u0e1e\u0e25\u0e32\u0e14', 'error');
  },

  async block(uid) {
    const user = this.users.find(u => u.uid === uid);
    if (!confirm('\u0e1a\u0e25\u0e47\u0e2d\u0e01 "' + (user ? user.name : '') + '"?\n\u0e2a\u0e21\u0e32\u0e0a\u0e34\u0e01\u0e08\u0e30\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e40\u0e02\u0e49\u0e32\u0e2a\u0e39\u0e48\u0e23\u0e30\u0e1a\u0e1a\u0e44\u0e14\u0e49')) return;
    const token = Auth.getToken();
    const res = await API.adminBlock(token, uid);
    if (res.success) { Toast.show('\u0e1a\u0e25\u0e47\u0e2d\u0e01\u0e2a\u0e21\u0e32\u0e0a\u0e34\u0e01\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08 \ud83d\udeab', 'info'); this.renderView(); }
    else Toast.show(res.error || '\u0e40\u0e01\u0e34\u0e14\u0e02\u0e49\u0e2d\u0e1c\u0e34\u0e14\u0e1e\u0e25\u0e32\u0e14', 'error');
  },

  async unblock(uid) {
    const token = Auth.getToken();
    const res = await API.adminUnblock(token, uid);
    if (res.success) { Toast.show('\u0e1b\u0e25\u0e14\u0e1a\u0e25\u0e47\u0e2d\u0e01\u0e2a\u0e21\u0e32\u0e0a\u0e34\u0e01\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08 \ud83d\udd13', 'success'); this.renderView(); }
    else Toast.show(res.error || '\u0e40\u0e01\u0e34\u0e14\u0e02\u0e49\u0e2d\u0e1c\u0e34\u0e14\u0e1e\u0e25\u0e32\u0e14', 'error');
  },

  async deleteUser(uid) {
    const user = this.users.find(u => u.uid === uid);
    const name = user ? user.name : '';
    if (!confirm('\u26a0\ufe0f \u0e25\u0e1a\u0e2a\u0e21\u0e32\u0e0a\u0e34\u0e01 "' + name + '" ?\n\n\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14\u0e08\u0e30\u0e16\u0e39\u0e01\u0e25\u0e1a:\n- \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e42\u0e1b\u0e23\u0e14\n- Setlists\n- \u0e1b\u0e23\u0e30\u0e27\u0e31\u0e15\u0e34\u0e40\u0e1e\u0e25\u0e07\n- Sessions\n\n\u0e01\u0e32\u0e23\u0e01\u0e23\u0e30\u0e17\u0e33\u0e19\u0e35\u0e49\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e40\u0e25\u0e34\u0e01\u0e17\u0e33\u0e44\u0e14\u0e49!')) return;
    if (!confirm('\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e25\u0e1a "' + name + '" \u0e2d\u0e35\u0e01\u0e04\u0e23\u0e31\u0e49\u0e07?')) return;
    const token = Auth.getToken();
    const res = await API.adminDeleteUser(token, uid);
    if (res.success) { Toast.show(res.data.message || '\u0e25\u0e1a\u0e2a\u0e21\u0e32\u0e0a\u0e34\u0e01\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08', 'success'); this.renderView(); }
    else Toast.show(res.error || '\u0e40\u0e01\u0e34\u0e14\u0e02\u0e49\u0e2d\u0e1c\u0e34\u0e14\u0e1e\u0e25\u0e32\u0e14', 'error');
  },

  async setPackage(uid, pkg) {
    const token = Auth.getToken();
    const res = await API.adminSetPackage(token, uid, pkg);
    if (res.success) Toast.show('\u0e40\u0e1b\u0e25\u0e35\u0e48\u0e22\u0e19 package \u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08', 'success');
    else Toast.show(res.error || '\u0e40\u0e01\u0e34\u0e14\u0e02\u0e49\u0e2d\u0e1c\u0e34\u0e14\u0e1e\u0e25\u0e32\u0e14', 'error');
  }
};
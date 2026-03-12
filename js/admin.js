/* ============================================
   Note Chord SoulCiety — Admin Module
   Full member management
   ============================================ */

const Admin = {
  users: [],
  searchQuery: '',

  async load() {
    const token = Auth.getToken();
    if (!token || !Auth.isAdmin()) return;

    const res = await API.adminListUsers(token);
    if (res.success && res.data) {
      this.users = res.data.users || [];
    }
  },

  renderView() {
    const container = document.getElementById('content-area');
    document.getElementById('topbar-title').textContent = 'จัดการสมาชิก (Admin)';

    if (!Auth.isAdmin()) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔒</div>
          <h3>ไม่ได้รับอนุญาต</h3>
          <p>เฉพาะ Admin เท่านั้น</p>
        </div>`;
      return;
    }

    container.innerHTML = '<div class="loading-overlay"><div class="loading-spinner"></div></div>';
    this.load().then(() => this.renderUsers());
  },

  getFilteredUsers() {
    if (!this.searchQuery) return this.users;
    const q = this.searchQuery.toLowerCase();
    return this.users.filter(u =>
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  },

  renderUsers() {
    const container = document.getElementById('content-area');
    const all = this.getFilteredUsers();
    const pending  = all.filter(u => u.status === 'pending');
    const approved = all.filter(u => u.status === 'approved');
    const blocked  = all.filter(u => u.status === 'blocked');
    const rejected = all.filter(u => u.status === 'rejected');

    let html = '';

    // Summary stats
    html += `
      <div class="admin-summary">
        <div class="admin-stat"><span class="admin-stat-num">${this.users.length}</span><span class="admin-stat-label">ทั้งหมด</span></div>
        <div class="admin-stat"><span class="admin-stat-num" style="color:#f0c75e;">${this.users.filter(u=>u.status==='pending').length}</span><span class="admin-stat-label">รออนุมัติ</span></div>
        <div class="admin-stat"><span class="admin-stat-num" style="color:#4caf50;">${this.users.filter(u=>u.status==='approved').length}</span><span class="admin-stat-label">อนุมัติ</span></div>
        <div class="admin-stat"><span class="admin-stat-num" style="color:#f44336;">${this.users.filter(u=>u.status==='blocked').length}</span><span class="admin-stat-label">บล็อก</span></div>
      </div>`;

    // Search bar
    html += `
      <div class="admin-search-bar">
        <input type="text" id="admin-search" class="form-input" placeholder="🔍 ค้นหาสมาชิก (ชื่อ / อีเมล)..." value="${Library.escapeAttr(this.searchQuery)}" style="width:100%;max-width:400px;">
      </div>`;

    // Pending
    if (pending.length > 0) {
      html += this.renderSection('⏳ รอการอนุมัติ', pending.length, 'pending');
      pending.forEach(u => { html += this.renderUserCard(u); });
      html += '</div>';
    }

    // Approved
    html += this.renderSection('✅ สมาชิกที่อนุมัติแล้ว', approved.length, 'approved');
    if (approved.length === 0) {
      html += '<div style="color:var(--text-muted); padding:16px;">ไม่พบสมาชิก</div>';
    }
    approved.forEach(u => { html += this.renderUserCard(u); });
    html += '</div>';

    // Blocked
    if (blocked.length > 0) {
      html += this.renderSection('🚫 ถูกบล็อก', blocked.length, 'blocked');
      blocked.forEach(u => { html += this.renderUserCard(u); });
      html += '</div>';
    }

    // Rejected
    if (rejected.length > 0) {
      html += this.renderSection('❌ ปฏิเสธแล้ว', rejected.length, 'rejected');
      rejected.forEach(u => { html += this.renderUserCard(u); });
      html += '</div>';
    }

    container.innerHTML = html;
    this.attachEvents();
  },

  renderSection(title, count, type) {
    return `
      <div class="admin-section-title">${title} <span class="admin-section-count">(${count})</span></div>
      <div class="admin-user-list" data-section="${type}">`;
  },

  renderUserCard(user) {
    const pkgInfo = CONFIG.PACKAGES[user.package || 'free'] || CONFIG.PACKAGES.free;
    const date = user.created_at ? new Date(user.created_at).toLocaleDateString('th-TH', {year:'numeric',month:'short',day:'numeric'}) : '';
    const isAdmin = user.email === CONFIG.ADMIN_EMAIL;
    const esc = Library.escapeAttr;
    const escH = Library.escapeHtml;

    // Status badge
    const statusMap = {
      pending: {icon: '⏳', label: 'รออนุมัติ', cls: 'status-pending'},
      approved: {icon: '✅', label: 'อนุมัติ', cls: 'status-approved'},
      blocked: {icon: '🚫', label: 'ถูกบล็อก', cls: 'status-blocked'},
      rejected: {icon: '❌', label: 'ปฏิเสธ', cls: 'status-rejected'}
    };
    const st = statusMap[user.status] || statusMap.pending;

    // Data counts
    const dataInfo = `⭐${user.fav_count || 0} 📋${user.setlist_count || 0} 🕐${user.recent_count || 0}`;

    // Action buttons based on status
    let actions = '';
    if (!isAdmin) {
      if (user.status === 'pending') {
        actions = `
          <button class="admin-btn admin-btn-approve" data-uid="${esc(user.uid)}" data-action="approve" title="อนุมัติ">✅ อนุมัติ</button>
          <button class="admin-btn admin-btn-reject" data-uid="${esc(user.uid)}" data-action="reject" title="ปฏิเสธ">❌ ปฏิเสธ</button>`;
      } else if (user.status === 'approved') {
        actions = `
          <select class="admin-pkg-select" data-uid="${esc(user.uid)}" title="เปลี่ยน Package">
            <option value="free" ${user.package === 'free' ? 'selected' : ''}>🎵 Free</option>
            <option value="silver" ${user.package === 'silver' ? 'selected' : ''}>🥈 Silver</option>
            <option value="gold" ${user.package === 'gold' ? 'selected' : ''}>🥇 Gold</option>
          </select>
          <button class="admin-btn admin-btn-more" data-uid="${esc(user.uid)}" title="เพิ่มเติม">⋯</button>`;
      } else if (user.status === 'blocked') {
        actions = `
          <button class="admin-btn admin-btn-approve" data-uid="${esc(user.uid)}" data-action="unblock" title="ปลดบล็อก">🔓 ปลดบล็อก</button>
          <button class="admin-btn admin-btn-more" data-uid="${esc(user.uid)}" title="เพิ่มเติม">⋯</button>`;
      } else if (user.status === 'rejected') {
        actions = `
          <button class="admin-btn admin-btn-approve" data-uid="${esc(user.uid)}" data-action="approve" title="อนุมัติ">✅ อนุมัติ</button>
          <button class="admin-btn admin-btn-more" data-uid="${esc(user.uid)}" title="เพิ่มเติม">⋯</button>`;
      }
    }

    return `
      <div class="admin-user-card" data-uid="${esc(user.uid)}">
        <div class="admin-user-avatar ${isAdmin ? 'admin-avatar' : ''}">${(user.name || 'U').charAt(0).toUpperCase()}</div>
        <div class="admin-user-info">
          <div class="admin-user-name">${escH(user.name)}${isAdmin ? ' <span class="admin-badge">ADMIN</span>' : ''}</div>
          <div class="admin-user-email">${escH(user.email)}</div>
          <div class="admin-user-meta">
            <span class="admin-status ${st.cls}">${st.icon} ${st.label}</span>
            <span class="admin-user-pkg pkg-${user.package || 'free'}">${pkgInfo.icon} ${pkgInfo.label}</span>
            <span class="admin-user-data">${dataInfo}</span>
          </div>
          <div class="admin-user-date">สมัคร: ${date}</div>
        </div>
        <div class="admin-user-actions">
          ${actions}
        </div>
      </div>`;
  },

  // Context menu for more actions (block, reset password, delete)
  showMoreMenu(uid, btnEl) {
    // Remove existing menu
    const existing = document.querySelector('.admin-context-menu');
    if (existing) existing.remove();

    const user = this.users.find(u => u.uid === uid);
    if (!user) return;

    const menu = document.createElement('div');
    menu.className = 'admin-context-menu';

    let items = '';
    if (user.status === 'approved') {
      items += `<button class="admin-ctx-item" data-action="block" data-uid="${uid}">🚫 บล็อกสมาชิก</button>`;
    }
    items += `<button class="admin-ctx-item" data-action="reset-pw" data-uid="${uid}">🔑 รีเซ็ตรหัสผ่าน</button>`;
    items += `<button class="admin-ctx-item admin-ctx-danger" data-action="delete" data-uid="${uid}">🗑️ ลบสมาชิก</button>`;

    menu.innerHTML = items;

    // Position relative to button
    const rect = btnEl.getBoundingClientRect();
    menu.style.top = (rect.bottom + 4) + 'px';
    menu.style.right = (window.innerWidth - rect.right) + 'px';
    document.body.appendChild(menu);

    // Handle clicks
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

    // Close on outside click
    setTimeout(() => {
      const closer = (e) => {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener('click', closer);
        }
      };
      document.addEventListener('click', closer);
    }, 0);
  },

  showResetPasswordDialog(uid) {
    const user = this.users.find(u => u.uid === uid);
    if (!user) return;

    const overlay = document.createElement('div');
    overlay.className = 'admin-dialog-overlay';
    overlay.innerHTML = `
      <div class="admin-dialog">
        <h3>🔑 รีเซ็ตรหัสผ่าน</h3>
        <p style="color:var(--text-secondary);margin-bottom:16px;">สมาชิก: <strong>${Library.escapeHtml(user.name)}</strong> (${Library.escapeHtml(user.email)})</p>
        <input type="password" id="admin-new-pw" class="form-input" placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)" style="width:100%;margin-bottom:12px;box-sizing:border-box;">
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="admin-btn admin-btn-cancel" id="admin-pw-cancel">ยกเลิก</button>
          <button class="admin-btn admin-btn-approve" id="admin-pw-confirm">รีเซ็ตรหัสผ่าน</button>
        </div>
        <div id="admin-pw-msg" style="margin-top:8px;font-size:13px;"></div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('#admin-pw-cancel').onclick = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector('#admin-pw-confirm').onclick = async () => {
      const pw = document.getElementById('admin-new-pw').value;
      const msg = document.getElementById('admin-pw-msg');
      if (!pw || pw.length < 6) {
        msg.style.color = '#f44'; msg.textContent = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
        return;
      }
      const token = Auth.getToken();
      const res = await API.adminResetPassword(token, uid, pw);
      if (res.success) {
        overlay.remove();
        Toast.show('รีเซ็ตรหัสผ่านสำเร็จ 🔑', 'success');
      } else {
        msg.style.color = '#f44'; msg.textContent = res.error || 'เกิดข้อผิดพลาด';
      }
    };
  },

  attachEvents() {
    const container = document.getElementById('content-area');

    // Search
    const searchInput = document.getElementById('admin-search');
    if (searchInput) {
      let timer;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          this.searchQuery = e.target.value.trim();
          this.renderUsers();
          // Re-focus search after re-render
          const input = document.getElementById('admin-search');
          if (input) { input.focus(); input.selectionStart = input.selectionEnd = input.value.length; }
        }, 200);
      });
    }

    // Event delegation for all admin actions
    container.addEventListener('click', (e) => {
      // Action buttons (approve, reject, unblock)
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

      // More menu button
      const moreBtn = e.target.closest('.admin-btn-more');
      if (moreBtn) {
        e.stopPropagation();
        this.showMoreMenu(moreBtn.dataset.uid, moreBtn);
        return;
      }
    });

    // Package select change
    container.addEventListener('change', (e) => {
      const select = e.target.closest('.admin-pkg-select');
      if (select) {
        this.setPackage(select.dataset.uid, select.value);
      }
    });
  },

  async approve(uid) {
    const token = Auth.getToken();
    const res = await API.adminApprove(token, uid);
    if (res.success) {
      Toast.show('อนุมัติสมาชิกสำเร็จ ✅', 'success');
      this.renderView();
    } else {
      Toast.show(res.error || 'เกิดข้อผิดพลาด', 'error');
    }
  },

  async reject(uid) {
    if (!confirm('ปฏิเสธสมาชิกนี้?')) return;
    const token = Auth.getToken();
    const res = await API.adminReject(token, uid);
    if (res.success) {
      Toast.show('ปฏิเสธสมาชิกแล้ว', 'info');
      this.renderView();
    } else {
      Toast.show(res.error || 'เกิดข้อผิดพลาด', 'error');
    }
  },

  async block(uid) {
    const user = this.users.find(u => u.uid === uid);
    if (!confirm('บล็อก "' + (user ? user.name : '') + '"?\nสมาชิกจะไม่สามารถเข้าสู่ระบบได้')) return;
    const token = Auth.getToken();
    const res = await API.adminBlock(token, uid);
    if (res.success) {
      Toast.show('บล็อกสมาชิกสำเร็จ 🚫', 'info');
      this.renderView();
    } else {
      Toast.show(res.error || 'เกิดข้อผิดพลาด', 'error');
    }
  },

  async unblock(uid) {
    const token = Auth.getToken();
    const res = await API.adminUnblock(token, uid);
    if (res.success) {
      Toast.show('ปลดบล็อกสมาชิกสำเร็จ 🔓', 'success');
      this.renderView();
    } else {
      Toast.show(res.error || 'เกิดข้อผิดพลาด', 'error');
    }
  },

  async deleteUser(uid) {
    const user = this.users.find(u => u.uid === uid);
    const name = user ? user.name : '';
    if (!confirm('⚠️ ลบสมาชิก "' + name + '" ?\n\nข้อมูลทั้งหมดจะถูกลบ:\n- รายการโปรด\n- Setlists\n- ประวัติเพลง\n- Sessions\n\nการกระทำนี้ไม่สามารถเลิกทำได้!')) return;
    if (!confirm('ยืนยันลบ "' + name + '" อีกครั้ง?')) return;

    const token = Auth.getToken();
    const res = await API.adminDeleteUser(token, uid);
    if (res.success) {
      Toast.show(res.data.message || 'ลบสมาชิกสำเร็จ', 'success');
      this.renderView();
    } else {
      Toast.show(res.error || 'เกิดข้อผิดพลาด', 'error');
    }
  },

  async setPackage(uid, pkg) {
    const token = Auth.getToken();
    const res = await API.adminSetPackage(token, uid, pkg);
    if (res.success) {
      Toast.show('เปลี่ยน package สำเร็จ', 'success');
    } else {
      Toast.show(res.error || 'เกิดข้อผิดพลาด', 'error');
    }
  }
};

/* ============================================
   Note Chord SoulCiety — Admin Module
   ============================================ */

const Admin = {
  users: [],

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

  renderUsers() {
    const container = document.getElementById('content-area');
    const pending = this.users.filter(u => u.status === 'pending');
    const approved = this.users.filter(u => u.status === 'approved');
    const rejected = this.users.filter(u => u.status === 'rejected');

    let html = '';

    // Pending users
    if (pending.length > 0) {
      html += `
        <div class="nav-section-title" style="padding:0 0 8px;">รอการอนุมัติ (${pending.length})</div>
        <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:24px;">`;
      pending.forEach(u => {
        html += this.renderUserRow(u, true);
      });
      html += '</div>';
    }

    // Approved users
    html += `
      <div class="nav-section-title" style="padding:0 0 8px;">สมาชิกที่อนุมัติแล้ว (${approved.length})</div>
      <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:24px;">`;
    if (approved.length === 0) {
      html += '<div style="color:var(--text-muted); padding:12px;">ยังไม่มีสมาชิก</div>';
    }
    approved.forEach(u => {
      html += this.renderUserRow(u, false);
    });
    html += '</div>';

    // Rejected users
    if (rejected.length > 0) {
      html += `
        <div class="nav-section-title" style="padding:0 0 8px;">ปฏิเสธแล้ว (${rejected.length})</div>
        <div style="display:flex; flex-direction:column; gap:6px;">`;
      rejected.forEach(u => {
        html += this.renderUserRow(u, false, true);
      });
      html += '</div>';
    }

    container.innerHTML = html;
    this.attachEvents();
  },

  renderUserRow(user, showActions, isRejected) {
    const pkgClass = 'pkg-' + (user.package || 'free');
    const pkgInfo = CONFIG.PACKAGES[user.package || 'free'] || CONFIG.PACKAGES.free;
    const date = user.created_at ? new Date(user.created_at).toLocaleDateString('th-TH') : '';

    let actionsHtml = '';

    if (showActions) {
      actionsHtml = `
        <button class="btn btn-sm btn-accent" onclick="Admin.approve('${user.uid}')" style="padding:6px 12px; font-size:12px;">✅ อนุมัติ</button>
        <button class="btn btn-sm btn-danger" onclick="Admin.reject('${user.uid}')" style="padding:6px 12px; font-size:12px;">❌ ปฏิเสธ</button>`;
    } else if (!isRejected) {
      actionsHtml = `
        <select class="form-input" style="width:auto; padding:4px 8px; font-size:12px;" onchange="Admin.setPackage('${user.uid}', this.value)" title="เปลี่ยน Package">
          <option value="free" ${user.package === 'free' ? 'selected' : ''}>🎵 Free</option>
          <option value="silver" ${user.package === 'silver' ? 'selected' : ''}>🥈 Silver</option>
          <option value="gold" ${user.package === 'gold' ? 'selected' : ''}>🥇 Gold</option>
        </select>`;
    } else {
      actionsHtml = `
        <button class="btn btn-sm btn-accent" onclick="Admin.approve('${user.uid}')" style="padding:6px 12px; font-size:12px;">✅ อนุมัติ</button>`;
    }

    return `
      <div class="song-row" style="cursor:default;">
        <span class="song-row-icon" style="font-size:22px;">👤</span>
        <div style="flex:1; min-width:0;">
          <div style="font-weight:600; font-size:14px;">${Library.escapeHtml(user.name)}</div>
          <div style="font-size:12px; color:var(--text-secondary);">${Library.escapeHtml(user.email)}</div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">สมัคร: ${date}</div>
        </div>
        <span class="sidebar-user-package ${pkgClass}" style="font-size:11px;">${pkgInfo.icon} ${pkgInfo.label}</span>
        <div style="display:flex; gap:4px; align-items:center;">
          ${actionsHtml}
        </div>
      </div>`;
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

  async setPackage(uid, pkg) {
    const token = Auth.getToken();
    const res = await API.adminSetPackage(token, uid, pkg);
    if (res.success) {
      Toast.show('เปลี่ยน package สำเร็จ', 'success');
    } else {
      Toast.show(res.error || 'เกิดข้อผิดพลาด', 'error');
    }
  },

  attachEvents() {
    // Any additional event binding
  }
};

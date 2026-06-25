/* ============================================
   Note Chord SoulCiety — Settings Module
   Per-user Google Drive folder configuration
   ============================================ */

const Settings = {
  /* ---------- Load per-user settings ---------- */
  async loadUserSettings() {
    const token = Auth.getToken();
    if (!token) return {};
    const res = await API.getUserSettings(token);
    if (res.success && res.data) return res.data;
    return {};
  },

  /* ---------- Save per-user settings ---------- */
  async saveUserSettings(data) {
    const token = Auth.getToken();
    if (!token) return { success: false, error: 'ไม่มีการยืนยันตัวตน' };
    return API.saveUserSettings(token, data);
  },

  /* ---------- Render the settings view ---------- */
  async renderView() {
    const container = document.getElementById('content-area');
    document.getElementById('topbar-title').textContent = 'ตั้งค่า / เปลี่ยนรหัสผ่าน';

    container.innerHTML = '<div class="loading-overlay"><div class="loading-spinner"></div></div>';

    const esc = Library.escapeHtml;
    const userSettings = await this.loadUserSettings();

    let html = '<div class="settings-container">';

    /* ---- Drive folder section ---- */
    html += '<div class="settings-section">';
    html += '<div class="settings-section-icon">☁️</div>';
    html += '<h3 class="settings-section-title">Google Drive ของคุณ</h3>';
    html += '<p class="settings-section-desc">' +
      'วาง URL โฟลเดอร์ Google Drive ที่เก็บไฟล์โน้ตเพลงของคุณ (PDF / รูปภาพ)<br>' +
      'ตัวอย่าง: <code style="font-size:0.8rem;color:var(--accent);">https://drive.google.com/drive/folders/1-pg1F3716VRZ7xMAcPtlRL_hJJSYIIbM</code><br>' +
      '<strong>⚠️ ต้องตั้งค่า folder เป็น "Anyone with the link" (Viewer)</strong>' +
    '</p>';

    html += '<div class="settings-field">';
    html += '<label class="settings-label" for="user-setting-drive">Drive Folder URLs (ใส่ได้หลายลิงก์โดยขึ้นบรรทัดใหม่)</label>';
    html += '<textarea id="user-setting-drive" class="settings-input" ' +
      'placeholder="https://drive.google.com/drive/folders/...\nhttps://drive.google.com/drive/folders/..." ' +
      'style="height:80px;resize:vertical;">' + esc(userSettings.google_drive_url || '') + '</textarea>';
    html += '</div>';

    // Status indicator: show file count if URL is saved
    if (userSettings.google_drive_url) {
      html += '<div id="drive-status" style="margin-top:10px;font-size:0.82rem;color:var(--text-muted);">📂 บันทึกแล้ว — โหลดหน้า Library เพื่อดูรายการไฟล์</div>';
    }

    html += '<div class="settings-actions">';
    html += '<button class="btn btn-primary" id="user-settings-save-btn">💾 บันทึก</button>';
    html += '<span id="user-settings-status" class="settings-status"></span>';
    html += '</div>';
    html += '</div>'; // .settings-section

    /* ---- Help section ---- */
    html += '<div class="settings-section" style="background:var(--bg-tertiary)">';
    html += '<div class="settings-section-icon" style="font-size:1.4rem">📖</div>';
    html += '<h3 class="settings-section-title" style="font-size:1rem">วิธีตั้งค่า Google Drive</h3>';
    html += '<ol style="padding-left:1.2rem;color:var(--text-secondary);font-size:0.85rem;line-height:2">' +
      '<li>เปิด Google Drive แล้วสร้างโฟลเดอร์สำหรับเก็บโน้ตเพลง</li>' +
      '<li>คลิกขวาที่โฟลเดอร์ → <strong>Share</strong> → <strong>Anyone with the link</strong> → <strong>Viewer</strong></li>' +
      '<li>อัปโหลดไฟล์ PDF หรือรูปภาพลงในโฟลเดอร์ (ชื่อไฟล์ = ชื่อเพลง)</li>' +
      '<li>คัดลอก URL ของโฟลเดอร์แล้ววางในช่องด้านบน</li>' +
      '<li>กด <strong>บันทึก</strong> แล้วเปิดหน้า <strong>Library</strong> เพื่อดูรายการเพลง</li>' +
    '</ol>';
    html += '<div style="margin-top:8px;padding:10px 14px;background:var(--bg-secondary);border-radius:var(--radius-sm);font-size:0.8rem;color:var(--text-muted);">' +
      '💡 ชื่อไฟล์คือชื่อเพลง — เช่น <code>ยังรัก.pdf</code> จะแสดงเป็นชื่อเพลง "ยังรัก"<br>' +
      '📁 ไฟล์ใน subfolder จะไม่แสดง — วางตรงใน folder ที่ระบุ' +
    '</div>';
    html += '</div>'; // help section

    /* ---- Password Change section ---- */
    html += '<div class="settings-section" style="margin-top:20px;">';
    html += '<div class="settings-section-icon">🔐</div>';
    html += '<h3 class="settings-section-title">เปลี่ยนรหัสผ่าน</h3>';

    html += '<div class="settings-field">';
    html += '<label class="settings-label" for="old-password">รหัสผ่านเดิม</label>';
    html += '<input type="password" id="old-password" class="settings-input" />';
    html += '</div>';

    html += '<div class="settings-field">';
    html += '<label class="settings-label" for="new-password">รหัสผ่านใหม่</label>';
    html += '<input type="password" id="new-password" class="settings-input" />';
    html += '</div>';

    html += '<div class="settings-field">';
    html += '<label class="settings-label" for="confirm-password">ยืนยันรหัสผ่านใหม่</label>';
    html += '<input type="password" id="confirm-password" class="settings-input" />';
    html += '</div>';

    html += '<div class="settings-actions">';
    html += '<button class="btn btn-primary" id="btn-change-pw">เปลี่ยนรหัสผ่าน</button>';
    html += '<span id="pw-message" class="settings-status" style="margin-left:10px;"></span>';
    html += '</div>';
    html += '</div>'; // password section

    html += '</div>'; // .settings-container

    container.innerHTML = html;
    this.attachEvents();
  },

  /* ---------- Event handlers ---------- */
  attachEvents() {
    const saveBtn = document.getElementById('user-settings-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', () => this.handleSave());

    const changePwBtn = document.getElementById('btn-change-pw');
    if (changePwBtn) changePwBtn.addEventListener('click', () => this.handleChangePassword());
  },

  async handleChangePassword() {
    const oldPw = document.getElementById('old-password').value;
    const newPw = document.getElementById('new-password').value;
    const confPw = document.getElementById('confirm-password').value;
    const msgEl = document.getElementById('pw-message');

    if (!oldPw || !newPw || !confPw) {
      msgEl.textContent = 'กรุณากรอกข้อมูลให้ครบ';
      msgEl.className = 'settings-status settings-status-err';
      return;
    }

    if (newPw.length < 6) {
      msgEl.textContent = 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร';
      msgEl.className = 'settings-status settings-status-err';
      return;
    }

    if (newPw !== confPw) {
      msgEl.textContent = 'รหัสผ่านใหม่และการยืนยันไม่ตรงกัน';
      msgEl.className = 'settings-status settings-status-err';
      return;
    }

    const btn = document.getElementById('btn-change-pw');
    btn.disabled = true;
    btn.textContent = '⏳ กำลังเปลี่ยน...';
    msgEl.textContent = '';

    const res = await API.changePassword(oldPw, newPw);

    btn.disabled = false;
    btn.textContent = 'เปลี่ยนรหัสผ่าน';

    if (res.success) {
      msgEl.textContent = '✅ เปลี่ยนรหัสผ่านสำเร็จ';
      msgEl.className = 'settings-status settings-status-ok';
      document.getElementById('old-password').value = '';
      document.getElementById('new-password').value = '';
      document.getElementById('confirm-password').value = '';
      Toast.show('เปลี่ยนรหัสผ่านสำเร็จ', 'success');
    } else {
      msgEl.textContent = '❌ ' + (res.error || 'เกิดข้อผิดพลาด');
      msgEl.className = 'settings-status settings-status-err';
    }
  },

  /* ---------- Save handler ---------- */
  async handleSave() {
    const driveUrl = document.getElementById('user-setting-drive').value.trim();
    const statusEl = document.getElementById('user-settings-status');
    const btn = document.getElementById('user-settings-save-btn');

    btn.disabled = true;
    btn.textContent = '⏳ กำลังบันทึก...';
    statusEl.textContent = '';
    statusEl.className = 'settings-status';

    const res = await this.saveUserSettings({ google_drive_url: driveUrl });

    btn.disabled = false;
    btn.textContent = '💾 บันทึก';

    if (res.success) {
      statusEl.textContent = '✅ บันทึกเรียบร้อย';
      statusEl.className = 'settings-status settings-status-ok';
      Toast.show('บันทึกการตั้งค่าเรียบร้อย', 'success');

      // Invalidate song cache so Library reloads from Drive immediately
      const uid = Auth.getUser() ? Auth.getUser().uid : '';
      localStorage.removeItem('ncs-songs-cache-' + uid);
      localStorage.removeItem('ncs-songs-cache-time-' + uid);
      // Also clear legacy non-scoped cache
      localStorage.removeItem('ncs-songs-cache');
      localStorage.removeItem('ncs-songs-cache-time');

      // Update status line
      const statusDiv = document.getElementById('drive-status');
      if (statusDiv) {
        statusDiv.textContent = '📂 บันทึกแล้ว — โหลดหน้า Library เพื่อดูรายการไฟล์';
      }
    } else {
      statusEl.textContent = '❌ ' + (res.error || 'เกิดข้อผิดพลาด');
      statusEl.className = 'settings-status settings-status-err';
      Toast.show(res.error || 'บันทึกไม่ได้', 'error');
    }
  }
};
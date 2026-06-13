/* ============================================
   Note Chord SoulCiety — Settings Module
   Google Drive folder & Google Sheet URL config
   ============================================ */

const Settings = {
  /* ---------- Load settings from server ---------- */
  async load() {
    const token = Auth.getToken();
    if (!token) return {};
    const res = await API.getSettings(token);
    if (res.success && res.data && res.data.settings) {
      return res.data.settings;
    }
    return {};
  },

  /* ---------- Save settings (admin only) ---------- */
  async save(data) {
    const token = Auth.getToken();
    if (!token) return { success: false, error: 'ไม่มีการยืนยันตัวตน' };
    const res = await API.saveSettings(token, data);
    return res;
  },

  /* ---------- Render the settings view ---------- */
  async renderView() {
    const container = document.getElementById('content-area');
    document.getElementById('topbar-title').textContent = 'ตั้งค่า';

    container.innerHTML = '<div class="loading-overlay"><div class="loading-spinner"></div></div>';

    // Load settings
    const settings = await this.load();
    const isAdmin = Auth.isAdmin();
    const esc = Library.escapeHtml;

    let html = '<div class="settings-container">';

    // Google Sheet URL section
    html += '<div class="settings-section">';
    html += '<div class="settings-section-icon">📊</div>';
    html += '<h3 class="settings-section-title">Google Sheet (รายชื่อเพลง)</h3>';
    html += '<p class="settings-section-desc">ใส่ลิงก์ CSV export ของ Google Sheet ที่มีคอลัมน์ ชื่อเพลง และ ลิงก์ Google Drive</p>';
    html += '<div class="settings-field">';
    html += '<label class="settings-label" for="setting-google-sheet">Sheet CSV URL</label>';
    html += '<input type="url" id="setting-google-sheet" class="settings-input" ' +
      'placeholder="https://docs.google.com/spreadsheets/d/.../gviz/tq?tqx=out:csv&sheet=..." ' +
      'value="' + esc(settings.google_sheet_url || '') + '" ' +
      (isAdmin ? '' : 'disabled') + ' />';
    if (isAdmin) {
      html += '<button class="settings-test-btn" id="test-sheet-btn" data-type="sheet">ทดสอบการเชื่อมต่อ</button>';
    }
    html += '</div>';
    html += '</div>';

    // Google Drive Folder section
    html += '<div class="settings-section">';
    html += '<div class="settings-section-icon">☁️</div>';
    html += '<h3 class="settings-section-title">Google Drive (ไฟล์โน้ตเพลง)</h3>';
    html += '<p class="settings-section-desc">ใส่ลิงก์โฟลเดอร์ Google Drive สำหรับจัดเก็บไฟล์ PDF / รูปภาพโน้ตเพลง</p>';
    html += '<div class="settings-field">';
    html += '<label class="settings-label" for="setting-google-drive">Drive Folder URL</label>';
    html += '<input type="url" id="setting-google-drive" class="settings-input" ' +
      'placeholder="https://drive.google.com/drive/folders/..." ' +
      'value="' + esc(settings.google_drive_folder || '') + '" ' +
      (isAdmin ? '' : 'disabled') + ' />';
    if (isAdmin) {
      html += '<button class="settings-test-btn" id="test-drive-btn" data-type="drive">ทดสอบการเชื่อมต่อ</button>';
    }
    html += '</div>';
    html += '</div>';

    // Save button (admin only)
    if (isAdmin) {
      html += '<div class="settings-actions">';
      html += '<button class="btn btn-primary" id="settings-save-btn">💾 บันทึกการตั้งค่า</button>';
      html += '<span id="settings-status" class="settings-status"></span>';
      html += '</div>';
    }

    // Info for non-admin
    if (!isAdmin) {
      html += '<div class="settings-info">';
      html += '🔒 เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถแก้ไขการตั้งค่าเหล่านี้ได้';
      html += '</div>';
    }

    html += '</div>'; // .settings-container

    container.innerHTML = html;

    // Attach events if admin
    if (isAdmin) {
      this.attachEvents();
    }
  },

  /* ---------- Event handlers ---------- */
  attachEvents() {
    // Save button
    const saveBtn = document.getElementById('settings-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.handleSave());
    }

    // Test sheet button
    const testSheetBtn = document.getElementById('test-sheet-btn');
    if (testSheetBtn) {
      testSheetBtn.addEventListener('click', () => this.testConnection('sheet'));
    }

    // Test drive button
    const testDriveBtn = document.getElementById('test-drive-btn');
    if (testDriveBtn) {
      testDriveBtn.addEventListener('click', () => this.testConnection('drive'));
    }
  },

  /* ---------- Save handler ---------- */
  async handleSave() {
    const sheetUrl = document.getElementById('setting-google-sheet').value.trim();
    const driveFolder = document.getElementById('setting-google-drive').value.trim();
    const statusEl = document.getElementById('settings-status');

    const btn = document.getElementById('settings-save-btn');
    btn.disabled = true;
    btn.textContent = '⏳ กำลังบันทึก...';
    statusEl.textContent = '';
    statusEl.className = 'settings-status';

    const res = await this.save({
      google_sheet_url: sheetUrl,
      google_drive_folder: driveFolder
    });

    btn.disabled = false;
    btn.textContent = '💾 บันทึกการตั้งค่า';

    if (res.success) {
      statusEl.textContent = '✅ ' + (res.data.message || 'บันทึกเรียบร้อย');
      statusEl.className = 'settings-status settings-status-ok';
      Toast.show('บันทึกการตั้งค่าเรียบร้อย', 'success');
    } else {
      statusEl.textContent = '❌ ' + (res.error || 'เกิดข้อผิดพลาด');
      statusEl.className = 'settings-status settings-status-err';
      Toast.show(res.error || 'บันทึกไม่ได้', 'error');
    }
  },

  /* ---------- Test connection ---------- */
  async testConnection(type) {
    const inputId = type === 'sheet' ? 'setting-google-sheet' : 'setting-google-drive';
    const btnId = type === 'sheet' ? 'test-sheet-btn' : 'test-drive-btn';
    const input = document.getElementById(inputId);
    const btn = document.getElementById(btnId);
    const url = input.value.trim();

    if (!url) {
      Toast.show('กรุณาใส่ URL ก่อนทดสอบ', 'error');
      return;
    }

    btn.disabled = true;
    btn.textContent = '⏳ กำลังทดสอบ...';

    try {
      const res = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
      // With no-cors we can't read the response, but if it didn't throw, the URL is reachable
      btn.textContent = '✅ เชื่อมต่อได้';
      btn.style.color = '#4caf50';
      Toast.show('เชื่อมต่อ ' + (type === 'sheet' ? 'Sheet' : 'Drive') + ' สำเร็จ', 'success');
    } catch (e) {
      btn.textContent = '❌ เชื่อมต่อไม่ได้';
      btn.style.color = '#f44336';
      Toast.show('ไม่สามารถเชื่อมต่อ ' + (type === 'sheet' ? 'Sheet' : 'Drive') + ': ' + e.message, 'error');
    }

    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = 'ทดสอบการเชื่อมต่อ';
      btn.style.color = '';
    }, 3000);
  }
};
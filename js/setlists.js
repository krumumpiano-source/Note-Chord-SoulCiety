/* ============================================
   Note Chord SoulCiety — Setlists Module
   CRUD + Drag & Drop reorder
   ============================================ */

const Setlists = {
  LOCAL_KEY: 'ncs-setlists',
  list: [],

  async load() {
    const cached = localStorage.getItem(this.LOCAL_KEY);
    if (cached) {
      try { this.list = JSON.parse(cached); } catch (e) { this.list = []; }
    }

    const token = Auth.getToken();
    if (token) {
      const res = await API.getSetlists(token);
      if (res.success && res.data) {
        this.list = (res.data.setlists || []).map(sl => ({
          ...sl,
          songs: this.parseSongs(sl.songs_json)
        }));
        localStorage.setItem(this.LOCAL_KEY, JSON.stringify(this.list));
      }
    }
  },

  parseSongs(json) {
    if (!json) return [];
    try {
      if (typeof json === 'string') return JSON.parse(json);
      return json;
    } catch (e) { return []; }
  },

  getLocal() {
    try { return JSON.parse(localStorage.getItem(this.LOCAL_KEY) || '[]'); }
    catch (e) { return []; }
  },

  async createSetlist(name) {
    const token = Auth.getToken();
    if (!token) return;

    const res = await API.saveSetlist(token, '', name, '[]');
    if (res.success && res.data) {
      const newSl = {
        setlist_id: res.data.setlist_id,
        name: name,
        songs: [],
        songs_json: '[]',
        created_at: new Date().toISOString()
      };
      this.list.push(newSl);
      localStorage.setItem(this.LOCAL_KEY, JSON.stringify(this.list));
      Toast.show('สร้าง "' + name + '" สำเร็จ', 'success');
      this.renderView();
    } else {
      Toast.show(res.error || 'สร้าง setlist ไม่สำเร็จ', 'error');
    }
  },

  async deleteSetlist(setlistId) {
    const token = Auth.getToken();
    if (!token) return;

    const res = await API.deleteSetlist(token, setlistId);
    if (res.success) {
      this.list = this.list.filter(sl => sl.setlist_id !== setlistId);
      localStorage.setItem(this.LOCAL_KEY, JSON.stringify(this.list));
      Toast.show('ลบ setlist สำเร็จ', 'success');
      this.renderView();
    } else {
      Toast.show(res.error || 'ลบไม่สำเร็จ', 'error');
    }
  },

  async addSongToSetlist(setlistId, songName, songUrl) {
    const sl = this.list.find(s => s.setlist_id === setlistId);
    if (!sl) return;

    if (!sl.songs) sl.songs = [];
    // Prevent duplicate
    if (sl.songs.some(s => s.name === songName)) {
      Toast.show('เพลงนี้อยู่ใน setlist แล้ว', 'info');
      return;
    }

    sl.songs.push({ name: songName, url: songUrl });
    await this.saveSetlist(sl);
  },

  async removeSongFromSetlist(setlistId, songName) {
    const sl = this.list.find(s => s.setlist_id === setlistId);
    if (!sl) return;

    sl.songs = (sl.songs || []).filter(s => s.name !== songName);
    await this.saveSetlist(sl);
  },

  async saveSetlist(sl) {
    const token = Auth.getToken();
    if (!token) return;

    sl.songs_json = JSON.stringify(sl.songs || []);
    localStorage.setItem(this.LOCAL_KEY, JSON.stringify(this.list));

    await API.saveSetlist(token, sl.setlist_id, sl.name, sl.songs_json);
  },

  showAddToSetlist(songName, songUrl) {
    const setlists = this.list;
    if (setlists.length === 0) {
      const name = prompt('ยังไม่มี Setlist — สร้างใหม่:\nใส่ชื่อ Setlist:');
      if (name && name.trim()) {
        this.createSetlist(name.trim()).then(() => {
          if (this.list.length > 0) {
            this.addSongToSetlist(this.list[this.list.length - 1].setlist_id, songName, songUrl);
          }
        });
      }
      return;
    }

    // Show modal with setlist options
    const modal = document.getElementById('setlist-picker-modal');
    const body = document.getElementById('setlist-picker-body');
    if (!modal || !body) return;

    body.innerHTML = '';
    setlists.forEach(sl => {
      const count = (sl.songs || []).length;
      const btn = document.createElement('button');
      btn.className = 'setlist-item';
      btn.innerHTML = `
        <span class="setlist-item-icon">📋</span>
        <span class="setlist-item-info">
          <span class="setlist-item-name">${Library.escapeHtml(sl.name)}</span>
          <span class="setlist-item-count">${count} เพลง</span>
        </span>`;
      btn.onclick = () => {
        this.addSongToSetlist(sl.setlist_id, songName, songUrl);
        modal.classList.remove('open');
        Toast.show('เพิ่มใน "' + sl.name + '" แล้ว', 'success');
      };
      body.appendChild(btn);
    });

    modal.classList.add('open');
  },

  renderView() {
    const container = document.getElementById('content-area');
    document.getElementById('topbar-title').textContent = 'Setlists';

    let html = `
      <div class="content-stats">
        <span><span class="content-stats-count">${this.list.length}</span> setlist(s)</span>
        <button class="btn btn-sm btn-accent" onclick="Setlists.promptCreate()" style="margin-left:auto;">+ สร้าง Setlist</button>
      </div>`;

    if (this.list.length === 0) {
      html += `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <h3>ยังไม่มี Setlist</h3>
          <p>สร้าง Setlist เพื่อจัดกลุ่มเพลงของคุณ</p>
        </div>`;
    } else {
      html += '<div style="display:flex; flex-direction:column; gap:8px; margin-top:12px;">';
      this.list.forEach(sl => {
        const songs = sl.songs || [];
        html += `
          <div class="setlist-item" data-id="${Library.escapeAttr(sl.setlist_id)}">
            <span class="setlist-item-icon">📋</span>
            <span class="setlist-item-info" onclick="Setlists.openSetlist('${Library.escapeAttr(sl.setlist_id)}')">
              <span class="setlist-item-name">${Library.escapeHtml(sl.name)}</span>
              <span class="setlist-item-count">${songs.length} เพลง</span>
            </span>
            <span class="setlist-item-actions">
              <button class="song-row-action-btn" onclick="Setlists.openSetlist('${Library.escapeAttr(sl.setlist_id)}')" title="เปิด">▶</button>
              <button class="song-row-action-btn" onclick="Setlists.confirmDelete('${Library.escapeAttr(sl.setlist_id)}', '${Library.escapeAttr(sl.name)}')" title="ลบ" style="color:var(--danger);">🗑</button>
            </span>
          </div>`;
      });
      html += '</div>';
    }

    container.innerHTML = html;
  },

  openSetlist(setlistId) {
    const sl = this.list.find(s => s.setlist_id === setlistId);
    if (!sl) return;

    const container = document.getElementById('content-area');
    document.getElementById('topbar-title').textContent = sl.name;
    const songs = sl.songs || [];

    let html = `
      <div class="content-stats">
        <button class="btn btn-sm btn-secondary" onclick="Setlists.renderView()">← กลับ</button>
        <span style="margin-left:12px;"><span class="content-stats-count">${songs.length}</span> เพลง</span>
        ${songs.length > 0 ? `<button class="btn btn-sm btn-accent" onclick="Setlists.playSetlist('${Library.escapeAttr(setlistId)}')" style="margin-left:auto;">▶ เล่นทั้งหมด</button>` : ''}
      </div>`;

    if (songs.length === 0) {
      html += `
        <div class="empty-state">
          <div class="empty-state-icon">🎵</div>
          <h3>Setlist ว่างอยู่</h3>
          <p>เพิ่มเพลงจากคลังเพลงโดยกดปุ่ม 📋 ที่เพลง</p>
        </div>`;
    } else {
      html += '<div class="library-list" id="setlist-songs">';
      songs.forEach((song, i) => {
        html += `
          <div class="song-row" draggable="true" data-index="${i}" data-name="${Library.escapeAttr(song.name)}" data-url="${Library.escapeAttr(song.url)}">
            <span class="drag-handle" title="ลากเพื่อเรียงลำดับ">⠿</span>
            <span class="song-row-icon">🎵</span>
            <span class="song-row-name">${Library.escapeHtml(song.name)}</span>
            <button class="song-row-action-btn" onclick="event.stopPropagation(); Setlists.removeSongFromSetlist('${Library.escapeAttr(setlistId)}', '${Library.escapeAttr(song.name)}').then(() => Setlists.openSetlist('${Library.escapeAttr(setlistId)}'))" title="ลบออก" style="color:var(--danger);">✕</button>
          </div>`;
      });
      html += '</div>';
    }

    container.innerHTML = html;

    // Click to open viewer
    container.querySelectorAll('.song-row').forEach(el => {
      el.addEventListener('click', () => {
        Viewer.open(el.dataset.name, el.dataset.url, songs);
      });
    });

    // Drag & drop
    this.initDragDrop(setlistId);
  },

  playSetlist(setlistId) {
    const sl = this.list.find(s => s.setlist_id === setlistId);
    if (!sl || !sl.songs || sl.songs.length === 0) return;

    Viewer.open(sl.songs[0].name, sl.songs[0].url, sl.songs);
  },

  initDragDrop(setlistId) {
    const container = document.getElementById('setlist-songs');
    if (!container) return;

    let dragSrc = null;

    container.querySelectorAll('.song-row').forEach(row => {
      row.addEventListener('dragstart', (e) => {
        dragSrc = row;
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rect = row.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        if (e.clientY < mid) {
          row.style.borderTop = '2px solid var(--accent)';
          row.style.borderBottom = '';
        } else {
          row.style.borderBottom = '2px solid var(--accent)';
          row.style.borderTop = '';
        }
      });

      row.addEventListener('dragleave', () => {
        row.style.borderTop = '';
        row.style.borderBottom = '';
      });

      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.style.borderTop = '';
        row.style.borderBottom = '';
        if (dragSrc === row) return;

        const sl = this.list.find(s => s.setlist_id === setlistId);
        if (!sl) return;

        const fromIdx = parseInt(dragSrc.dataset.index);
        const toIdx = parseInt(row.dataset.index);

        const [moved] = sl.songs.splice(fromIdx, 1);
        sl.songs.splice(toIdx, 0, moved);

        this.saveSetlist(sl);
        this.openSetlist(setlistId);
      });

      row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
      });
    });
  },

  promptCreate() {
    const name = prompt('ชื่อ Setlist ใหม่:');
    if (name && name.trim()) {
      this.createSetlist(name.trim());
    }
  },

  confirmDelete(setlistId, name) {
    if (confirm('ลบ Setlist "' + name + '" ?')) {
      this.deleteSetlist(setlistId);
    }
  }
};

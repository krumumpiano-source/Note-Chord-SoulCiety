/* ============================================
   Note Chord SoulCiety — Library View
   Grid / List display for songs
   ============================================ */

const Library = {
  songs: [],
  filteredSongs: [],
  viewMode: 'grid', // 'grid' | 'list'
  sortMode: 'az',   // 'az' | 'za'
  activeAlpha: null,

  async load() {
    const container = document.getElementById('content-area');
    container.innerHTML = '<div class="loading-overlay"><div class="loading-spinner"></div></div>';

    // Try cache first
    const cached = localStorage.getItem('ncs-songs-cache');
    const cacheTime = localStorage.getItem('ncs-songs-cache-time');
    const cacheValid = cacheTime && (Date.now() - parseInt(cacheTime)) < 300000; // 5 min

    if (cached && cacheValid) {
      this.songs = JSON.parse(cached);
      this.applyFilters();
      this.render();
      // Refresh in background
      this.fetchFromServer(true);
      return;
    }

    await this.fetchFromServer(false);
  },

  async fetchFromServer(background) {
    const res = await API.listSongs();
    if (res.success && res.data && res.data.songs) {
      this.songs = res.data.songs;
      localStorage.setItem('ncs-songs-cache', JSON.stringify(this.songs));
      localStorage.setItem('ncs-songs-cache-time', Date.now().toString());
      if (!background) {
        this.applyFilters();
        this.render();
      }
      this.updateStats();
    } else if (!background) {
      const container = document.getElementById('content-area');
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <h3>ไม่สามารถโหลดข้อมูลเพลงได้</h3>
          <p>${res.error || 'กรุณาลองใหม่อีกครั้ง'}</p>
        </div>`;
    }
  },

  applyFilters() {
    let songs = [...this.songs];

    // Alphabet filter
    if (this.activeAlpha) {
      songs = songs.filter(s => {
        const first = s.name.charAt(0).toUpperCase();
        return first === this.activeAlpha;
      });
    }

    // Search filter (from Search module)
    if (typeof Search !== 'undefined' && Search.query) {
      const q = Search.query.toLowerCase();
      songs = songs.filter(s => s.name.toLowerCase().includes(q));
    }

    // Sort
    songs.sort((a, b) => {
      const cmp = a.name.localeCompare(b.name, 'th');
      return this.sortMode === 'za' ? -cmp : cmp;
    });

    this.filteredSongs = songs;
  },

  render() {
    const container = document.getElementById('content-area');
    const statsHtml = this.renderStats();
    const alphaHtml = this.renderAlphabetBar();

    if (this.filteredSongs.length === 0) {
      container.innerHTML = `
        ${statsHtml}${alphaHtml}
        <div class="empty-state">
          <div class="empty-state-icon">🎵</div>
          <h3>ไม่พบเพลง</h3>
          <p>ลองค้นหาด้วยคำอื่น หรือเปลี่ยนตัวกรอง</p>
        </div>`;
      return;
    }

    const songsHtml = this.viewMode === 'grid'
      ? this.renderGrid()
      : this.renderList();

    container.innerHTML = `${statsHtml}${alphaHtml}${songsHtml}`;
    this.attachEvents();
  },

  renderStats() {
    return `
      <div class="content-stats">
        <span>แสดง <span class="content-stats-count">${this.filteredSongs.length}</span> จาก ${this.songs.length} เพลง</span>
      </div>`;
  },

  renderAlphabetBar() {
    const letters = new Set();
    this.songs.forEach(s => {
      const first = s.name.charAt(0).toUpperCase();
      letters.add(first);
    });

    // English A-Z and Thai
    const allLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ'.split('');

    let html = '<div class="alphabet-bar">';
    html += `<button class="alpha-btn ${!this.activeAlpha ? 'active' : ''} has-songs" data-alpha="">ทั้งหมด</button>`;

    allLetters.forEach(l => {
      const has = letters.has(l);
      if (has) {
        html += `<button class="alpha-btn ${this.activeAlpha === l ? 'active' : ''} has-songs" data-alpha="${l}">${l}</button>`;
      }
    });

    html += '</div>';
    return html;
  },

  renderGrid() {
    let html = '<div class="library-grid">';
    this.filteredSongs.forEach((song, i) => {
      const isFav = Favorites.isFavorite(song.name);
      const title = this.highlightSearch(song.name);
      html += `
        <div class="song-card" data-index="${i}" data-name="${this.escapeAttr(song.name)}" data-url="${this.escapeAttr(song.url)}">
          <div class="song-card-thumb">
            <button class="song-card-fav ${isFav ? 'favorited' : ''}" data-song="${this.escapeAttr(song.name)}" data-url="${this.escapeAttr(song.url)}" onclick="event.stopPropagation(); Favorites.toggle(this)" title="${isFav ? 'ลบจากรายการโปรด' : 'เพิ่มในรายการโปรด'}">${isFav ? '★' : '☆'}</button>
          </div>
          <div class="song-card-info">
            <div class="song-card-title">${title}</div>
          </div>
        </div>`;
    });
    html += '</div>';
    return html;
  },

  renderList() {
    let html = '<div class="library-list">';
    this.filteredSongs.forEach((song, i) => {
      const isFav = Favorites.isFavorite(song.name);
      const title = this.highlightSearch(song.name);
      html += `
        <div class="song-row" data-index="${i}" data-name="${this.escapeAttr(song.name)}" data-url="${this.escapeAttr(song.url)}">
          <span class="song-row-icon">🎵</span>
          <span class="song-row-name">${title}</span>
          <button class="song-row-fav ${isFav ? 'favorited' : ''}" data-song="${this.escapeAttr(song.name)}" data-url="${this.escapeAttr(song.url)}" onclick="event.stopPropagation(); Favorites.toggle(this)" title="${isFav ? 'ลบจากรายการโปรด' : 'เพิ่มในรายการโปรด'}">${isFav ? '★' : '☆'}</button>
          <div class="song-row-actions">
            <button class="song-row-action-btn" onclick="event.stopPropagation(); Setlists.showAddToSetlist('${this.escapeAttr(song.name)}', '${this.escapeAttr(song.url)}')" title="เพิ่มใน Setlist">📋</button>
          </div>
        </div>`;
    });
    html += '</div>';
    return html;
  },

  attachEvents() {
    // Card / Row click → open viewer
    document.querySelectorAll('.song-card, .song-row').forEach(el => {
      el.addEventListener('click', () => {
        const name = el.dataset.name;
        const url = el.dataset.url;
        Viewer.open(name, url, this.filteredSongs);
      });
    });

    // Alphabet buttons
    document.querySelectorAll('.alpha-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeAlpha = btn.dataset.alpha || null;
        this.applyFilters();
        this.render();
      });
    });
  },

  setViewMode(mode) {
    this.viewMode = mode;
    localStorage.setItem('ncs-view-mode', mode);
    this.render();
    this.updateViewToggle();
  },

  setSortMode(mode) {
    this.sortMode = mode;
    this.applyFilters();
    this.render();
  },

  updateViewToggle() {
    document.querySelectorAll('.topbar-view-toggle .topbar-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === this.viewMode);
    });
  },

  updateStats() {
    const el = document.querySelector('.content-stats-count');
    if (el) el.textContent = this.filteredSongs.length;
  },

  highlightSearch(text) {
    if (!Search || !Search.query) return this.escapeHtml(text);
    const q = Search.query;
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return this.escapeHtml(text).replace(regex, '<mark>$1</mark>');
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
};

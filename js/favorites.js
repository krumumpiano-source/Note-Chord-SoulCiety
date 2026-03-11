/* ============================================
   Note Chord SoulCiety — Favorites Module
   ============================================ */

const Favorites = {
  LOCAL_KEY: 'ncs-favorites',
  list: [],

  async load() {
    // Load from localStorage immediately
    const cached = localStorage.getItem(this.LOCAL_KEY);
    if (cached) {
      try { this.list = JSON.parse(cached); } catch (e) { this.list = []; }
    }

    // Sync from server
    const token = Auth.getToken();
    if (token) {
      const res = await API.getFavorites(token);
      if (res.success && res.data) {
        this.list = res.data.favorites || [];
        localStorage.setItem(this.LOCAL_KEY, JSON.stringify(this.list));
      }
    }
  },

  isFavorite(songName) {
    return this.list.some(f => f.name === songName);
  },

  async toggleByName(songName, songUrl) {
    const token = Auth.getToken();
    if (!token) return;

    const was = this.isFavorite(songName);

    // Optimistic UI update
    if (was) {
      this.list = this.list.filter(f => f.name !== songName);
    } else {
      this.list.push({ name: songName, url: songUrl });
    }
    localStorage.setItem(this.LOCAL_KEY, JSON.stringify(this.list));

    // Sync to server
    const res = await API.toggleFavorite(token, songName, songUrl);
    if (!res.success) {
      // Revert on failure
      if (was) {
        this.list.push({ name: songName, url: songUrl });
      } else {
        this.list = this.list.filter(f => f.name !== songName);
      }
      localStorage.setItem(this.LOCAL_KEY, JSON.stringify(this.list));
      Toast.show(res.error || 'เกิดข้อผิดพลาด', 'error');
      return;
    }

    Toast.show(was ? 'ลบออกจากรายการโปรดแล้ว' : 'เพิ่มในรายการโปรดแล้ว ⭐', 'success');

    // Update badge
    this.updateBadge();
  },

  toggle(btnEl) {
    const songName = btnEl.dataset.song;
    const songUrl = btnEl.dataset.url;
    this.toggleByName(songName, songUrl).then(() => {
      // Re-render current view
      if (App.currentView === 'favorites') {
        this.renderView();
      } else {
        Library.render();
      }
    });
  },

  updateBadge() {
    const badge = document.getElementById('fav-badge');
    if (badge) {
      badge.textContent = this.list.length || '';
      badge.style.display = this.list.length > 0 ? '' : 'none';
    }
  },

  renderView() {
    const container = document.getElementById('content-area');
    document.getElementById('topbar-title').textContent = 'รายการโปรด';

    if (this.list.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⭐</div>
          <h3>ยังไม่มีรายการโปรด</h3>
          <p>กดปุ่ม ☆ ที่เพลงเพื่อเพิ่มในรายการโปรด</p>
        </div>`;
      return;
    }

    let html = `<div class="content-stats"><span><span class="content-stats-count">${this.list.length}</span> เพลงโปรด</span></div>`;

    if (Library.viewMode === 'grid') {
      html += '<div class="library-grid">';
      this.list.forEach((song, i) => {
        html += `
          <div class="song-card" data-name="${Library.escapeAttr(song.name)}" data-url="${Library.escapeAttr(song.url)}">
            <div class="song-card-thumb">
              <button class="song-card-fav favorited" data-song="${Library.escapeAttr(song.name)}" data-url="${Library.escapeAttr(song.url)}" onclick="event.stopPropagation(); Favorites.toggle(this)">★</button>
            </div>
            <div class="song-card-info">
              <div class="song-card-title">${Library.escapeHtml(song.name)}</div>
            </div>
          </div>`;
      });
      html += '</div>';
    } else {
      html += '<div class="library-list">';
      this.list.forEach((song, i) => {
        html += `
          <div class="song-row" data-name="${Library.escapeAttr(song.name)}" data-url="${Library.escapeAttr(song.url)}">
            <span class="song-row-icon">⭐</span>
            <span class="song-row-name">${Library.escapeHtml(song.name)}</span>
            <button class="song-row-fav favorited" data-song="${Library.escapeAttr(song.name)}" data-url="${Library.escapeAttr(song.url)}" onclick="event.stopPropagation(); Favorites.toggle(this)">★</button>
          </div>`;
      });
      html += '</div>';
    }

    container.innerHTML = html;

    // Attach click events
    container.querySelectorAll('.song-card, .song-row').forEach(el => {
      el.addEventListener('click', () => {
        Viewer.open(el.dataset.name, el.dataset.url, this.list);
      });
    });
  }
};

/* ============================================
   Note Chord SoulCiety — Recent Module
   ============================================ */

const Recent = {
  LOCAL_KEY: 'ncs-recent',
  list: [],

  async load() {
    const cached = localStorage.getItem(this.LOCAL_KEY);
    if (cached) {
      try { this.list = JSON.parse(cached); } catch (e) { this.list = []; }
    }

    const token = Auth.getToken();
    if (token) {
      const res = await API.getRecent(token);
      if (res.success && res.data) {
        this.list = res.data.recent || [];
        localStorage.setItem(this.LOCAL_KEY, JSON.stringify(this.list));
      }
    }
  },

  addLocal(name, url) {
    this.list = this.list.filter(r => r.name !== name);
    this.list.unshift({ name, url, opened_at: new Date().toISOString() });
    if (this.list.length > CONFIG.RECENT_MAX) {
      this.list = this.list.slice(0, CONFIG.RECENT_MAX);
    }
    localStorage.setItem(this.LOCAL_KEY, JSON.stringify(this.list));
    this.updateBadge();
  },

  updateBadge() {
    const badge = document.getElementById('recent-badge');
    if (badge) {
      const count = Math.min(this.list.length, CONFIG.RECENT_MAX);
      badge.textContent = count || '';
      badge.style.display = count > 0 ? '' : 'none';
    }
  },

  renderView() {
    const container = document.getElementById('content-area');
    document.getElementById('topbar-title').textContent = 'เพลงล่าสุด';

    if (this.list.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🕐</div>
          <h3>ยังไม่มีประวัติ</h3>
          <p>เพลงที่คุณเปิดดูจะแสดงที่นี่</p>
        </div>`;
      return;
    }

    let html = `<div class="content-stats"><span><span class="content-stats-count">${this.list.length}</span> เพลงล่าสุด</span></div>`;
    html += '<div class="library-list">';

    this.list.forEach((song) => {
      const timeAgo = this.timeAgo(song.opened_at);
      const isFav = Favorites.isFavorite(song.name);
      html += `
        <div class="song-row" data-name="${Library.escapeAttr(song.name)}" data-url="${Library.escapeAttr(song.url)}">
          <span class="song-row-icon">🕐</span>
          <span class="song-row-name">${Library.escapeHtml(song.name)}</span>
          <span style="font-size:12px; color:var(--text-muted); white-space:nowrap;">${timeAgo}</span>
          <button class="song-row-fav ${isFav ? 'favorited' : ''}" data-song="${Library.escapeAttr(song.name)}" data-url="${Library.escapeAttr(song.url)}" onclick="event.stopPropagation(); Favorites.toggle(this)">${isFav ? '★' : '☆'}</button>
        </div>`;
    });

    html += '</div>';
    container.innerHTML = html;

    container.querySelectorAll('.song-row').forEach(el => {
      el.addEventListener('click', () => {
        Viewer.open(el.dataset.name, el.dataset.url, this.list);
      });
    });
  },

  timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'เมื่อสักครู่';
    if (mins < 60) return mins + ' นาทีที่แล้ว';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + ' ชั่วโมงที่แล้ว';
    const days = Math.floor(hrs / 24);
    if (days < 30) return days + ' วันที่แล้ว';
    return new Date(dateStr).toLocaleDateString('th-TH');
  }
};

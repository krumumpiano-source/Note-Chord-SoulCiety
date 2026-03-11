/* ============================================
   Note Chord SoulCiety — PDF Viewer
   Fullscreen iframe overlay
   ============================================ */

const Viewer = {
  currentSong: null,
  currentUrl: null,
  playlist: [],
  playlistIndex: -1,
  toolbarTimeout: null,

  open(name, url, playlist = []) {
    this.currentSong = name;
    this.currentUrl = url;
    this.playlist = playlist || [];
    this.playlistIndex = playlist.findIndex(s => s.name === name);

    const overlay = document.getElementById('viewer-overlay');
    const iframe = document.getElementById('viewer-iframe');
    const title = document.getElementById('viewer-title');
    const loading = document.getElementById('viewer-loading');

    // Show overlay
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Set title
    title.textContent = name;

    // Show loading
    loading.classList.remove('hidden');

    // Load PDF
    iframe.src = url;
    iframe.onload = () => {
      loading.classList.add('hidden');
    };

    // Update favorite button
    this.updateFavButton();

    // Update navigation buttons
    this.updateNavButtons();

    // Record recent
    const token = Auth.getToken();
    if (token) {
      API.addRecent(token, name, url);
      Recent.addLocal(name, url);
    }

    // Keyboard shortcuts
    this._keyHandler = this.handleKey.bind(this);
    document.addEventListener('keydown', this._keyHandler);
  },

  close() {
    const overlay = document.getElementById('viewer-overlay');
    const iframe = document.getElementById('viewer-iframe');

    overlay.classList.remove('open');
    document.body.style.overflow = '';
    iframe.src = 'about:blank';

    this.currentSong = null;
    this.currentUrl = null;

    document.removeEventListener('keydown', this._keyHandler);
  },

  prev() {
    if (this.playlistIndex <= 0 || this.playlist.length === 0) return;
    this.playlistIndex--;
    const song = this.playlist[this.playlistIndex];
    this.navigateTo(song);
  },

  next() {
    if (this.playlistIndex >= this.playlist.length - 1 || this.playlist.length === 0) return;
    this.playlistIndex++;
    const song = this.playlist[this.playlistIndex];
    this.navigateTo(song);
  },

  navigateTo(song) {
    this.currentSong = song.name;
    this.currentUrl = song.url;

    const iframe = document.getElementById('viewer-iframe');
    const title = document.getElementById('viewer-title');
    const loading = document.getElementById('viewer-loading');

    title.textContent = song.name;
    loading.classList.remove('hidden');
    iframe.src = song.url;
    iframe.onload = () => loading.classList.add('hidden');

    this.updateFavButton();
    this.updateNavButtons();

    // Record recent
    const token = Auth.getToken();
    if (token) {
      API.addRecent(token, song.name, song.url);
      Recent.addLocal(song.name, song.url);
    }
  },

  updateNavButtons() {
    const prevBtn = document.getElementById('viewer-prev');
    const nextBtn = document.getElementById('viewer-next');
    if (prevBtn) prevBtn.disabled = this.playlistIndex <= 0;
    if (nextBtn) nextBtn.disabled = this.playlistIndex >= this.playlist.length - 1;

    // Show/hide nav buttons based on playlist
    const show = this.playlist.length > 1;
    if (prevBtn) prevBtn.style.display = show ? '' : 'none';
    if (nextBtn) nextBtn.style.display = show ? '' : 'none';
  },

  updateFavButton() {
    const btn = document.getElementById('viewer-fav-btn');
    if (!btn) return;
    const isFav = Favorites.isFavorite(this.currentSong);
    btn.classList.toggle('active', isFav);
    btn.textContent = isFav ? '★' : '☆';
    btn.title = isFav ? 'ลบจากรายการโปรด' : 'เพิ่มในรายการโปรด';
  },

  toggleFavorite() {
    if (!this.currentSong) return;
    Favorites.toggleByName(this.currentSong, this.currentUrl);
    this.updateFavButton();
  },

  handleKey(e) {
    switch (e.key) {
      case 'Escape':
        this.close();
        break;
      case 'ArrowLeft':
        this.prev();
        break;
      case 'ArrowRight':
        this.next();
        break;
    }
  },

  showSetlistPicker() {
    const picker = document.getElementById('viewer-setlist-picker');
    if (!picker) return;

    if (picker.classList.contains('open')) {
      picker.classList.remove('open');
      return;
    }

    // Populate setlists
    const setlists = Setlists.getLocal();
    picker.innerHTML = '';

    if (setlists.length === 0) {
      picker.innerHTML = '<div style="padding: 12px; color: var(--text-secondary); font-size: 13px;">ยังไม่มี Setlist<br>สร้างใหม่ได้ที่เมนู Setlists</div>';
    } else {
      setlists.forEach(sl => {
        const btn = document.createElement('button');
        btn.className = 'viewer-setlist-picker-item';
        btn.textContent = `📋 ${sl.name}`;
        btn.onclick = () => {
          Setlists.addSongToSetlist(sl.setlist_id, this.currentSong, this.currentUrl);
          picker.classList.remove('open');
          Toast.show('เพิ่มใน "' + sl.name + '" แล้ว', 'success');
        };
        picker.appendChild(btn);
      });
    }

    picker.classList.add('open');
  }
};

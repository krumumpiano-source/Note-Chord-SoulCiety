/* ============================================
   Note Chord SoulCiety — PDF Viewer
   Page-by-page with swipe / tap navigation
   Uses PDF.js for rendering
   ============================================ */

const Viewer = {
  currentSong: null,
  currentUrl: null,
  playlist: [],
  playlistIndex: -1,

  /* PDF.js state */
  pdfDoc: null,
  currentPage: 1,
  totalPages: 0,
  rendering: false,
  isImage: false,

  /* Touch state */
  touchStartX: 0,
  touchStartY: 0,
  touchStartTime: 0,
  touchHandlersAdded: false,

  /* ---------- Open viewer ---------- */
  open(name, url, playlist = []) {
    this.currentSong = name;
    this.currentUrl = url;
    this.playlist = playlist || [];
    this.playlistIndex = playlist.findIndex(s => s.name === name);

    const overlay = document.getElementById('viewer-overlay');
    document.getElementById('viewer-title').textContent = name;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    this.showLoading(true);
    this.clearError();
    this.updateFavButton();
    this.updateNavButtons();

    // Load content
    this.loadContent(url);

    // Record recent
    const token = Auth.getToken();
    if (token) {
      API.addRecent(token, name, url);
      Recent.addLocal(name, url);
    }

    // Keyboard shortcuts
    this._keyHandler = this.handleKey.bind(this);
    document.addEventListener('keydown', this._keyHandler);

    // Setup touch/click handlers (once)
    if (!this.touchHandlersAdded) {
      this.setupTouch();
      this.touchHandlersAdded = true;
    }
  },

  /* ---------- Load PDF or image ---------- */
  async loadContent(url) {
    const fileId = this.extractFileId(url);
    if (!fileId) {
      this.showError('ไม่สามารถอ่าน File ID');
      return;
    }

    const token = Auth.getToken();
    const res = await API.getPdf(token, fileId);

    if (!res.success) {
      this.showError(res.error || 'ไม่สามารถโหลดไฟล์');
      return;
    }

    const mime = res.data.mimeType || '';
    const base64 = res.data.content;

    if (mime.startsWith('image/')) {
      this.isImage = true;
      this.showImage(base64, mime);
    } else {
      this.isImage = false;
      await this.loadPdf(base64);
    }
  },

  /* ---------- Show image ---------- */
  showImage(base64, mime) {
    const canvas = document.getElementById('viewer-canvas');
    canvas.style.display = 'none';

    let img = document.getElementById('viewer-img');
    if (!img) {
      img = document.createElement('img');
      img.id = 'viewer-img';
      img.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);';
      document.getElementById('viewer-body').appendChild(img);
    }
    img.src = 'data:' + mime + ';base64,' + base64;
    img.style.display = 'block';

    this.totalPages = 1;
    this.currentPage = 1;
    this.updatePageIndicator();
    this.showLoading(false);
  },

  /* ---------- Load PDF with PDF.js ---------- */
  async loadPdf(base64) {
    const img = document.getElementById('viewer-img');
    if (img) img.style.display = 'none';

    const canvas = document.getElementById('viewer-canvas');
    canvas.style.display = 'block';

    // Decode base64 -> Uint8Array
    const raw = atob(base64);
    const uint8 = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) uint8[i] = raw.charCodeAt(i);

    try {
      this.pdfDoc = await pdfjsLib.getDocument({ data: uint8 }).promise;
      this.totalPages = this.pdfDoc.numPages;
      this.currentPage = 1;
      await this.renderPage(this.currentPage);
      this.updatePageIndicator();
      this.showLoading(false);
    } catch (e) {
      this.showError('ไม่สามารถแสดง PDF: ' + e.message);
    }
  },

  /* ---------- Render a single page ---------- */
  async renderPage(num) {
    if (!this.pdfDoc || this.rendering) return;
    this.rendering = true;

    try {
      const page = await this.pdfDoc.getPage(num);
      const canvas = document.getElementById('viewer-canvas');
      const ctx = canvas.getContext('2d');
      const container = document.getElementById('viewer-body');

      const unscaled = page.getViewport({ scale: 1 });
      const scaleW = container.clientWidth / unscaled.width;
      const scaleH = container.clientHeight / unscaled.height;
      const scale = Math.min(scaleW, scaleH);
      const viewport = page.getViewport({ scale });

      // Sharp rendering on HiDPI
      const dpr = window.devicePixelRatio || 1;
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = viewport.width + 'px';
      canvas.style.height = viewport.height + 'px';

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, viewport.width, viewport.height);

      await page.render({ canvasContext: ctx, viewport }).promise;
    } catch (e) {
      console.error('Render error:', e);
    }
    this.rendering = false;
  },

  /* ---------- Page navigation ---------- */
  nextPage() {
    if (this.isImage || this.currentPage >= this.totalPages) return;
    this.currentPage++;
    this.renderPage(this.currentPage);
    this.updatePageIndicator();
  },

  prevPage() {
    if (this.isImage || this.currentPage <= 1) return;
    this.currentPage--;
    this.renderPage(this.currentPage);
    this.updatePageIndicator();
  },

  updatePageIndicator() {
    const el = document.getElementById('viewer-page-indicator');
    if (!el) return;
    if (this.totalPages <= 1) {
      el.style.display = 'none';
    } else {
      el.style.display = 'flex';
      el.textContent = this.currentPage + ' / ' + this.totalPages;
    }
  },

  /* ---------- Touch and click handlers ---------- */
  setupTouch() {
    const body = document.getElementById('viewer-body');

    body.addEventListener('touchstart', (e) => {
      this.touchStartX = e.changedTouches[0].clientX;
      this.touchStartY = e.changedTouches[0].clientY;
      this.touchStartTime = Date.now();
    }, { passive: true });

    body.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - this.touchStartX;
      const dy = e.changedTouches[0].clientY - this.touchStartY;
      const dt = Date.now() - this.touchStartTime;

      // Swipe: min 50px horizontal, mostly horizontal, within 500ms
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 500) {
        if (dx < 0) this.nextPage();
        else this.prevPage();
        return;
      }

      // Tap: minimal movement, quick
      if (Math.abs(dx) < 15 && Math.abs(dy) < 15 && dt < 300) {
        const x = e.changedTouches[0].clientX;
        const w = window.innerWidth;
        if (x < w * 0.3) this.prevPage();
        else if (x > w * 0.7) this.nextPage();
      }
    }, { passive: true });

    // Desktop click
    body.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('.viewer-setlist-picker') || e.target.closest('.viewer-page-indicator')) return;
      const x = e.clientX;
      const w = window.innerWidth;
      if (x < w * 0.3) this.prevPage();
      else if (x > w * 0.7) this.nextPage();
    });
  },

  /* ---------- Close viewer ---------- */
  close() {
    const overlay = document.getElementById('viewer-overlay');
    overlay.classList.remove('open');
    document.body.style.overflow = '';

    const canvas = document.getElementById('viewer-canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    const img = document.getElementById('viewer-img');
    if (img) { img.src = ''; img.style.display = 'none'; }

    this.clearError();
    this.pdfDoc = null;
    this.currentSong = null;
    this.currentUrl = null;

    document.removeEventListener('keydown', this._keyHandler);
  },

  /* ---------- Song navigation (setlist) ---------- */
  prevSong() {
    if (this.playlistIndex <= 0 || this.playlist.length === 0) return;
    this.playlistIndex--;
    this.navigateToSong(this.playlist[this.playlistIndex]);
  },

  nextSong() {
    if (this.playlistIndex >= this.playlist.length - 1 || this.playlist.length === 0) return;
    this.playlistIndex++;
    this.navigateToSong(this.playlist[this.playlistIndex]);
  },

  navigateToSong(song) {
    this.currentSong = song.name;
    this.currentUrl = song.url;
    document.getElementById('viewer-title').textContent = song.name;
    this.showLoading(true);
    this.clearError();
    this.loadContent(song.url);
    this.updateFavButton();
    this.updateNavButtons();

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
    const show = this.playlist.length > 1;
    if (prevBtn) prevBtn.style.display = show ? '' : 'none';
    if (nextBtn) nextBtn.style.display = show ? '' : 'none';
  },

  /* ---------- Favorites ---------- */
  updateFavButton() {
    const btn = document.getElementById('viewer-fav-btn');
    if (!btn) return;
    const isFav = Favorites.isFavorite(this.currentSong);
    btn.classList.toggle('active', isFav);
    btn.textContent = isFav ? '\u2605' : '\u2606';
    btn.title = isFav ? 'ลบจากรายการโปรด' : 'เพิ่มในรายการโปรด';
  },

  toggleFavorite() {
    if (!this.currentSong) return;
    Favorites.toggleByName(this.currentSong, this.currentUrl);
    this.updateFavButton();
  },

  /* ---------- Keyboard ---------- */
  handleKey(e) {
    switch (e.key) {
      case 'Escape': this.close(); break;
      case 'ArrowLeft': this.prevPage(); break;
      case 'ArrowRight': this.nextPage(); break;
    }
  },

  /* ---------- Setlist picker ---------- */
  showSetlistPicker() {
    const picker = document.getElementById('viewer-setlist-picker');
    if (!picker) return;

    if (picker.classList.contains('open')) {
      picker.classList.remove('open');
      return;
    }

    const setlists = Setlists.getLocal();
    picker.innerHTML = '';

    if (setlists.length === 0) {
      picker.innerHTML = '<div style="padding: 12px; color: var(--text-secondary); font-size: 13px;">ยังไม่มี Setlist<br>สร้างใหม่ได้ที่เมนู Setlists</div>';
    } else {
      setlists.forEach(sl => {
        const btn = document.createElement('button');
        btn.className = 'viewer-setlist-picker-item';
        btn.textContent = '\uD83D\uDCCB ' + sl.name;
        btn.onclick = () => {
          Setlists.addSongToSetlist(sl.setlist_id, this.currentSong, this.currentUrl);
          picker.classList.remove('open');
          Toast.show('\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e43\u0e19 "' + sl.name + '" \u0e41\u0e25\u0e49\u0e27', 'success');
        };
        picker.appendChild(btn);
      });
    }

    picker.classList.add('open');
  },

  /* ---------- Helpers ---------- */
  extractFileId(url) {
    const m = url.match(/\/file\/d\/([^/]+)/);
    return m ? m[1] : null;
  },

  showLoading(show) {
    const el = document.getElementById('viewer-loading');
    if (show) el.classList.remove('hidden');
    else el.classList.add('hidden');
  },

  showError(msg) {
    this.showLoading(false);
    const container = document.getElementById('viewer-body');
    let errEl = document.getElementById('viewer-error');
    if (!errEl) {
      errEl = document.createElement('div');
      errEl.id = 'viewer-error';
      errEl.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#f66;font-size:1rem;padding:2rem;text-align:center;z-index:10;background:var(--bg-primary);';
      container.appendChild(errEl);
    }
    errEl.textContent = msg;
    errEl.style.display = 'flex';
  },

  clearError() {
    const errEl = document.getElementById('viewer-error');
    if (errEl) errEl.style.display = 'none';
  }
};
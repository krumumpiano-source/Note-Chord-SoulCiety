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

  /* Chord window reference */
  chordWindow: null,

  /* PDF.js state */
  pdfDoc: null,
  currentPage: 1,
  totalPages: 0,
  rendering: false,
  pendingPage: null,  // queued page for rapid navigation
  isImage: false,
  dpr: window.devicePixelRatio || 1, // cached once

  /* Touch state */
  touchStartX: 0,
  touchStartY: 0,
  touchStartTime: 0,
  touchHandlersAdded: false,

  /* ---------- Open viewer ---------- */
  open(name, url, playlist = [], skipAutoChord = false) {
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

    // Auto-open chord search (skip in Live Mode)
    if (!skipAutoChord) this.autoOpenChord(name);

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
    // Hide chord panel if showing
    const chordPanel = document.getElementById('viewer-chord-panel');
    if (chordPanel) chordPanel.style.display = 'none';

    // Google Drive preview URL — show in iframe directly
    if (url && url.startsWith('https://drive.google.com/')) {
      this.showDrivePreview(url);
      return;
    }

    // Personal Google Drive file via proxy endpoint
    if (url && (url.startsWith('/api/drive-file') || url.includes('/api/drive-file'))) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('HTTP status ' + response.status);
        }
        const mimeType = response.headers.get('Content-Type') || '';
        
        if (mimeType.startsWith('image/')) {
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          this.isImage = true;
          this.showImageFromUrl(blobUrl);
        } else if (mimeType === 'application/pdf') {
          const arrayBuffer = await response.arrayBuffer();
          const uint8 = new Uint8Array(arrayBuffer);
          this.isImage = false;
          await this.loadPdfFromBuffer(uint8);
        } else {
          // Fallback to iframe for other mime types (e.g. .sib) if we can extract file ID
          const urlObj = new URL(url, window.location.origin);
          const fileId = urlObj.searchParams.get('id');
          if (fileId) {
            this.showDrivePreview(`https://drive.google.com/file/d/${fileId}/preview`);
          } else {
            this.showError('ไม่สามารถแสดงไฟล์ประเภทนี้ได้: ' + mimeType);
          }
        }
      } catch (err) {
        this.showError('ไม่สามารถโหลดไฟล์จาก Google Drive: ' + err.message);
      }
      return;
    }

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

    // If backend returns a drive URL (fallback)
    if (res.data.driveUrl) {
      this.showDrivePreview(res.data.driveUrl);
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

  /* ---------- Show Google Drive preview in iframe ---------- */
  showDrivePreview(url) {
    const canvas = document.getElementById('viewer-canvas');
    canvas.style.display = 'none';
    const img = document.getElementById('viewer-img');
    if (img) img.style.display = 'none';

    let iframe = document.getElementById('viewer-drive-iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'viewer-drive-iframe';
      iframe.style.cssText = 'width:100%;height:100%;border:none;position:absolute;inset:0;background:#fff;';
      iframe.setAttribute('allowfullscreen', 'true');
      document.getElementById('viewer-body').appendChild(iframe);
    }
    iframe.src = url;
    iframe.style.display = 'block';

    this.isImage = false;
    this.totalPages = 1;
    this.currentPage = 1;
    this.updatePageIndicator();
    this.showLoading(false);
  },

  /* ---------- Show image ---------- */
  showImage(base64, mime) {
    const canvas = document.getElementById('viewer-canvas');
    canvas.style.display = 'none';
    const iframe = document.getElementById('viewer-drive-iframe');
    if (iframe) { iframe.src = ''; iframe.style.display = 'none'; }

    let img = document.getElementById('viewer-img');
    if (!img) {
      img = document.createElement('img');
      img.id = 'viewer-img';
      img.style.cssText = 'width:100%;height:auto;display:block;';
      document.getElementById('viewer-body').appendChild(img);
    }
    img.src = 'data:' + mime + ';base64,' + base64;
    img.style.display = 'block';

    this.totalPages = 1;
    this.currentPage = 1;
    this.updatePageIndicator();
    this.showLoading(false);
  },

  showImageFromUrl(url) {
    const canvas = document.getElementById('viewer-canvas');
    canvas.style.display = 'none';
    const iframe = document.getElementById('viewer-drive-iframe');
    if (iframe) { iframe.src = ''; iframe.style.display = 'none'; }

    let img = document.getElementById('viewer-img');
    if (!img) {
      img = document.createElement('img');
      img.id = 'viewer-img';
      img.style.cssText = 'width:100%;height:auto;display:block;';
      document.getElementById('viewer-body').appendChild(img);
    }
    img.src = url;
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
    const iframe = document.getElementById('viewer-drive-iframe');
    if (iframe) { iframe.src = ''; iframe.style.display = 'none'; }

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

  async loadPdfFromBuffer(uint8) {
    const img = document.getElementById('viewer-img');
    if (img) img.style.display = 'none';
    const iframe = document.getElementById('viewer-drive-iframe');
    if (iframe) { iframe.src = ''; iframe.style.display = 'none'; }

    const canvas = document.getElementById('viewer-canvas');
    canvas.style.display = 'block';

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
    if (!this.pdfDoc) return;

    // If already rendering, queue the page and return
    if (this.rendering) {
      this.pendingPage = num;
      return;
    }
    this.rendering = true;

    try {
      const page = await this.pdfDoc.getPage(num);
      const canvas = document.getElementById('viewer-canvas');
      const ctx = canvas.getContext('2d');
      const container = document.getElementById('viewer-body');

      const unscaled = page.getViewport({ scale: 1 });
      const scale = container.clientWidth / unscaled.width;
      const viewport = page.getViewport({ scale });

      // Scroll to top when page changes
      container.scrollTop = 0;

      // Sharp rendering on HiDPI (cached dpr)
      canvas.width = viewport.width * this.dpr;
      canvas.height = viewport.height * this.dpr;
      canvas.style.width = viewport.width + 'px';
      canvas.style.height = viewport.height + 'px';

      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

      await page.render({ canvasContext: ctx, viewport }).promise;
    } catch (e) {
      console.error('Render error:', e);
    }

    this.rendering = false;

    // Process pending page (rapid navigation)
    if (this.pendingPage !== null) {
      const next = this.pendingPage;
      this.pendingPage = null;
      this.renderPage(next);
    }
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

    // Prevent text/image drag
    body.addEventListener('dragstart', (e) => e.preventDefault());
    body.addEventListener('selectstart', (e) => e.preventDefault());

    // --- Swipe left/right to change page ---
    let swiping = false; // true when horizontal swipe detected mid-gesture

    body.addEventListener('touchstart', (e) => {
      if (e.touches.length > 1) return;
      this.touchStartX = e.changedTouches[0].clientX;
      this.touchStartY = e.changedTouches[0].clientY;
      this.touchStartTime = Date.now();
      swiping = false;
    }, { passive: true });

    // Detect horizontal swipe during move — prevent scroll if swiping
    body.addEventListener('touchmove', (e) => {
      if (e.touches.length > 1 || this.totalPages <= 1) return;
      const dx = e.touches[0].clientX - this.touchStartX;
      const dy = e.touches[0].clientY - this.touchStartY;
      // If moved >15px horizontally and direction is mostly horizontal
      if (!swiping && Math.abs(dx) > 15 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        swiping = true;
      }
      if (swiping) {
        e.preventDefault(); // stop vertical scroll during horizontal swipe
      }
    }, { passive: false });

    body.addEventListener('touchend', (e) => {
      if (e.changedTouches.length === 0) return;
      const dx = e.changedTouches[0].clientX - this.touchStartX;
      const dy = e.changedTouches[0].clientY - this.touchStartY;
      const dt = Date.now() - this.touchStartTime;

      // Swipe: min 50px horizontal, mostly horizontal, within 600ms
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3 && dt < 600) {
        if (dx < 0) this.nextPage();
        else this.prevPage();
      }
      swiping = false;
    }, { passive: true });

    // --- Bottom-right corner tap zone ---
    let tapZone = document.getElementById('viewer-tap-next');
    if (!tapZone) {
      tapZone = document.createElement('div');
      tapZone.id = 'viewer-tap-next';
      tapZone.className = 'viewer-tap-next';
      body.appendChild(tapZone);
    }
    tapZone.addEventListener('click', (e) => {
      e.stopPropagation();
      this.nextPage();
    });

    // --- Orientation change: re-render PDF ---
    this._orientHandler = () => {
      if (this.pdfDoc && !this.isImage && this.currentPage) {
        setTimeout(() => this.renderPage(this.currentPage), 200);
      }
    };
    window.addEventListener('orientationchange', this._orientHandler);
    this._resizeHandler = this._debounceResize();
    window.addEventListener('resize', this._resizeHandler);
  },

  _debounceResize() {
    let timer = null;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (this.pdfDoc && !this.isImage && this.currentPage) {
          this.renderPage(this.currentPage);
        }
      }, 300);
    };
  },

  /* ---------- Close viewer ---------- */
  close() {
    const overlay = document.getElementById('viewer-overlay');
    overlay.classList.remove('open');
    document.body.style.overflow = '';

    // Remove song popup if present
    const popup = document.getElementById('viewer-song-popup');
    if (popup) popup.remove();

    const canvas = document.getElementById('viewer-canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    const img = document.getElementById('viewer-img');
    if (img) {
      if (img.src && img.src.startsWith('blob:')) {
        URL.revokeObjectURL(img.src);
      }
      img.src = '';
      img.style.display = 'none';
    }

    const iframe = document.getElementById('viewer-drive-iframe');
    if (iframe) { iframe.src = ''; iframe.style.display = 'none'; }

    const chordPanel = document.getElementById('viewer-chord-panel');
    if (chordPanel) chordPanel.style.display = 'none';

    this.clearError();
    this.pdfDoc = null;
    this.currentSong = null;
    this.currentUrl = null;

    document.removeEventListener('keydown', this._keyHandler);
    if (this._orientHandler) {
      window.removeEventListener('orientationchange', this._orientHandler);
    }
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
  },

  /* ---------- Song navigation (setlist) — with popup ---------- */
  prevSong() {
    if (this.playlistIndex <= 0 || this.playlist.length === 0) return;
    const nextIdx = this.playlistIndex - 1;
    this._showSongPopup(this.playlist[nextIdx], nextIdx);
  },

  nextSong() {
    if (this.playlistIndex >= this.playlist.length - 1 || this.playlist.length === 0) return;
    const nextIdx = this.playlistIndex + 1;
    this._showSongPopup(this.playlist[nextIdx], nextIdx);
  },

  _showSongPopup(song, idx) {
    // Remove existing popup
    const old = document.getElementById('viewer-song-popup');
    if (old) old.remove();

    const popup = document.createElement('div');
    popup.id = 'viewer-song-popup';
    popup.className = 'viewer-song-popup';

    const direction = idx > this.playlistIndex ? 'เพลงถัดไป ▸' : '◂ เพลงก่อนหน้า';
    popup.innerHTML =
      '<div class="viewer-song-popup-label">' + direction + '</div>' +
      '<div class="viewer-song-popup-name">' + Library.escapeHtml(song.name) + '</div>' +
      '<div class="viewer-song-popup-hint">แตะเพื่อเปิดคอร์ด</div>';

    popup.addEventListener('click', () => {
      popup.remove();
      this.playlistIndex = idx;
      this.navigateToSong(song);
    });

    document.getElementById('viewer-overlay').appendChild(popup);

    // Auto-dismiss after 5 seconds
    setTimeout(() => { if (popup.parentNode) popup.remove(); }, 5000);
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

    // Auto-open chord for new song (closes old tab)
    this.autoOpenChord(song.name);

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

  /* ---------- Auto-open chord in new tab ---------- */
  autoOpenChord(songName) {
    // Disabled in v2.0 Premium to keep users inside the app.
    // Users can click the 🎸 button to open AI chords inside the viewer.
  },

  /* ---------- Search chords on Google ---------- */
  searchChord(songName) {
    this.openChordSearch(songName || this.currentSong);
  },

  /* ---------- Open chord search panel (when no sheet music found) ---------- */
  openChordSearch(songName) {
    this.currentSong = songName;
    this.currentUrl = null;

    const overlay = document.getElementById('viewer-overlay');
    document.getElementById('viewer-title').textContent = songName;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Hide all content views
    document.getElementById('viewer-canvas').style.display = 'none';
    const img = document.getElementById('viewer-img');
    if (img) img.style.display = 'none';
    const iframe = document.getElementById('viewer-drive-iframe');
    if (iframe) { iframe.src = ''; iframe.style.display = 'none'; }
    this.clearError();

    // Show chord panel with loading, then populate with links
    let panel = document.getElementById('viewer-chord-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'viewer-chord-panel';
      document.getElementById('viewer-body').appendChild(panel);
    }
    panel.style.display = 'none';
    this.showLoading(true);

    // Update toolbar
    this.updateFavButton();
    const prevBtn = document.getElementById('viewer-prev');
    const nextBtn = document.getElementById('viewer-next');
    if (prevBtn) prevBtn.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';
    document.getElementById('viewer-page-indicator').style.display = 'none';

    // Keyboard
    this._keyHandler = this.handleKey.bind(this);
    document.addEventListener('keydown', this._keyHandler);

    // Show chord search panel immediately (Google links)
    this.showLoading(false);
    this._showChordPanel(songName);
  },

  /* ---------- Show AI Chord Panel ---------- */
  async _showChordPanel(songName) {
    let panel = document.getElementById('viewer-chord-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'viewer-chord-panel';
      document.getElementById('viewer-body').appendChild(panel);
    }

    const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const q = encodeURIComponent(songName);
    const googleUrl = 'https://www.google.com/search?q=' + encodeURIComponent(songName + ' คอร์ด');

    // Show loading state
    panel.innerHTML =
      '<div style="font-size:2.5rem;margin-bottom:8px;">✨</div>' +
      '<div style="font-size:1.2rem;font-weight:700;color:var(--text-primary);margin:8px 0 20px;text-align:center;">กำลังให้ AI ค้นหาคอร์ดเพลง...</div>' +
      '<div class="loading-spinner" style="margin-bottom:20px;"></div>' +
      '<div style="font-size:0.9rem;color:var(--text-muted);">' + esc(songName) + '</div>';
    
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    panel.style.alignItems = 'center';
    panel.style.padding = '24px 16px';
    panel.style.overflowY = 'auto';

    // Fetch AI Chords
    const res = await API.searchAiChords(songName);
    
    if (res.success && res.data) {
      const chordsText = res.data.chords || res.data;
      const sourceText = res.data.source || 'AI';
      
      panel.innerHTML =
        '<div style="width:100%;max-width:800px;margin:0 auto;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
            '<div style="font-size:1.4rem;font-weight:700;color:var(--text-primary);"><span style="margin-right:8px;">🎸</span>' + esc(songName) + '</div>' +
            '<div style="font-size:0.8rem;color:var(--accent);background:var(--accent-bg);padding:4px 8px;border-radius:var(--radius-sm);">' + esc(sourceText) + '</div>' +
          '</div>' +
          '<pre style="white-space:pre-wrap;font-family:var(--font-mono);font-size:14px;line-height:1.6;color:var(--text-primary);background:var(--bg-card);padding:20px;border-radius:var(--radius-md);border:1px solid var(--border-secondary);overflow-x:auto;">' + 
            esc(chordsText.chords || chordsText) + 
          '</pre>' +
          '<div style="margin-top:20px;text-align:center;">' +
            '<a href="' + googleUrl + '" target="_blank" rel="noopener" class="btn" style="display:inline-flex;align-items:center;gap:8px;background:var(--bg-tertiary);color:var(--text-secondary);padding:8px 16px;border-radius:var(--radius-full);font-size:13px;border:1px solid var(--border-secondary);">' +
              '<span>🔍</span> ค้นหาเพิ่มเติมบน Google' +
            '</a>' +
          '</div>' +
        '</div>';
    } else {
      panel.innerHTML =
        '<div style="font-size:2.5rem;margin-bottom:8px;">🎸</div>' +
        '<div style="font-size:0.9rem;color:var(--danger);">เกิดข้อผิดพลาดในการดึงข้อมูลจาก AI</div>' +
        '<div style="font-size:1.2rem;font-weight:700;color:var(--text-primary);margin:8px 0 20px;text-align:center;">' + esc(songName) + '</div>' +
        '<div style="margin-top:20px;text-align:center;">' +
          '<a href="' + googleUrl + '" target="_blank" rel="noopener" class="btn" style="display:inline-flex;align-items:center;gap:8px;background:var(--accent);color:#fff;padding:10px 20px;border-radius:var(--radius-full);font-size:14px;border:none;">' +
            '<span>🔍</span> ค้นหาคอร์ดบน Google ด้วยตนเอง' +
          '</a>' +
        '</div>';
    }
  },

  /* ---------- Helpers ---------- */
  extractFileId(url) {
    return url || null;
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
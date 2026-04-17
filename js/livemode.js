/* ============================================
   Note Chord SoulCiety - Live Mode
   Auto-connect to BandThai Live broadcast
   ============================================ */

var LiveMode = {
  active: false,
  channel: null,
  sb: null,
  bandId: '',
  channelName: '',
  playlist: [],
  currentIdx: -1,
  _currentSongName: null,
  joinedAt: 0,
  pendingSong: null,
  _connectId: 0,
  _tempChannels: [],
  viewMode: localStorage.getItem('ncs-live-viewMode') || 'notes', // 'notes' or 'chords'

  /* ========== renderView ========== */
  renderView: function() {
    document.getElementById('topbar-title').textContent = 'Live Mode';
    var area = document.getElementById('content-area');

    // already connected
    if (this.active) {
      area.innerHTML = this._activeHTML();
      return;
    }

    // not logged in
    var user = Auth.getUser();
    if (!user || !user.email) {
      area.innerHTML = '<div style="max-width:480px;margin:3rem auto;padding:1.5rem;text-align:center;">' +
        '<h2 style="color:var(--text-primary);">&#127928; Live Mode</h2>' +
        '<p style="color:#e65100;margin-top:1rem;">&#x26A0; กรุณาล็อคอินก่อนใช้ Live Mode</p></div>';
      return;
    }

    // show searching UI
    area.innerHTML = '<div style="max-width:480px;margin:3rem auto;padding:1.5rem;text-align:center;">' +
      '<h2 style="color:var(--text-primary);">&#127928; Live Mode</h2>' +
      '<div class="loading-spinner" style="margin:2rem auto;"></div>' +
      '<div id="live-status" style="font-size:0.9rem;color:var(--text-muted);margin-top:1rem;">กำลังค้นหา Live session...</div>' +
      '</div>';

    // start auto-connect (cancel previous if any)
    this._autoConnect();
  },

  /* ========== auto connect ========== */
  _autoConnect: function() {
    var self = this;
    this._connectId++;
    var myId = this._connectId;
    this._cleanup();
    this.joinedAt = Date.now();
    this._debugLog = [];
    this._dbg('Start auto-connect #' + myId);

    this._initSB();
    if (!this.sb) {
      this._showResult('&#x26A0; Supabase SDK ยังไม่โหลด กรุณา refresh หน้า');
      return;
    }
    this._dbg('Supabase OK');

    // Step 1: try cached band_id
    var cached = localStorage.getItem('ncs-live-bandId');
    this._dbg('Cached bandId: ' + (cached || 'NONE'));
    if (cached) {
      this._setStatus('กำลังค้นหา Live session...');
      this._scanForBand(cached, myId).then(function(ok) {
        if (myId !== self._connectId) return;
        if (ok) return;
        // cached band not found — try full discovery as fallback
        console.log('[LiveMode] Cached band not found, trying full discovery...');
        self._discover(myId);
      }).catch(function(e) {
        console.error('[LiveMode] scanForBand error:', e);
        if (myId !== self._connectId) return;
        self._discover(myId);
      });
    } else {
      this._discover(myId);
    }
  },

  /* ========== discover from guest tokens ========== */
  _discover: function(myId) {
    var self = this;
    this._setStatus('กำลังค้นหา Live session จาก BandThai...');

    this._discoverTokens(myId).then(function(ok) {
      if (myId !== self._connectId) return;
      if (ok) return;
      self._showResult('ไม่พบ Live session ที่เปิดอยู่<br><span style="font-size:0.85rem;">เปิด BandThai Live แล้วกลับมาที่หน้านี้</span>',
        '<button class="btn btn-primary" onclick="LiveMode.renderView()" style="margin-top:1.5rem;padding:10px 32px;">&#x1F504; ลองใหม่</button>' +
        '<div id="live-debug" style="margin-top:1.5rem;text-align:left;font-size:0.75rem;color:var(--text-muted);background:var(--bg-secondary);padding:12px;border-radius:8px;max-height:200px;overflow:auto;font-family:monospace;">' +
          (self._debugLog || []).join('<br>') + '</div>');
    }).catch(function() {
      if (myId !== self._connectId) return;
      self._showResult('เกิดข้อผิดพลาด กรุณาลองใหม่',
        '<button class="btn btn-primary" onclick="LiveMode.renderView()" style="margin-top:1rem;padding:10px 32px;">&#x1F504; ลองใหม่</button>');
    });
  },

  /* ========== query live_guest_tokens (public) ========== */
  _discoverTokens: function(myId) {
    var self = this;
    var now = new Date().toISOString();
    return this.sb.from('live_guest_tokens')
      .select('band_id, date, venue, time_slot')
      .gt('expires_at', now)
      .then(function(resp) {
        if (myId !== self._connectId) return false;
        if (resp.error) {
          self._dbg('guest_tokens ERROR: ' + JSON.stringify(resp.error));
          console.log('[LiveMode] No active guest tokens, error:', resp.error);
          return false;
        }
        if (!resp.data || resp.data.length === 0) {
          self._dbg('guest_tokens: 0 results');
          console.log('[LiveMode] No active guest tokens');
          return false;
        }
        self._dbg('guest_tokens: ' + resp.data.length + ' found');
        console.log('[LiveMode] Found', resp.data.length, 'active guest tokens');
        var map = {};
        for (var i = 0; i < resp.data.length; i++) {
          var t = resp.data[i];
          var venueStr = t.venue ? self._sanitizeCh(t.venue) : '';
          var ts = t.time_slot ? t.time_slot.replace(/[^0-9]/g, '') : '';
          var ch = 'live-' + t.band_id + '-' + t.date
            + (venueStr ? '-' + venueStr : '')
            + (ts ? '-' + ts : '');
          map[ch] = t.band_id;
        }
        self._setStatus('พบ ' + Object.keys(map).length + ' session กำลังตรวจสอบ...');
        return self._scanChannels(map, myId);
      });
  },

  /* ========== scan for specific band ========== */
  _scanForBand: function(bandId, myId) {
    var self = this;
    var map = {};

    // try guest tokens for this band
    var now = new Date().toISOString();
    return this.sb.from('live_guest_tokens')
      .select('date, venue, time_slot')
      .eq('band_id', bandId)
      .gt('expires_at', now)
      .then(function(resp) {
        if (myId !== self._connectId) return false;
        if (resp.error) {
          self._dbg('band tokens ERROR: ' + JSON.stringify(resp.error));
          console.warn('[LiveMode] guest_tokens query error:', resp.error);
        }
        if (!resp.error && resp.data && resp.data.length > 0) {
          self._dbg('band tokens: ' + resp.data.length + ' found');
          // Got exact tokens — use these plus today common slots
          for (var i = 0; i < resp.data.length; i++) {
            var t = resp.data[i];
            var venueStr = t.venue ? self._sanitizeCh(t.venue) : '';
            var ts = t.time_slot ? t.time_slot.replace(/[^0-9]/g, '') : '';
            map['live-' + bandId + '-' + t.date
              + (venueStr ? '-' + venueStr : '')
              + (ts ? '-' + ts : '')] = bandId;
          }
        }
        // Always add today's common slots as fallback (no-venue, digits-only timeSlot)
        var today = new Date().toISOString().slice(0, 10);
        var slots = ['', '19002200', '19002300', '20002300', '20002400', '20000100'];
        for (var j = 0; j < slots.length; j++) {
          var ch = 'live-' + bandId + '-' + today + (slots[j] ? '-' + slots[j] : '');
          if (!map[ch]) map[ch] = bandId;
        }
        console.log('[LiveMode] Scanning', Object.keys(map).length, 'channels for band', bandId);
        self._dbg('Scanning ' + Object.keys(map).length + ' channels');
        self._dbg('Channels: ' + Object.keys(map).slice(0, 3).join(', ') + (Object.keys(map).length > 3 ? '...' : ''));
        return self._scanChannels(map, myId);
      });
  },

  /* ========== subscribe to channels, first state_sync wins ========== */
  _scanChannels: function(map, myId) {
    var self = this;
    var keys = Object.keys(map);
    if (keys.length === 0) return Promise.resolve(false);

    return new Promise(function(resolve) {
      var done = false;
      var secs = 5;

      // Countdown display
      var countdownTimer = setInterval(function() {
        if (done) { clearInterval(countdownTimer); return; }
        secs--;
        if (secs > 0) self._setStatus('กำลังค้นหา Live session... (' + secs + ')');
      }, 1000);

      var timer = setTimeout(function() {
        if (done || myId !== self._connectId) return;
        done = true;
        clearInterval(countdownTimer);
        self._dbg('Scan timeout (' + keys.length + ' ch)');
        console.log('[LiveMode] Channel scan timeout (' + keys.length + ' channels)');
        self._cleanup();
        resolve(false);
      }, 5000);

      for (var i = 0; i < keys.length; i++) {
        (function(chName) {
          var bandId = map[chName];
          var ch = self.sb.channel(chName, { config: { broadcast: { self: false } } });
          self._tempChannels.push(ch);

          ch.on('broadcast', { event: 'state_sync' }, function(payload) {
            if (done || myId !== self._connectId) return;
            done = true;
            clearTimeout(timer);
            clearInterval(countdownTimer);
            console.log('[LiveMode] state_sync from:', chName);

            self.bandId = bandId;
            self.channelName = chName;
            self.channel = ch;
            localStorage.setItem('ncs-live-bandId', bandId);

            var p = payload.payload || {};
            if (p.playlist && Array.isArray(p.playlist)) {
              self.playlist = p.playlist;
              if (typeof p.current === 'number') {
                self.currentIdx = -1;
                self._songChanged(p.current);
              }
            }

            self._listen(ch);
            self.active = true;
            self._badge(true);
            self._loadSongs();

            // cleanup other channels (keep this one)
            var keep = ch;
            for (var x = 0; x < self._tempChannels.length; x++) {
              if (self._tempChannels[x] !== keep) {
                try { self._tempChannels[x].unsubscribe(); } catch(e) {}
              }
            }
            self._tempChannels = [];

            App.toast('&#x1F534; เชื่อมต่อ Live Mode แล้ว!', 'success');
            if (App.currentView === 'livemode') self.renderView();
            resolve(true);
          });

          ch.subscribe(function(status) {
            self._dbg('ch ' + chName.slice(-15) + ' -> ' + status);
            if (status === 'SUBSCRIBED' && !done && myId === self._connectId) {
              ch.send({ type: 'broadcast', event: 'request_state', payload: { joinedAt: self.joinedAt } });
            }
          });
        })(keys[i]);
      }
    });
  },

  /* ========== event listeners ========== */
  _listen: function(ch) {
    var self = this;

    // เพลงปัจจุบันเปลี่ยน → แสดง banner
    ch.on('broadcast', { event: 'song_ending' }, function(payload) {
      var d = payload.payload || {};
      if (typeof d.next === 'number' && d.next >= 0 && d.next < self.playlist.length) {
        self._songChanged(d.next);
      } else if (typeof d.from === 'number') {
        var n = d.from + 1;
        while (n < self.playlist.length && self.playlist[n]._skipped) n++;
        if (n < self.playlist.length) self._songChanged(n);
      }
    });

    ch.on('broadcast', { event: 'current_changed' }, function(payload) {
      var d = payload.payload || {};
      if (typeof d.idx === 'number' && d.idx >= 0 && d.idx < self.playlist.length) {
        self._songChanged(d.idx);
      }
    });

    ch.on('broadcast', { event: 'state_sync' }, function(payload) {
      var d = payload.payload || {};
      if (d.playlist && Array.isArray(d.playlist)) {
        self.playlist = d.playlist;
        if (typeof d.current === 'number' && d.current >= 0 && d.current < d.playlist.length) {
          self._songChanged(d.current);
        }
        self._refreshUI();
      }
    });

    // เพลงขอเข้ามา → แค่เพิ่มเข้าคิว, ไม่ทำอะไรอื่น (ยังไม่ได้เล่น)
    ch.on('broadcast', { event: 'request_song' }, function(payload) {
      var d = payload.payload || {};
      if (d.song) {
        var at = (typeof d.insertAfter === 'number') ? d.insertAfter + 1 : self.playlist.length;
        self.playlist.splice(at, 0, d.song);
        // ไม่เรียก _songChanged — รอจนวงกดเล่นจริงถึงจะเปลี่ยน
      }
    });

    ch.on('broadcast', { event: 'skip_song' }, function(payload) {
      var d = payload.payload || {};
      if (typeof d.idx === 'number' && self.playlist[d.idx]) {
        self.playlist[d.idx]._skipped = true;
        self._refreshUI();
      }
    });

    ch.on('broadcast', { event: 'unskip_song' }, function(payload) {
      var d = payload.payload || {};
      if (typeof d.idx === 'number' && self.playlist[d.idx]) {
        self.playlist[d.idx]._skipped = false;
        self._refreshUI();
      }
    });

    ch.on('broadcast', { event: 'reorder' }, function(payload) {
      var d = payload.payload || {};
      if (typeof d.from === 'number' && typeof d.to === 'number') {
        var item = self.playlist.splice(d.from, 1)[0];
        self.playlist.splice(d.to, 0, item);
        if (self.currentIdx === d.from) self.currentIdx = d.to;
        else if (d.from < self.currentIdx && d.to >= self.currentIdx) self.currentIdx--;
        else if (d.from > self.currentIdx && d.to <= self.currentIdx) self.currentIdx++;
        self._refreshUI();
      }
    });

    ch.on('broadcast', { event: 'remove' }, function(payload) {
      var d = payload.payload || {};
      if (typeof d.idx === 'number' && d.idx < self.playlist.length) {
        self.playlist.splice(d.idx, 1);
        if (self.currentIdx >= self.playlist.length) self.currentIdx = Math.max(0, self.playlist.length - 1);
        self._refreshUI();
      }
    });

    ch.on('broadcast', { event: 'transpose' }, function(payload) {
      var d = payload.payload || {};
      if (typeof d.idx === 'number' && self.playlist[d.idx] && d.key) {
        self.playlist[d.idx]._key = d.key;
        self._refreshUI();
      }
    });
  },

  /* ========== song changed — จับแค่ชื่อเพลงที่กำลังเล่น ========== */
  _songChanged: function(idx) {
    var song = this.playlist[idx];
    if (!song) return;
    var newName = song.name;
    console.log('[LiveMode] Song changed idx:', idx, 'name:', newName, 'current:', this._currentSongName || 'NONE');

    // เพลงเดิมที่กำลังแสดงอยู่ — ไม่ทำอะไร
    if (newName === this._currentSongName) {
      this.currentIdx = idx;
      return;
    }

    // เพลงแรกหลัง connect — เปิดทันที
    if (!this._currentSongName) {
      this.currentIdx = idx;
      this._currentSongName = newName;
      this._openSong(newName);
      this._refreshUI();
      return;
    }

    // เพลงต่างจากที่แสดงอยู่ — แสดง banner ให้ยืนยัน
    this.pendingSong = { idx: idx, name: newName };
    this._showBanner(newName);
    this._refreshUI();
  },

  /* ========== banner ========== */
  _showBanner: function(name) {
    this._hideBanner();
    var b = document.createElement('div');
    b.id = 'live-banner';
    b.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:10000;background:linear-gradient(135deg,#1a237e,#283593);color:#fff;padding:16px 20px;display:flex;align-items:center;gap:12px;box-shadow:0 -4px 20px rgba(0,0,0,0.3);animation:slideUpBanner 0.3s ease;';
    b.innerHTML =
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:0.8rem;opacity:0.8;">&#x23ED; เพลงถัดไป</div>' +
        '<div style="font-size:1.1rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + this._e(name) + '</div>' +
      '</div>' +
      '<button onclick="LiveMode.confirmSong()" style="background:#4caf50;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-weight:600;cursor:pointer;">&#x2705; เปลี่ยนเพลง</button>' +
      '<button onclick="LiveMode.dismissSong()" style="background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.3);padding:10px 16px;border-radius:8px;cursor:pointer;">&#x2715;</button>';
    document.body.appendChild(b);
  },

  confirmSong: function() {
    if (!this.pendingSong) return;
    this.currentIdx = this.pendingSong.idx;
    var name = this.pendingSong.name;
    this._currentSongName = name;
    this.pendingSong = null;
    this._hideBanner();
    this._openSong(name);
    this._refreshUI();
  },

  dismissSong: function() {
    this.pendingSong = null;
    this._hideBanner();
  },

  _hideBanner: function() {
    var el = document.getElementById('live-banner');
    if (el) el.remove();
  },

  /* ========== match & open sheet music ========== */
  _openSong: function(songName) {
    if (!songName) return;
    var self = this;

    // Chord mode: always search chords
    if (this.viewMode === 'chords') {
      self._matchStatus('&#x1F3B8; คอร์ด: ' + songName, '#2196f3');
      Viewer.openChordSearch(songName);
      return;
    }

    // Notes mode: search library first, fallback to chords
    this._loadSongs().then(function() {
      if (!Library.songs || Library.songs.length === 0) {
        self._matchStatus('&#x26A0; ไม่มีเพลงในระบบ', '#f44336');
        return;
      }

      var lower = songName.toLowerCase().trim();
      var norm = function(s) { return s.toLowerCase().replace(/[\s\-_()（）\[\]【】]/g, ''); };
      var target = norm(songName);
      var bestMatch = null;
      var bestScore = 0;

      for (var i = 0; i < Library.songs.length; i++) {
        var n = Library.songs[i].name.toLowerCase().trim();
        var nn = norm(Library.songs[i].name);
        var score = 0;

        // Exact match (highest priority)
        if (n === lower || nn === target) {
          score = 100;
        }
        // One fully contains the other — score by similarity ratio
        else if (n.indexOf(lower) >= 0 || lower.indexOf(n) >= 0) {
          var shorter = Math.min(n.length, lower.length);
          var longer = Math.max(n.length, lower.length);
          score = (shorter / longer) * 80; // max 80 for partial
        }
        // Fuzzy (normalized) contains
        else if (nn.indexOf(target) >= 0 || target.indexOf(nn) >= 0) {
          var sn = Math.min(nn.length, target.length);
          var ln = Math.max(nn.length, target.length);
          score = (sn / ln) * 70; // max 70 for fuzzy
        }

        // Must be at least 50% similar to count as a match
        if (score > 50 && score > bestScore) {
          bestScore = score;
          bestMatch = Library.songs[i];
          if (score === 100) break; // exact — no need to continue
        }
      }

      console.log('[LiveMode] Match "' + songName + '" -> ' + (bestMatch ? bestMatch.name + ' (score:' + bestScore.toFixed(0) + ')' : 'NOT FOUND'));

      if (bestMatch) {
        self._matchStatus('&#x2705; เจอโน้ต: ' + bestMatch.name, '#4caf50');
        Viewer.open(bestMatch.name, bestMatch.url, []);
      } else {
        self._matchStatus('&#x1F3B8; ไม่พบโน้ต — ค้นหาคอร์ดแทน: ' + songName, '#ff9800');
        Viewer.openChordSearch(songName);
      }
    });
  },

  _matchStatus: function(html, color) {
    var el = document.getElementById('live-match-status');
    if (el) { el.innerHTML = html; el.style.color = color; }
  },

  /* ========== helpers ========== */
  _dbg: function(msg) {
    var t = new Date().toLocaleTimeString('th-TH');
    var line = t + ' ' + msg;
    console.log('[LiveMode]', msg);
    if (!this._debugLog) this._debugLog = [];
    this._debugLog.push(line);
  },

  _initSB: function() {
    if (this.sb) return;
    if (typeof window.supabase === 'undefined' || !window.supabase.createClient) return;
    this.sb = window.supabase.createClient(
      'https://wsorngsyowgxikiepice.supabase.co',
      'sb_publishable_k2zvxeE9SJEEJkw3SVolqg_pkgZQPnm'
    );
  },

  _loadSongs: function() {
    if (Library.songs && Library.songs.length > 0) return Promise.resolve();
    var cached = localStorage.getItem('ncs-songs-cache');
    if (cached) { try { Library.songs = JSON.parse(cached); } catch(e) {} }
    if (Library.songs && Library.songs.length > 0) return Promise.resolve();
    return API.listSongs().then(function(res) {
      if (res.success && res.data && res.data.songs) {
        Library.songs = res.data.songs;
        localStorage.setItem('ncs-songs-cache', JSON.stringify(Library.songs));
        localStorage.setItem('ncs-songs-cache-time', Date.now().toString());
      }
    }).catch(function() {});
  },

  _setStatus: function(text) {
    var el = document.getElementById('live-status');
    if (el) el.textContent = text;
  },

  _showResult: function(msg, extra) {
    if (App.currentView !== 'livemode') return;
    var area = document.getElementById('content-area');
    if (!area) return;
    area.innerHTML = '<div style="max-width:480px;margin:3rem auto;padding:1.5rem;text-align:center;">' +
      '<h2 style="color:var(--text-primary);">&#127928; Live Mode</h2>' +
      '<p style="color:var(--text-muted);margin-top:1rem;">' + msg + '</p>' +
      (extra || '') + '</div>';
  },

  _refreshUI: function() {
    if (App.currentView !== 'livemode' || !this.active) return;
    var area = document.getElementById('content-area');
    if (area) area.innerHTML = this._activeHTML();
  },

  _cleanup: function() {
    for (var i = 0; i < this._tempChannels.length; i++) {
      try { this._tempChannels[i].unsubscribe(); } catch(e) {}
    }
    this._tempChannels = [];
  },

  disconnect: function() {
    this._connectId++;
    this._cleanup();
    if (this.channel) { try { this.channel.unsubscribe(); } catch(e) {} this.channel = null; }
    this.active = false;
    this.playlist = [];
    this.currentIdx = -1;
    this._currentSongName = null;
    this.pendingSong = null;
    this.channelName = '';
    this._hideBanner();
    this._badge(false);
    App.toast('ตัดการเชื่อมต่อ Live Mode แล้ว', 'info');
    if (App.currentView === 'livemode') this.renderView();
  },

  _badge: function(on) {
    var b = document.getElementById('live-badge');
    if (b) { b.style.display = on ? '' : 'none'; b.textContent = on ? '\u25CF' : ''; b.style.color = '#f44336'; }
  },

  setViewMode: function(mode) {
    this.viewMode = mode;
    localStorage.setItem('ncs-live-viewMode', mode);
    // Re-open current song with new mode
    var song = this.playlist[this.currentIdx];
    if (song) this._openSong(song.name);
    this._refreshUI();
  },

  _e: function(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''; },

  /* ========== sanitize channel part (must match BandThai's _sanitizeChannelPart) ========== */
  _sanitizeCh: function(str) {
    var out = '';
    var s = (str || '').trim();
    for (var i = 0; i < s.length; i++) {
      var code = s.charCodeAt(i);
      if ((code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
        out += s[i]; // 0-9 A-Z a-z
      } else if (code >= 0x0E00 && code <= 0x0E7F) {
        out += code.toString(16); // Thai → hex (same as BandThai)
      } else {
        out += '_';
      }
    }
    return out.replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 60);
  },

  /* ========== active view HTML ========== */
  _activeHTML: function() {
    var song = this.playlist[this.currentIdx];
    var songName = song ? song.name : '\u2014';
    var h = '<div style="max-width:600px;margin:1rem auto;padding:1rem;">' +
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:1rem;">' +
        '<span style="font-size:1.5rem;">&#x1F534;</span>' +
        '<div>' +
          '<div style="font-weight:600;color:var(--text-primary);">Live Mode \u2014 เชื่อมต่อแล้ว</div>' +
          '<div style="font-size:0.8rem;color:var(--text-muted);">' + this._e(this.channelName) + '</div>' +
        '</div>' +
        '<button class="btn" onclick="LiveMode.disconnect()" style="margin-left:auto;background:var(--bg-tertiary);color:#f44336;border:1px solid #f44336;padding:6px 16px;border-radius:8px;">&#x2715; ตัดการเชื่อมต่อ</button>' +
      '</div>' +
      // View mode toggle
      '<div style="display:flex;gap:0;margin-bottom:1rem;border-radius:10px;overflow:hidden;border:2px solid var(--accent);">' +
        '<button onclick="LiveMode.setViewMode(\'notes\')" style="flex:1;padding:10px 0;font-size:0.95rem;font-weight:600;border:none;cursor:pointer;' +
          (this.viewMode === 'notes' ? 'background:var(--accent);color:#fff;' : 'background:var(--bg-secondary);color:var(--text-muted);') + '">' +
          '&#x1F3B5; ดูโน้ต</button>' +
        '<button onclick="LiveMode.setViewMode(\'chords\')" style="flex:1;padding:10px 0;font-size:0.95rem;font-weight:600;border:none;cursor:pointer;' +
          (this.viewMode === 'chords' ? 'background:var(--accent);color:#fff;' : 'background:var(--bg-secondary);color:var(--text-muted);') + '">' +
          '&#x1F3B8; ดูคอร์ด</button>' +
      '</div>' +
      '<div style="background:var(--bg-secondary);border-radius:12px;padding:1.2rem;margin-bottom:1rem;border:2px solid var(--accent);">' +
        '<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:4px;">&#x1F3B5; กำลังเล่น</div>' +
        '<div style="font-size:1.3rem;font-weight:700;color:var(--accent);" id="live-now-playing">' + this._e(songName) + '</div>' +
        '<div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;" id="live-match-status"></div>' +
      '</div>';

    if (this.pendingSong) {
      h += '<div style="background:linear-gradient(135deg,#1a237e,#283593);border-radius:12px;padding:1rem;margin-bottom:1rem;color:#fff;display:flex;align-items:center;gap:12px;">' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:0.8rem;opacity:0.8;">&#x23ED; เพลงถัดไปรอยืนยัน</div>' +
          '<div style="font-size:1.1rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + this._e(this.pendingSong.name) + '</div>' +
        '</div>' +
        '<button onclick="LiveMode.confirmSong()" style="background:#4caf50;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-weight:600;cursor:pointer;">&#x2705; เปลี่ยน</button>' +
        '<button onclick="LiveMode.dismissSong()" style="background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.3);padding:8px 12px;border-radius:8px;cursor:pointer;">&#x2715;</button>' +
      '</div>';
    }

    h += '<div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:0.5rem;">Playlist (' + this.playlist.length + ' เพลง)</div>' +
      '<div style="display:flex;flex-direction:column;gap:4px;">';

    for (var i = 0; i < this.playlist.length; i++) {
      var s = this.playlist[i];
      var cur = (i === this.currentIdx);
      var skip = s._skipped ? 'opacity:0.4;text-decoration:line-through;' : '';
      h += '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:8px;' +
        (cur ? 'background:var(--accent);color:#fff;font-weight:600;' : 'background:var(--bg-secondary);color:var(--text-primary);') +
        skip + '">' +
        '<span style="font-size:0.75rem;min-width:24px;text-align:center;' + (cur ? 'color:#fff;' : 'color:var(--text-muted);') + '">' + (i+1) + '</span>' +
        '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + this._e(s.name) + '</span>' +
        (s._key ? '<span style="font-size:0.75rem;' + (cur ? 'color:rgba(255,255,255,0.8);' : 'color:var(--text-muted);') + '">' + this._e(s._key || s.key) + '</span>' : '') +
        '</div>';
    }

    h += '</div></div>';
    return h;
  }
};

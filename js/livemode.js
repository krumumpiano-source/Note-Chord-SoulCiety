/* ============================================
   Note Chord SoulCiety — Live Mode
   Auto-open sheet music synced with BandThai Live
   ============================================ */

const LiveMode = {
  active: false,
  channel: null,
  sb: null,
  bandId: '',
  date: '',
  timeSlot: '',
  playlist: [],
  currentIdx: -1,
  joinedAt: 0,
  pendingSong: null,       // { idx, name } waiting for user confirmation
  verifiedEmail: false,    // whether email was verified against BandThai

  /* ---------- Render connection UI ---------- */
  renderView() {
    document.getElementById('topbar-title').textContent = 'Live Mode';
    const area = document.getElementById('content-area');

    if (this.active) {
      area.innerHTML = this.renderActiveView();
      return;
    }

    // Restore saved settings
    const savedBandId = localStorage.getItem('ncs-live-bandId') || '';
    const today = new Date().toISOString().slice(0, 10);

    area.innerHTML = `
      <div style="max-width:480px;margin:2rem auto;padding:1.5rem;">
        <h2 style="margin-bottom:0.5rem;color:var(--text-primary);">🎸 Live Mode</h2>
        <p style="color:var(--text-muted);margin-bottom:1.5rem;font-size:0.9rem;">
          เชื่อมต่อกับ BandThai Live Mode เพื่อเปิดโน้ตอัตโนมัติตามเพลงที่กำลังเล่น
        </p>

        <div style="margin-bottom:1rem;">
          <label style="display:block;margin-bottom:0.3rem;color:var(--text-secondary);font-size:0.9rem;">Band ID</label>
          <input type="text" id="live-band-id" value="${this.escapeAttr(savedBandId)}"
            placeholder="เช่น abc123"
            style="width:100%;padding:0.7rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-secondary);color:var(--text-primary);font-size:1rem;box-sizing:border-box;" />
          <p style="color:var(--text-muted);font-size:0.75rem;margin-top:4px;">ดู Band ID ได้ที่ BandThai → ตั้งค่าวง</p>
        </div>

        <div style="margin-bottom:1rem;">
          <label style="display:block;margin-bottom:0.3rem;color:var(--text-secondary);font-size:0.9rem;">วันที่</label>
          <input type="date" id="live-date" value="${today}"
            style="width:100%;padding:0.7rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-secondary);color:var(--text-primary);font-size:1rem;box-sizing:border-box;" />
        </div>

        <div style="margin-bottom:1.5rem;">
          <label style="display:block;margin-bottom:0.3rem;color:var(--text-secondary);font-size:0.9rem;">Time Slot (ถ้ามี)</label>
          <input type="text" id="live-timeslot" value=""
            placeholder="เช่น 20:00 (เว้นว่างได้)"
            style="width:100%;padding:0.7rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-secondary);color:var(--text-primary);font-size:1rem;box-sizing:border-box;" />
        </div>

        <button class="btn btn-primary" onclick="LiveMode.connect()" style="width:100%;padding:0.8rem;font-size:1rem;">
          🔴 เชื่อมต่อ Live Mode
        </button>
      </div>
    `;
  },

  /* ---------- Active view ---------- */
  renderActiveView() {
    const songName = this.playlist[this.currentIdx]?.name || '—';
    let html = `
      <div style="max-width:600px;margin:1rem auto;padding:1rem;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:1rem;">
          <span style="font-size:1.5rem;">🔴</span>
          <div>
            <div style="font-weight:600;color:var(--text-primary);">Live Mode — กำลังเชื่อมต่อ</div>
            <div style="font-size:0.8rem;color:var(--text-muted);" id="live-channel-name">${this.escapeHtml(this.getChannelName())}</div>
          </div>
          <button class="btn" onclick="LiveMode.disconnect()" style="margin-left:auto;background:var(--bg-tertiary);color:#f44336;border:1px solid #f44336;padding:6px 16px;border-radius:8px;">
            ✕ ตัดการเชื่อมต่อ
          </button>
        </div>

        <div style="background:var(--bg-secondary);border-radius:12px;padding:1.2rem;margin-bottom:1rem;border:2px solid var(--accent);">
          <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:4px;">🎵 กำลังเล่น</div>
          <div style="font-size:1.3rem;font-weight:700;color:var(--accent);" id="live-now-playing">${this.escapeHtml(songName)}</div>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;" id="live-match-status"></div>
        </div>
    `;

    // Show pending song notification in the active view
    if (this.pendingSong) {
      html += `
        <div style="background:linear-gradient(135deg,#1a237e,#283593);border-radius:12px;padding:1rem;margin-bottom:1rem;color:#fff;display:flex;align-items:center;gap:12px;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:0.8rem;opacity:0.8;">⏭ เพลงถัดไปรอยืนยัน</div>
            <div style="font-size:1.1rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${this.escapeHtml(this.pendingSong.name)}</div>
          </div>
          <button onclick="LiveMode.confirmSongChange()" style="background:#4caf50;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-weight:600;cursor:pointer;">✅ เปลี่ยน</button>
          <button onclick="LiveMode.dismissSongChange()" style="background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.3);padding:8px 12px;border-radius:8px;cursor:pointer;">✕</button>
        </div>
      `;
    }

    html += `
        <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:0.5rem;">Playlist (${this.playlist.length} เพลง)</div>
        <div id="live-playlist-list" style="display:flex;flex-direction:column;gap:4px;">
    `;

    this.playlist.forEach((s, i) => {
      const isCurrent = i === this.currentIdx;
      const skipped = s._skipped ? 'opacity:0.4;text-decoration:line-through;' : '';
      html += `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:8px;${isCurrent ? 'background:var(--accent);color:#fff;font-weight:600;' : 'background:var(--bg-secondary);color:var(--text-primary);'}${skipped}">
        <span style="font-size:0.75rem;min-width:24px;text-align:center;${isCurrent ? 'color:#fff;' : 'color:var(--text-muted);'}">${i + 1}</span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${this.escapeHtml(s.name)}</span>
        ${s._key ? `<span style="font-size:0.75rem;${isCurrent ? 'color:rgba(255,255,255,0.8);' : 'color:var(--text-muted);'}">${this.escapeHtml(s._key || s.key)}</span>` : ''}
      </div>`;
    });

    html += '</div></div>';
    return html;
  },

  /* ---------- Connect to BandThai Broadcast ---------- */
  async connect() {
    const bandId = (document.getElementById('live-band-id')?.value || '').trim();
    const date = (document.getElementById('live-date')?.value || '').trim();
    const timeSlot = (document.getElementById('live-timeslot')?.value || '').trim();

    if (!bandId) { App.toast('กรุณาใส่ Band ID', 'error'); return; }
    if (!date) { App.toast('กรุณาเลือกวันที่', 'error'); return; }

    // Check NCS login
    const ncsUser = Auth.getUser();
    if (!ncsUser || !ncsUser.email) {
      App.toast('กรุณาล็อคอินก่อนใช้ Live Mode', 'error');
      return;
    }

    this.bandId = bandId;
    this.date = date;
    this.timeSlot = timeSlot;
    this.joinedAt = Date.now();

    localStorage.setItem('ncs-live-bandId', bandId);

    // Init Supabase client (read-only, anon key only)
    if (!this.sb) {
      if (typeof window.supabase === 'undefined') {
        App.toast('Supabase SDK ยังไม่โหลด', 'error');
        return;
      }
      this.sb = window.supabase.createClient(
        'https://wsorngsyowgxikiepice.supabase.co',
        'sb_publishable_k2zvxeE9SJEEJkw3SVolqg_pkgZQPnm'
      );
    }

    // Verify email against BandThai band members
    App.toast('กำลังตรวจสอบสิทธิ์...', 'info');
    const verified = await this.verifyBandMember(ncsUser.email, bandId);
    if (!verified) {
      App.toast('อีเมล ' + ncsUser.email + ' ไม่ตรงกับสมาชิกในวง กรุณาใช้อีเมลเดียวกับ BandThai', 'error');
      return;
    }
    this.verifiedEmail = true;

    this.initChannel();
  },

  /* ---------- Verify email is a BandThai band member ---------- */
  async verifyBandMember(email, bandId) {
    const emailLower = email.toLowerCase().trim();

    // Method 1: Try get_band_profiles RPC (SECURITY DEFINER — works with anon key)
    try {
      const { data, error } = await this.sb.rpc('get_band_profiles', { p_band_id: bandId });
      if (!error && data && Array.isArray(data)) {
        return data.some(m => m.email && m.email.toLowerCase().trim() === emailLower);
      }
    } catch (e) { /* fallback below */ }

    // Method 2: Try band_members table
    try {
      const { data, error } = await this.sb.from('band_members').select('email').eq('band_id', bandId);
      if (!error && data && Array.isArray(data)) {
        return data.some(m => m.email && m.email.toLowerCase().trim() === emailLower);
      }
    } catch (e) { /* fallback below */ }

    // Method 3: Try profiles table directly
    try {
      const { data, error } = await this.sb.from('profiles')
        .select('id')
        .eq('email', emailLower)
        .eq('band_id', bandId)
        .limit(1);
      if (!error && data && data.length > 0) return true;
    } catch (e) { /* all methods failed */ }

    return false;
  },

  getChannelName() {
    let name = 'live-' + this.bandId + '-' + this.date;
    if (this.timeSlot) name += '-' + this.timeSlot.replace(/:/g, '');
    return name;
  },

  initChannel() {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }

    const channelName = this.getChannelName();
    this.channel = this.sb.channel(channelName, { config: { broadcast: { self: false } } });

    this.channel
      .on('broadcast', { event: 'song_ending' }, (payload) => {
        const d = payload.payload || {};
        if (typeof d.next === 'number' && d.next >= 0 && d.next < this.playlist.length) {
          this.onSongChanged(d.next);
        } else if (typeof d.from === 'number') {
          // Auto-advance: find next non-skipped
          let next = d.from + 1;
          while (next < this.playlist.length && this.playlist[next]._skipped) next++;
          if (next < this.playlist.length) this.onSongChanged(next);
        }
      })
      .on('broadcast', { event: 'current_changed' }, (payload) => {
        const d = payload.payload || {};
        if (typeof d.idx === 'number' && d.idx >= 0 && d.idx < this.playlist.length) {
          this.onSongChanged(d.idx);
        }
      })
      .on('broadcast', { event: 'state_sync' }, (payload) => {
        const d = payload.payload || {};
        if (d.playlist && Array.isArray(d.playlist)) {
          this.playlist = d.playlist;
          if (typeof d.current === 'number') {
            this.onSongChanged(d.current);
          }
          this.updateActiveView();
        }
      })
      .on('broadcast', { event: 'request_song' }, (payload) => {
        const d = payload.payload || {};
        if (d.song) {
          const insertAt = (typeof d.insertAfter === 'number') ? d.insertAfter + 1 : this.playlist.length;
          this.playlist.splice(insertAt, 0, d.song);
          this.updateActiveView();
        }
      })
      .on('broadcast', { event: 'skip_song' }, (payload) => {
        const d = payload.payload || {};
        if (typeof d.idx === 'number' && this.playlist[d.idx]) {
          this.playlist[d.idx]._skipped = true;
          this.updateActiveView();
        }
      })
      .on('broadcast', { event: 'unskip_song' }, (payload) => {
        const d = payload.payload || {};
        if (typeof d.idx === 'number' && this.playlist[d.idx]) {
          this.playlist[d.idx]._skipped = false;
          this.updateActiveView();
        }
      })
      .on('broadcast', { event: 'reorder' }, (payload) => {
        const d = payload.payload || {};
        if (typeof d.from === 'number' && typeof d.to === 'number') {
          const [item] = this.playlist.splice(d.from, 1);
          this.playlist.splice(d.to, 0, item);
          // Adjust currentIdx
          if (this.currentIdx === d.from) this.currentIdx = d.to;
          else if (d.from < this.currentIdx && d.to >= this.currentIdx) this.currentIdx--;
          else if (d.from > this.currentIdx && d.to <= this.currentIdx) this.currentIdx++;
          this.updateActiveView();
        }
      })
      .on('broadcast', { event: 'remove' }, (payload) => {
        const d = payload.payload || {};
        if (typeof d.idx === 'number' && d.idx < this.playlist.length) {
          this.playlist.splice(d.idx, 1);
          if (this.currentIdx >= this.playlist.length) this.currentIdx = Math.max(0, this.playlist.length - 1);
          this.updateActiveView();
        }
      })
      .on('broadcast', { event: 'transpose' }, (payload) => {
        const d = payload.payload || {};
        if (typeof d.idx === 'number' && this.playlist[d.idx] && d.key) {
          this.playlist[d.idx]._key = d.key;
          this.updateActiveView();
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.active = true;
          App.toast('🔴 เชื่อมต่อ Live Mode แล้ว!', 'success');
          this.updateSidebarIndicator(true);
          // Request current state from BandThai
          this.channel.send({ type: 'broadcast', event: 'request_state', payload: { joinedAt: this.joinedAt } });
          if (App.currentView === 'livemode') this.renderView();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          App.toast('เชื่อมต่อ Live Mode ไม่ได้', 'error');
          this.active = false;
          this.updateSidebarIndicator(false);
        }
      });
  },

  /* ---------- Song changed handler ---------- */
  onSongChanged(idx) {
    const song = this.playlist[idx];
    if (!song) return;

    // If this is the very first song (no current yet), open immediately
    if (this.currentIdx === -1) {
      this.currentIdx = idx;
      const nowEl = document.getElementById('live-now-playing');
      if (nowEl) nowEl.textContent = song.name;
      this.openMatchingSong(song.name);
      this.updateActiveView();
      return;
    }

    // Store as pending — user must confirm before switching
    this.pendingSong = { idx, name: song.name };
    this.showSongConfirmation(song.name);
    this.updateActiveView();
  },

  /* ---------- Show confirmation banner ---------- */
  showSongConfirmation(songName) {
    // Remove existing banner if any
    this.hideSongConfirmation();

    const banner = document.createElement('div');
    banner.id = 'live-song-confirm';
    banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:10000;background:linear-gradient(135deg,#1a237e,#283593);color:#fff;padding:16px 20px;display:flex;align-items:center;gap:12px;box-shadow:0 -4px 20px rgba(0,0,0,0.3);animation:slideUpBanner 0.3s ease;';
    banner.innerHTML = `
      <div style="flex:1;min-width:0;">
        <div style="font-size:0.8rem;opacity:0.8;">⏭ เพลงถัดไป</div>
        <div style="font-size:1.1rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${this.escapeHtml(songName)}</div>
      </div>
      <button onclick="LiveMode.confirmSongChange()" style="background:#4caf50;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:0.95rem;font-weight:600;cursor:pointer;white-space:nowrap;">
        ✅ เปลี่ยนเพลง
      </button>
      <button onclick="LiveMode.dismissSongChange()" style="background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.3);padding:10px 16px;border-radius:8px;font-size:0.95rem;cursor:pointer;white-space:nowrap;">
        ✕
      </button>
    `;
    document.body.appendChild(banner);
  },

  /* ---------- User confirms song change ---------- */
  confirmSongChange() {
    if (!this.pendingSong) return;
    const { idx, name } = this.pendingSong;
    this.currentIdx = idx;
    this.pendingSong = null;
    this.hideSongConfirmation();

    const nowEl = document.getElementById('live-now-playing');
    if (nowEl) nowEl.textContent = name;

    this.openMatchingSong(name);
    this.updateActiveView();
  },

  /* ---------- User dismisses (stays on current sheet) ---------- */
  dismissSongChange() {
    this.pendingSong = null;
    this.hideSongConfirmation();
  },

  /* ---------- Remove confirmation banner ---------- */
  hideSongConfirmation() {
    const existing = document.getElementById('live-song-confirm');
    if (existing) existing.remove();
  },

  /* ---------- Match & open sheet music ---------- */
  openMatchingSong(songName) {
    if (!songName || !Library.songs || Library.songs.length === 0) return;

    const lower = songName.toLowerCase().trim();
    // Exact match first
    let match = Library.songs.find(s => s.name.toLowerCase().trim() === lower);

    // Partial match (library contains or song name contains)
    if (!match) {
      match = Library.songs.find(s =>
        s.name.toLowerCase().trim().includes(lower) ||
        lower.includes(s.name.toLowerCase().trim())
      );
    }

    const statusEl = document.getElementById('live-match-status');

    if (match) {
      if (statusEl) {
        statusEl.textContent = '✅ เจอโน้ต: ' + match.name;
        statusEl.style.color = '#4caf50';
      }
      // Auto-open viewer
      Viewer.open(match.name, match.url, []);
    } else {
      if (statusEl) {
        statusEl.textContent = '⚠️ ไม่พบโน้ตสำหรับเพลงนี้';
        statusEl.style.color = '#ff9800';
      }
    }
  },

  /* ---------- Update active view if visible ---------- */
  updateActiveView() {
    if (App.currentView !== 'livemode' || !this.active) return;
    const area = document.getElementById('content-area');
    if (area) area.innerHTML = this.renderActiveView();
  },

  /* ---------- Disconnect ---------- */
  disconnect() {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    this.active = false;
    this.playlist = [];
    this.currentIdx = -1;
    this.pendingSong = null;
    this.verifiedEmail = false;
    this.hideSongConfirmation();
    this.updateSidebarIndicator(false);
    App.toast('ตัดการเชื่อมต่อ Live Mode แล้ว', 'info');
    if (App.currentView === 'livemode') this.renderView();
  },

  /* ---------- Sidebar indicator ---------- */
  updateSidebarIndicator(active) {
    const badge = document.getElementById('live-badge');
    if (badge) {
      badge.style.display = active ? '' : 'none';
      badge.textContent = active ? '●' : '';
      badge.style.color = '#f44336';
    }
  },

  /* ---------- Helpers ---------- */
  escapeHtml(s) {
    if (!s) return '';
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  },
  escapeAttr(s) {
    if (!s) return '';
    return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
};

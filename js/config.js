/* ============================================
   Note Chord SoulCiety — Configuration
   ============================================ */

const CONFIG = {
  // ===== API Base URL =====
  // Empty string = same domain (Vercel)
  API_BASE_URL: '',

  // ===== Admin Email =====
  ADMIN_EMAIL: 'krumum.piano@gmail.com',

  // ===== App Info =====
  APP_NAME: 'Note Chord SoulCiety',
  APP_VERSION: '2.0.0',

  // ===== Packages =====
  PACKAGES: {
    free:   { label: 'Free',   color: '#8b949e', icon: '🎵' },
    silver: { label: 'Silver', color: '#a8b2c1', icon: '🥈' },
    gold:   { label: 'Gold',   color: '#f0c75e', icon: '🥇' }
  },

  // ===== UI Settings =====
  GRID_MIN_WIDTH: 160,
  RECENT_MAX: 50,
  SEARCH_DEBOUNCE_MS: 200,
  TOAST_DURATION_MS: 3000
};

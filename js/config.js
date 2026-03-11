/* ============================================
   Note Chord SoulCiety — Configuration
   ============================================ */

const CONFIG = {
  // ===== GAS Web App URL =====
  // วิธีได้ URL: Apps Script > Deploy > New deployment > Web app > Copy URL
  // ใส่ URL ที่ได้จากการ deploy ที่นี่:
  GAS_URL: 'https://script.google.com/macros/s/AKfycbyCfXv1Y3RMhHXTrMlXNesfZh72QtvNYlKSgVnEI8Pn5o6zmEg8zCycQ6qXZ3svajqasg/exec',

  // ===== Admin Email =====
  ADMIN_EMAIL: 'krumum.piano@gmail.com',

  // ===== App Info =====
  APP_NAME: 'Note Chord SoulCiety',
  APP_VERSION: '1.0.0',

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

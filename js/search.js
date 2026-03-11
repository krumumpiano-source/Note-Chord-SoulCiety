/* ============================================
   Note Chord SoulCiety — Search Module
   Real-time search with debounce
   ============================================ */

const Search = {
  query: '',
  debounceTimer: null,

  init() {
    const input = document.getElementById('search-input');
    if (!input) return;

    input.addEventListener('input', (e) => {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.query = e.target.value.trim();
        Library.applyFilters();
        Library.render();
      }, CONFIG.SEARCH_DEBOUNCE_MS);
    });

    // Clear on Escape
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        input.value = '';
        this.query = '';
        Library.applyFilters();
        Library.render();
        input.blur();
      }
    });
  },

  clear() {
    this.query = '';
    const input = document.getElementById('search-input');
    if (input) input.value = '';
  }
};

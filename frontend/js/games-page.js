import { initTheme } from './storage.js';
import { initLayout } from './layout.js';
import { initScrollReveal } from './ui.js';
import { GAMES, getGameCardHTML, attachGameCardListeners, bindGameIconFallbacks, isGameEnabled } from './games.js';

function renderCatalog(filter = '') {
  const grid = document.querySelector('[data-games-grid]');
  const emptyState = document.querySelector('[data-empty-state]');
  if (!grid) return;

  const query = filter.trim().toLowerCase();
  const filtered = GAMES.filter(game =>
    isGameEnabled(game.id) &&
    (!query ||
      game.name.toLowerCase().includes(query) ||
      game.shortName.toLowerCase().includes(query) ||
      game.description.toLowerCase().includes(query) ||
      game.features.some(f => f.toLowerCase().includes(query)))
  );

  grid.innerHTML = filtered
    .map((game, index) => getGameCardHTML(game, index))
    .join('');

  if (emptyState) emptyState.hidden = filtered.length > 0;
  if (filtered.length === 0) grid.innerHTML = '';

  attachGameCardListeners(grid);
  bindGameIconFallbacks(grid);
  requestAnimationFrame(() => {
    grid.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
  });
}

function initSearch() {
  const searchInput = document.querySelector('#game-search');
  if (!searchInput) return;

  searchInput.addEventListener('input', () => {
    renderCatalog(searchInput.value);
  });
}

function initCatalogPage() {
  initTheme();
  initLayout();
  initScrollReveal();
  initSearch();
  renderCatalog();
  console.log('Games catalog page initialized successfully');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCatalogPage);
} else {
  initCatalogPage();
}

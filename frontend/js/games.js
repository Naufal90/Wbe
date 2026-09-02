import { storage, readJson, writeJson } from './storage.js';

const GAME_OVERRIDES_KEY = 'topup_game_overrides';

export function isGameEnabled(gameId) {
  const overrides = readJson(GAME_OVERRIDES_KEY, {});
  return !overrides[gameId]?.disabled;
}

export function setGameEnabled(gameId, enabled) {
  const overrides = readJson(GAME_OVERRIDES_KEY, {});
  if (enabled) {
    delete overrides[gameId]?.disabled;
    if (overrides[gameId] && Object.keys(overrides[gameId]).length === 0) {
      delete overrides[gameId];
    }
  } else {
    overrides[gameId] = { ...(overrides[gameId] || {}), disabled: true };
  }
  return writeJson(GAME_OVERRIDES_KEY, overrides);
}

export const GAMES = [
  {
    id: 'mobile_legends',
    name: 'Mobile Legends',
    shortName: 'MLBB',
    icon: 'ml-icon.png',
    color: '#f97316',
    gradient: 'linear-gradient(135deg, #f97316, #ea580c)',
    description: 'Top up Diamond MLBB dengan cepat dan aman. Proses instan ke akun Anda.',
    features: ['Diamond', 'Weekly Pass', 'Starlight'],
    requiredFields: ['userId', 'zoneId'],
    popular: true,
  },
  {
    id: 'free_fire',
    name: 'Free Fire',
    shortName: 'FF',
    icon: 'ff-icon.jpg',
    color: '#dc143c',
    gradient: 'linear-gradient(135deg, #dc143c, #8b0000)',
    description: 'Beli Diamond Free Fire termurah. Proses otomatis 24 jam non-stop.',
    features: ['Diamond', 'Member Weekly', 'Elite Pass'],
    requiredFields: ['playerId'],
    popular: true,
  },
];

let gamesContainer = null;
let particleCanvas = null;
let particleCtx = null;
let particles = [];
let animationId = null;

export function initGames() {
  gamesContainer = document.querySelector('[data-games-container]');
  if (gamesContainer) {
    renderGames();
  }
  initParticleBackground();
}

export function renderGames(selectedGameId = null) {
  if (!gamesContainer) return;

  const recentGames = storage.getRecentGames();
  const sortedGames = [...GAMES]
    .filter(g => isGameEnabled(g.id))
    .sort((a, b) => {
    const aRecent = recentGames.findIndex(g => g.id === a.id);
    const bRecent = recentGames.findIndex(g => g.id === b.id);
    if (aRecent !== -1 && bRecent !== -1) return aRecent - bRecent;
    if (aRecent !== -1) return -1;
    if (bRecent !== -1) return 1;
    return 0;
  });

  gamesContainer.innerHTML = sortedGames
    .map((game, index) => getGameCardHTML(game, index))
    .join('');

  attachGameCardListeners(gamesContainer);
  bindGameIconFallbacks(gamesContainer);
  requestAnimationFrame(() => {
    gamesContainer.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
  });
}

export function getGameCardHTML(game, index = 0) {
  return `
    <article class="card card-interactive game-card reveal" style="animation-delay: ${index * 100}ms" data-game-id="${game.id}" tabindex="0" role="button" aria-label="${game.name}">
      <div class="game-card-icon" style="border-color: ${game.color}40;">
        <img src="/assets/images/${game.icon}" alt="${game.name}" loading="lazy" data-icon-fallback>
        <div style="display:none; width:60px; height:60px; background:${game.gradient}; border-radius:var(--radius-lg); align-items:center; justify-content:center; color:white; font-weight:700; font-size:1.5rem;">${game.shortName}</div>
      </div>
      <h3 class="game-card-title">${game.name}</h3>
      <p class="game-card-desc">${game.description}</p>
      <div class="game-card-features">
        ${game.features.map(f => `<span class="game-card-feature">${f}</span>`).join('')}
      </div>
      <button class="btn btn-primary btn-lg game-card-btn" data-action="select-game">
        <span>Pilih Game</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
      </button>
    </article>
  `;
}

export function bindGameIconFallbacks(container) {
  container.querySelectorAll('img[data-icon-fallback]').forEach(img => {
    img.addEventListener('error', () => {
      img.style.display = 'none';
      const fallback = img.nextElementSibling;
      if (fallback) fallback.style.display = 'flex';
    }, { once: true });
  });
}

export function attachGameCardListeners(container) {
  container.querySelectorAll('[data-game-id]').forEach(card => {
    const gameId = card.dataset.gameId;
    const btn = card.querySelector('[data-action="select-game"]');

    const handleSelect = () => selectGame(gameId);

    btn?.addEventListener('click', (e) => {
      e.stopPropagation();
      handleSelect();
    });

    card.addEventListener('click', handleSelect);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSelect();
      }
    });
  });
}

export function selectGame(gameId) {
  const game = GAMES.find(g => g.id === gameId);
  if (!game) return;
  storage.setSelectedGame({ id: gameId, timestamp: Date.now() });
  storage.addRecentGame(game);
  window.location.href = `/topup?game=${gameId}`;
}

export function getGameById(gameId) {
  return GAMES.find(g => g.id === gameId);
}

export function getAllGames() {
  return GAMES;
}

function initParticleBackground() {
  const heroSection = document.querySelector('.hero');
  if (!heroSection) return;

  particleCanvas = document.createElement('canvas');
  particleCanvas.className = 'particle-canvas';
  particleCanvas.setAttribute('aria-hidden', 'true');
  heroSection.appendChild(particleCanvas);

  particleCtx = particleCanvas.getContext('2d');

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    particleCanvas.style.display = 'none';
    return;
  }

  resizeCanvas();
  createParticles();
  animateParticles();

  window.addEventListener('resize', debounce(resizeCanvas, 250));
}

function resizeCanvas() {
  if (!particleCanvas) return;
  const rect = particleCanvas.parentElement.getBoundingClientRect();
  particleCanvas.width = rect.width * window.devicePixelRatio;
  particleCanvas.height = rect.height * window.devicePixelRatio;
  particleCanvas.style.width = `${rect.width}px`;
  particleCanvas.style.height = `${rect.height}px`;
  particleCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
}

function createParticles() {
  particles = [];
  const count = Math.min(30, Math.floor((window.innerWidth * window.innerHeight) / 15000));
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      radius: Math.random() * 2 + 0.5,
      speedX: (Math.random() - 0.5) * 0.3,
      speedY: (Math.random() - 0.5) * 0.3,
      opacity: Math.random() * 0.3 + 0.1,
      color: Math.random() > 0.5 ? '#dc143c' : '#c71585',
    });
  }
}

function animateParticles() {
  if (!particleCtx || !particleCanvas) return;

  particleCtx.clearRect(0, 0, particleCanvas.width / window.devicePixelRatio, particleCanvas.height / window.devicePixelRatio);

  particles.forEach(p => {
    p.x += p.speedX;
    p.y += p.speedY;

    if (p.x < 0) p.x = window.innerWidth;
    if (p.x > window.innerWidth) p.x = 0;
    if (p.y < 0) p.y = window.innerHeight;
    if (p.y > window.innerHeight) p.y = 0;

    particleCtx.beginPath();
    particleCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    particleCtx.fillStyle = p.color;
    particleCtx.globalAlpha = p.opacity;
    particleCtx.fill();
    particleCtx.globalAlpha = 1;
  });

  animationId = requestAnimationFrame(animateParticles);
}

function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

export function destroyParticles() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  if (particleCanvas) {
    particleCanvas.remove();
    particleCanvas = null;
    particleCtx = null;
  }
}

export function getGameIcon(gameId) {
  const game = GAMES.find(g => g.id === gameId);
  return game ? `/assets/images/${game.icon}` : null;
}

export function getGameGradient(gameId) {
  const game = GAMES.find(g => g.id === gameId);
  return game ? game.gradient : 'linear-gradient(135deg, var(--color-scarlet), var(--color-crimson))';
}
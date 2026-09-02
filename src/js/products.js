import { api } from './api.js';
import { readJson, writeJson } from './storage.js';
import { formatCurrency } from './ui.js';

const PRODUCT_OVERRIDES_KEY = 'topup_product_overrides';
const CUSTOM_PRODUCTS_KEY = 'topup_custom_products';

let productsCache = null;
let baseCache = null;
let carouselInstance = null;

export async function loadProducts() {
  try {
    const games = await api.get('/games');
    baseCache = {};
    for (const game of games) {
      baseCache[game.id] = (game.products || []).map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        originalPrice: null,
        game: p.game_id,
        popular: p.badge === 'Popular',
        description: p.name,
      }));
    }
  } catch (error) {
    console.error('Error loading products from API:', error);
    try {
      const base = (window.APP_CONFIG?.API_BASE || '').replace('/api', '');
      const response = await fetch(base + '/data/products.json');
      if (!response.ok) throw new Error('Failed to load products');
      baseCache = await response.json();
    } catch {
      baseCache = getFallbackProducts();
    }
  }
  productsCache = mergeProductData(baseCache);
  return productsCache;
}

function getProductOverridesMap() {
  const overrides = readJson(PRODUCT_OVERRIDES_KEY, {});
  return typeof overrides === 'object' && overrides !== null ? overrides : {};
}

function getCustomProducts() {
  const custom = readJson(CUSTOM_PRODUCTS_KEY, []);
  return Array.isArray(custom) ? custom : [];
}

function mergeProductData(base) {
  const overrides = getProductOverridesMap();
  const merged = {};

  for (const [gameId, products] of Object.entries(base)) {
    merged[gameId] = products
      .filter(p => !overrides[p.id]?.deleted)
      .map(p => ({ ...p, ...(overrides[p.id] || {}) }));
  }

  for (const product of getCustomProducts()) {
    if (overrides[product.id]?.deleted) continue;
    const item = { ...product, ...(overrides[product.id] || {}) };
    (merged[item.game] = merged[item.game] || []).push(item);
  }

  return merged;
}

function rebuildProductsCache() {
  productsCache = mergeProductData(baseCache ?? getFallbackProducts());
}

export function saveProductOverride(productId, patch) {
  const overrides = getProductOverridesMap();
  overrides[productId] = { ...(overrides[productId] || {}), ...patch };
  if (!writeJson(PRODUCT_OVERRIDES_KEY, overrides)) {
    throw new Error('Gagal menyimpan perubahan produk.');
  }
  rebuildProductsCache();
  return productId;
}

export function resetProductOverride(productId) {
  const overrides = getProductOverridesMap();
  delete overrides[productId];
  writeJson(PRODUCT_OVERRIDES_KEY, overrides);
  rebuildProductsCache();
}

export function addCustomProduct({ game, name, price, originalPrice = null, popular = false }) {
  const custom = getCustomProducts();
  const product = {
    id: `cus_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    game,
    name: name.trim(),
    price: Math.round(price),
    originalPrice: originalPrice ? Math.round(originalPrice) : null,
    popular,
    description: name.trim(),
    custom: true,
  };
  custom.push(product);
  if (!writeJson(CUSTOM_PRODUCTS_KEY, custom)) {
    throw new Error('Gagal menyimpan produk baru.');
  }
  rebuildProductsCache();
  return product;
}

export function getAllProductsAdmin() {
  if (!productsCache) rebuildProductsCache();
  return Object.entries(productsCache).flatMap(([gameId, items]) =>
    items.map(p => ({ ...p, game: p.game || gameId }))
  );
}

function getFallbackProducts() {
  return {
    mobile_legends: [
      { id: 'ml_86', name: '86 Diamonds', price: 20000, originalPrice: 22000, game: 'mobile_legends', popular: true },
      { id: 'ml_172', name: '172 Diamonds', price: 38000, originalPrice: 42000, game: 'mobile_legends', popular: true },
      { id: 'ml_257', name: '257 Diamonds', price: 55000, originalPrice: 60000, game: 'mobile_legends', popular: true },
      { id: 'ml_344', name: '344 Diamonds', price: 72000, originalPrice: 78000, game: 'mobile_legends' },
      { id: 'ml_429', name: '429 Diamonds', price: 89000, originalPrice: 96000, game: 'mobile_legends' },
      { id: 'ml_514', name: '514 Diamonds', price: 105000, originalPrice: 112000, game: 'mobile_legends' },
      { id: 'ml_weekly', name: 'Weekly Diamond Pass', price: 45000, originalPrice: 50000, game: 'mobile_legends', popular: true },
    ],
    free_fire: [
      { id: 'ff_100', name: '100 Diamonds', price: 15000, originalPrice: 17000, game: 'free_fire', popular: true },
      { id: 'ff_310', name: '310 Diamonds', price: 42000, originalPrice: 46000, game: 'free_fire', popular: true },
      { id: 'ff_520', name: '520 Diamonds', price: 68000, originalPrice: 74000, game: 'free_fire', popular: true },
      { id: 'ff_1060', name: '1060 Diamonds', price: 135000, originalPrice: 145000, game: 'free_fire' },
      { id: 'ff_2180', name: '2180 Diamonds', price: 270000, originalPrice: 290000, game: 'free_fire' },
    ],
  };
}

export function getProductsByGame(gameId) {
  if (!productsCache) return [];
  return (productsCache[gameId] || []).filter(p => !p.disabled);
}

export function getPopularProducts(limit = 8) {
  if (!productsCache) return [];
  const allProducts = Object.values(productsCache).flat();
  return allProducts
    .filter(p => p.popular && !p.disabled)
    .slice(0, limit);
}

export function getProductById(productId) {
  if (!productsCache) return null;
  const allProducts = Object.values(productsCache).flat();
  return allProducts.find(p => p.id === productId && !p.disabled) || null;
}

export function initProductCarousel() {
  const track = document.querySelector('[data-product-carousel]');
  if (!track) return;

  const popularProducts = getPopularProducts(8);
  if (popularProducts.length === 0) {
    track.innerHTML = '<p class="text-center" style="color: var(--color-text-muted); padding: 2rem;">Produk populer akan segera hadir</p>';
    return;
  }

  track.innerHTML = popularProducts.map((product) => `
    <div class="carousel-slide">
      <article class="card product-card hover-lift" data-product-id="${product.id}">
        <div class="product-card-image">
          <div style="width: 80px; height: 80px; background: ${getGameGradient(product.game)}; border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 1.5rem;">
            ${getGameShortName(product.game)}
          </div>
        </div>
        ${product.popular ? '<span class="badge badge-hot" style="margin-bottom: 0.5rem;">Populer</span>' : ''}
        <h4 class="product-card-title">${product.name}</h4>
        <div class="product-card-price">
          ${formatCurrency(product.price)}
          ${product.originalPrice && product.originalPrice > product.price ? `
            <span class="product-card-original-price">${formatCurrency(product.originalPrice)}</span>
          ` : ''}
        </div>
        <button class="btn btn-primary btn-sm" style="width: 100%;" data-action="select-product">
          Pilih
        </button>
      </article>
    </div>
  `).join('');

  initCarouselControls(track);
  initProductSelection(track);
}

function initProductSelection(track) {
  track.querySelectorAll('[data-product-id]').forEach(card => {
    card.querySelector('[data-action="select-product"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const productId = card.dataset.productId;
      const product = getPopularProducts(8).find(p => p.id === productId) || getProductById(productId);
      if (!product) return;
      window.location.href = `/topup?game=${product.game}&product=${productId}`;
    });
  });
}

function initCarouselControls(track) {
  const container = track.closest('[data-carousel-container]');
  if (!container) return;

  const prevBtn = container.querySelector('[data-carousel-prev]');
  const nextBtn = container.querySelector('[data-carousel-next]');
  const dotsContainer = container.querySelector('[data-carousel-dots]');

  const slides = track.querySelectorAll('.carousel-slide');
  const slideWidth = slides[0]?.getBoundingClientRect().width || 280;
  const gap = 16;
  let currentIndex = 0;
  const maxIndex = Math.max(0, slides.length - getVisibleSlides());

  function getVisibleSlides() {
    const containerWidth = container.querySelector('.carousel')?.clientWidth || container.clientWidth;
    return Math.max(1, Math.floor(containerWidth / (slideWidth + gap)));
  }

  function updatePosition() {
    const offset = currentIndex * (slideWidth + gap);
    track.style.transform = `translateX(-${offset}px)`;
    updateDots();
    updateButtons();
  }

  function updateDots() {
    if (!dotsContainer) return;
    const totalDots = Math.max(1, slides.length - getVisibleSlides() + 1);
    dotsContainer.innerHTML = Array.from({ length: totalDots }, (_, i) => `
      <button class="carousel-dot ${i === currentIndex ? 'active' : ''}" data-dot-index="${i}" aria-label="Slide ${i + 1}"></button>
    `).join('');

    dotsContainer.querySelectorAll('.carousel-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        currentIndex = parseInt(dot.dataset.dotIndex);
        updatePosition();
      });
    });
  }

  function updateButtons() {
    if (prevBtn) prevBtn.disabled = currentIndex === 0;
    if (nextBtn) nextBtn.disabled = currentIndex >= maxIndex;
  }

  function next() {
    if (currentIndex < maxIndex) {
      currentIndex++;
      updatePosition();
    }
  }

  function prev() {
    if (currentIndex > 0) {
      currentIndex--;
      updatePosition();
    }
  }

  prevBtn?.addEventListener('click', prev);
  nextBtn?.addEventListener('click', next);

  let touchStartX = 0;
  track.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  track.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) next();
      else prev();
    }
  }, { passive: true });

  let autoRotateInterval = null;
  function startAutoRotate() {
    stopAutoRotate();
    autoRotateInterval = setInterval(() => {
      if (currentIndex >= maxIndex) currentIndex = -1;
      next();
    }, 5000);
  }

  function stopAutoRotate() {
    if (autoRotateInterval) {
      clearInterval(autoRotateInterval);
      autoRotateInterval = null;
    }
  }

  container.addEventListener('mouseenter', stopAutoRotate);
  container.addEventListener('mouseleave', startAutoRotate);
  container.addEventListener('touchstart', stopAutoRotate, { passive: true });
  container.addEventListener('touchend', startAutoRotate, { passive: true });

  window.addEventListener('resize', debounce(() => {
    const newMaxIndex = Math.max(0, slides.length - getVisibleSlides());
    if (currentIndex > newMaxIndex) currentIndex = newMaxIndex;
    updatePosition();
  }, 250));

  updatePosition();
  startAutoRotate();

  carouselInstance = { next, prev, destroy: () => stopAutoRotate() };
}

function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

function getGameShortName(gameId) {
  const names = { mobile_legends: 'ML', free_fire: 'FF' };
  return names[gameId] || gameId.toUpperCase().slice(0, 2);
}

function getGameGradient(gameId) {
  const gradients = {
    mobile_legends: 'linear-gradient(135deg, #f97316, #ea580c)',
    free_fire: 'linear-gradient(135deg, #dc143c, #8b0000)',
  };
  return gradients[gameId] || 'linear-gradient(135deg, var(--color-scarlet), var(--color-crimson))';
}

export function destroyCarousel() {
  if (carouselInstance) {
    carouselInstance.destroy();
    carouselInstance = null;
  }
}

import { initTheme, storage } from './storage.js';
import { initLayout } from './layout.js';
import { initScrollReveal, showWarning, showError, formatCurrency, showModal } from './ui.js';
import { getGameById, isGameEnabled } from './games.js';
import { loadProducts, getProductsByGame } from './products.js';
import { validatePlayerId, formatPlayerId, formatZoneId } from './validation.js';
import { createOrder } from './orders.js';
import { getCurrentUser } from './auth.js';
import { getWalletBalance, fetchWalletData } from './wallet.js';
import { getTopupProvider } from './topup-providers.js';
import { escapeHtml } from './security.js';

const PAYMENT_METHODS = [
  {
    id: 'wallet',
    name: 'Dompet',
    desc: 'Saldo dompet lokal',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>',
  },
  {
    id: 'qris',
    name: 'QRIS',
    desc: 'Semua e-wallet & mobile banking',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 8h8v8H8z"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6"/></svg>',
  },
  {
    id: 'ewallet',
    name: 'E-Wallet',
    desc: 'DANA, OVO, GoPay, ShopeePay',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>',
  },
  {
    id: 'bank_transfer',
    name: 'Bank Transfer',
    desc: 'BCA, BNI, BRI, Mandiri',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
  },
  {
    id: 'virtual_account',
    name: 'Virtual Account',
    desc: 'Transfer otomatis 24 jam',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-6h6v6"/><path d="M3 21h18"/></svg>',
  },
];

const FIELD_DEFS = {
  userId: { label: 'User ID', placeholder: 'Contoh: 123456789', inputmode: 'numeric' },
  zoneId: { label: 'Zone ID', placeholder: 'Contoh: 1234', inputmode: 'numeric' },
  playerId: { label: 'Player ID', placeholder: 'Contoh: 123456789', inputmode: 'numeric' },
};

const state = {
  game: null,
  products: [],
  productId: null,
  paymentMethodId: null,
  nickname: null,
};

function getIdFieldValues() {
  const fields = {};
  document.querySelectorAll('[data-id-field]').forEach(input => {
    fields[input.dataset.idField] = input.value.trim();
  });
  return fields;
}

function renderGameHeader(game) {
  document.title = `Top Up ${game.name} - Mama Scarlet`;

  const name = document.querySelector('[data-game-name]');
  const title = document.querySelector('[data-game-title]');
  const icon = document.querySelector('[data-game-icon]');
  const iconWrap = document.querySelector('[data-game-icon-wrap]');
  const idHint = document.querySelector('[data-id-hint]');

  if (name) name.textContent = game.name;
  if (title) title.textContent = game.name;
  if (icon && iconWrap) {
    icon.style.display = '';
    icon.onerror = () => { icon.style.display = 'none'; };
    icon.alt = game.name;
    icon.src = `/assets/images/${game.icon}`;
    iconWrap.style.borderColor = `${game.color}40`;
  }
  if (idHint) {
    const fieldLabels = game.requiredFields.map(f => FIELD_DEFS[f]?.label || f);
    idHint.textContent = `Pastikan ${fieldLabels.join(' dan ')} sesuai dengan akun game kamu.`;
  }
}

function renderIdFields(game) {
  const container = document.querySelector('[data-id-fields]');
  if (!container) return;

  const cached = storage.getPlayerIdCache(game.id) || {};

  container.innerHTML = `
    ${game.requiredFields.map(fieldKey => {
      const def = FIELD_DEFS[fieldKey];
      if (!def) return '';
      const cachedValue = fieldKey === 'userId' ? (cached.playerId ?? '') : (cached[fieldKey] ?? '');
      return `
        <div class="id-field-group">
          <label class="label" for="field-${fieldKey}">${def.label}</label>
          <input
            type="text"
            id="field-${fieldKey}"
            class="input"
            data-id-field="${fieldKey}"
            placeholder="${def.placeholder}"
            inputmode="${def.inputmode}"
            autocomplete="off"
            value="${cachedValue}"
          >
          <p class="field-error" data-error-for="${fieldKey}" hidden></p>
        </div>
      `;
    }).join('')}
    <div class="id-check">
      <button type="button" class="btn btn-secondary btn-sm" data-action="check-id">Cek ID</button>
      <span class="id-check-result" data-id-check-result hidden></span>
    </div>
  `;

  container.querySelectorAll('[data-id-field]').forEach(input => {
    input.addEventListener('input', () => {
      maskIdInput(game, input);
      clearFieldError(input.dataset.idField);
      resetIdCheck();
      updateSummary();
    });
    input.addEventListener('blur', () => {
      validateIdFields({ silent: false });
    });
  });

  document.querySelector('[data-action="check-id"]')
    ?.addEventListener('click', handleCheckId);
}

function resetIdCheck() {
  state.nickname = null;
  const resultEl = document.querySelector('[data-id-check-result]');
  if (resultEl) {
    resultEl.hidden = true;
    resultEl.innerHTML = '';
  }
}

async function handleCheckId() {
  if (!validateIdFields({ silent: false })) return;

  const values = getIdFieldValues();
  const playerId = values.userId ?? values.playerId;
  const btn = document.querySelector('[data-action="check-id"]');
  const resultEl = document.querySelector('[data-id-check-result]');

  btn.disabled = true;
  const originalLabel = btn.textContent;
  btn.textContent = 'Memeriksa...';
  resultEl.hidden = true;

  try {
    const provider = getTopupProvider(state.game.id);
    const result = await provider.validatePlayer(playerId, values.zoneId ?? null);

    if (!result.valid) {
      state.nickname = null;
      showError('ID tidak ditemukan. Periksa kembali data akun kamu.', 4000);
      return;
    }

    state.nickname = result.nickname;
    resultEl.innerHTML = `Akun ditemukan: <strong class="id-check-nickname">${escapeHtml(result.nickname)}</strong>`;
    resultEl.hidden = false;
  } catch (err) {
    state.nickname = null;
    showError(err.message || 'Gagal memeriksa ID. Silakan coba lagi.', 4000);
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}

function maskIdInput(game, input) {
  const fieldKey = input.dataset.idField;
  if (fieldKey === 'zoneId') {
    input.value = formatZoneId(input.value);
  } else {
    input.value = formatPlayerId(game.id, input.value);
  }
}

function clearFieldError(fieldKey) {
  const errorEl = document.querySelector(`[data-error-for="${fieldKey}"]`);
  const input = document.querySelector(`[data-id-field="${fieldKey}"]`);
  if (errorEl) {
    errorEl.hidden = true;
    errorEl.textContent = '';
  }
  if (input) input.classList.remove('input-error');
}

function showFieldError(fieldKey, message) {
  const errorEl = document.querySelector(`[data-error-for="${fieldKey}"]`);
  const input = document.querySelector(`[data-id-field="${fieldKey}"]`);
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }
  if (input) input.classList.add('input-error');
}

function validateIdFields({ silent = true } = {}) {
  if (!state.game) return false;
  const values = getIdFieldValues();
  const result = validatePlayerId(state.game.id, values.userId ?? values.playerId, values.zoneId);

  Object.keys(values).forEach(clearFieldError);

  const usesUserId = state.game.requiredFields.includes('zoneId');
  const toDisplayKey = (key) => (usesUserId && key === 'playerId' ? 'userId' : key);

  if (!result.valid && !silent) {
    let firstInvalidField = null;
    Object.entries(result.errors).forEach(([fieldKey, message]) => {
      const displayKey = fieldKey === 'general' ? Object.keys(values)[0] : toDisplayKey(fieldKey);
      showFieldError(displayKey, message);
      if (!firstInvalidField) firstInvalidField = displayKey;
    });
    if (firstInvalidField) {
      document.querySelector(`[data-id-field="${firstInvalidField}"]`)?.focus();
    }
  }

  return result.valid;
}

function getProductCardHTML(product, index) {
  const selected = state.productId === product.id;
  return `
    <button type="button" class="option-card product-option ${selected ? 'selected' : ''}" data-product-id="${product.id}" style="animation-delay: ${index * 40}ms">
      ${product.popular ? '<span class="badge badge-hot option-badge">Populer</span>' : ''}
      <span class="option-name">${product.name}</span>
      <span class="option-price">${formatCurrency(product.price)}</span>
      ${product.originalPrice && product.originalPrice > product.price ? `
        <span class="option-original-price">${formatCurrency(product.originalPrice)}</span>
      ` : ''}
    </button>
  `;
}

function renderProducts() {
  const grid = document.querySelector('[data-products-grid]');
  if (!grid) return;

  grid.innerHTML = state.products
    .map((product, index) => getProductCardHTML(product, index))
    .join('');

  grid.querySelectorAll('[data-product-id]').forEach(card => {
    card.addEventListener('click', () => selectProduct(card.dataset.productId));
  });
}

function selectProduct(productId) {
  state.productId = productId;
  renderProducts();
  updateSummary();
}

function getPaymentCardHTML(method) {
  const selected = state.paymentMethodId === method.id;
  return `
    <button type="button" class="option-card payment-option ${selected ? 'selected' : ''}" data-payment-id="${method.id}">
      <span class="payment-option-icon">${method.icon}</span>
      <span class="option-name">${method.name}</span>
      <span class="option-desc">${method.desc}</span>
    </button>
  `;
}

async function renderPayments() {
  const grid = document.querySelector('[data-payment-grid]');
  if (!grid) return;

  await fetchWalletData();
  const walletBalance = getWalletBalance();
  const methodsWithLiveDesc = PAYMENT_METHODS.map(m =>
    m.id === 'wallet'
      ? { ...m, desc: `Saldo: ${formatCurrency(walletBalance)}` }
      : m
  );

  grid.innerHTML = methodsWithLiveDesc
    .map(method => getPaymentCardHTML(method))
    .join('');

  grid.querySelectorAll('[data-payment-id]').forEach(card => {
    card.addEventListener('click', () => selectPaymentMethod(card.dataset.paymentId));
  });
}

function selectPaymentMethod(methodId) {
  state.paymentMethodId = methodId;
  renderPayments();
  updateSummary();
}

function getAccountSummary() {
  const values = getIdFieldValues();
  if (state.game.requiredFields.includes('zoneId')) {
    const userId = values.userId || '-';
    const zoneId = values.zoneId || '-';
    return `${userId} (${zoneId})`;
  }
  return values.playerId || '-';
}

function updateSummary() {
  const gameEl = document.querySelector('[data-summary-game]');
  const accountEl = document.querySelector('[data-summary-account]');
  const productEl = document.querySelector('[data-summary-product]');
  const paymentEl = document.querySelector('[data-summary-payment]');
  const totalEl = document.querySelector('[data-summary-total]');

  if (gameEl) gameEl.textContent = state.game?.name || '-';

  const hasAnyId = Object.values(getIdFieldValues()).some(v => v);
  if (accountEl) accountEl.textContent = hasAnyId ? getAccountSummary() : '-';

  const product = state.products.find(p => p.id === state.productId);
  if (productEl) productEl.textContent = product ? product.name : '-';
  if (totalEl) totalEl.textContent = product ? formatCurrency(product.price) : 'Rp0';

  const method = PAYMENT_METHODS.find(m => m.id === state.paymentMethodId);
  if (paymentEl) paymentEl.textContent = method ? method.name : '-';
}

function buildReviewContent() {
  const product = state.products.find(p => p.id === state.productId);
  const method = PAYMENT_METHODS.find(m => m.id === state.paymentMethodId);

  return `
    <div class="review-list">
      <div class="summary-row">
        <span class="summary-label">Game</span>
        <span class="summary-value">${state.game.name}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Akun</span>
        <span class="summary-value">${getAccountSummary()}</span>
      </div>
      ${state.nickname ? `
        <div class="summary-row">
          <span class="summary-label">Nickname</span>
          <span class="summary-value">${escapeHtml(state.nickname)}</span>
        </div>
      ` : ''}
      <div class="summary-row">
        <span class="summary-label">Produk</span>
        <span class="summary-value">${product.name}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Pembayaran</span>
        <span class="summary-value">${method.name}</span>
      </div>
      <div class="summary-total-row">
        <span class="summary-label">Total</span>
        <span class="summary-total">${formatCurrency(product.price)}</span>
      </div>
    </div>
  `;
}

async function handleReviewOrder() {
  if (!validateIdFields({ silent: false })) {
    showError('Periksa kembali data akun kamu.', 3000);
    return;
  }

  if (!state.productId) {
    showWarning('Pilih nominal top-up terlebih dahulu.', 3000);
    document.querySelector('[data-products-grid]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  if (!state.paymentMethodId) {
    showWarning('Pilih metode pembayaran terlebih dahulu.', 3000);
    document.querySelector('[data-payment-grid]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const method = PAYMENT_METHODS.find(m => m.id === state.paymentMethodId);
  const product = state.products.find(p => p.id === state.productId);

  if (method.id === 'wallet') {
    await fetchWalletData();
    if (getWalletBalance() < product.price) {
      showError('Saldo dompet tidak cukup. Silakan isi saldo di halaman Profil.', 4500);
      return;
    }
  }

  const modal = showModal(buildReviewContent(), {
    title: 'Konfirmasi Pesanan',
    width: '420px',
    onClose: null,
  });

  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  footer.innerHTML = `
    <button class="btn btn-secondary" data-action="cancel-order">Batal</button>
    <button class="btn btn-primary" data-action="create-order">Buat Pesanan</button>
  `;
  modal.modal.appendChild(footer);

  footer.querySelector('[data-action="cancel-order"]').addEventListener('click', () => modal.close());

  footer.querySelector('[data-action="create-order"]').addEventListener('click', async () => {
    const values = getIdFieldValues();
    const createBtn = footer.querySelector('[data-action="create-order"]');
    createBtn.disabled = true;
    createBtn.textContent = 'Membuat pesanan...';

    try {
      const order = await createOrder({
        game: state.game.id,
        product_id: product.id,
        player_id: values.playerId ?? values.userId,
        zone_id: values.zoneId ?? null,
        payment_method: method.id,
      });

      storage.setPlayerIdCache(state.game.id, values.playerId ?? values.userId, values.zoneId);
      storage.addRecentProduct({
        id: product.id,
        name: product.name,
        price: product.price,
        game: state.game.id,
      });

      modal.close();
      window.location.href = `/order?id=${order.order_number}`;
    } catch (err) {
      showError(err.message || 'Gagal membuat pesanan. Silakan coba lagi.', 4000);
      createBtn.disabled = false;
      createBtn.textContent = 'Buat Pesanan';
    }
  });
}

async function initTopupPage() {
  initTheme();
  initLayout();
  initScrollReveal();

  const params = new URLSearchParams(window.location.search);
  const gameId = params.get('game');
  const game = getGameById(gameId);

  if (!game) {
    window.location.replace('/games');
    return;
  }

  if (!isGameEnabled(game.id)) {
    showWarning('Game sedang tidak tersedia. Silakan pilih game lain.', 4000);
    setTimeout(() => {
      window.location.replace('/games');
    }, 1500);
    return;
  }

  state.game = game;

  renderGameHeader(game);
  renderIdFields(game);
  await renderPayments();

  await loadProducts();
  state.products = getProductsByGame(game.id);
  renderProducts();

  const preselectProductId = params.get('product');
  if (preselectProductId && state.products.some(p => p.id === preselectProductId)) {
    selectProduct(preselectProductId);
  }

  updateSummary();

  document.querySelector('[data-action="review-order"]')
    ?.addEventListener('click', handleReviewOrder);

  console.log(`Top-up page initialized successfully for: ${game.id}`);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTopupPage);
} else {
  initTopupPage();
}

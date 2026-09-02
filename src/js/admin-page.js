import { readJson, writeJson, sessionStorageUtil } from './storage.js';
import { initTheme } from './storage.js';
import { initLayout } from './layout.js';
import { showModal, showSuccess, showError, formatCurrency } from './ui.js';
import { hashPassword } from './auth.js';
import { getAllOrders, updateOrder, formatDate, ORDER_STATUS } from './orders.js';
import {
  loadProducts,
  getAllProductsAdmin,
  saveProductOverride,
  resetProductOverride,
  addCustomProduct,
} from './products.js';
import { GAMES, isGameEnabled, setGameEnabled } from './games.js';
import { addAdminLog, getAdminLogs } from './admin-log.js';
import { escapeHtml, clampNumber, recentTimestamps } from './security.js';

const PASSCODE_KEY = 'topup_admin_passcode_hash';
const ADMIN_SESSION_KEY = 'topup_admin_session';
const ADMIN_LOCKOUT_KEY = 'topup_admin_lockout';

const MAX_ADMIN_ATTEMPTS = 5;
const ADMIN_LOCK_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_SESSION_TTL_MS = 30 * 60 * 1000;
const PRODUCT_NAME_MAX_LENGTH = 60;
const AMOUNT_MIN = 1000;
const AMOUNT_MAX = 100000000;

function getAdminFailures() {
  const entry = readJson(ADMIN_LOCKOUT_KEY, null);
  if (!entry) return [];
  return recentTimestamps(entry.timestamps ?? [], ADMIN_LOCK_WINDOW_MS);
}

function isAdminLocked() {
  return getAdminFailures().length >= MAX_ADMIN_ATTEMPTS;
}

function recordAdminFailure() {
  const timestamps = getAdminFailures();
  timestamps.push(Date.now());
  writeJson(ADMIN_LOCKOUT_KEY, { timestamps });
}

function clearAdminFailures() {
  writeJson(ADMIN_LOCKOUT_KEY, { timestamps: [] });
}

function adminSessionActive() {
  const session = sessionStorageUtil.get(ADMIN_SESSION_KEY, null);
  if (!session || typeof session.ts !== 'number') return false;
  return Date.now() - session.ts < ADMIN_SESSION_TTL_MS;
}

function touchAdminSession() {
  sessionStorageUtil.set(ADMIN_SESSION_KEY, { ts: Date.now() });
}

const TERMINAL_STATUSES = [
  ORDER_STATUS.SUCCESS,
  ORDER_STATUS.FAILED,
  ORDER_STATUS.EXPIRED,
  ORDER_STATUS.CANCELLED,
];

let activeTab = 'dashboard';

/* ===== Gate ===== */

function isAdminLoggedIn() {
  return sessionStorageUtil.get(ADMIN_SESSION_KEY) === true;
}

function renderGate(root) {
  const hasPasscode = Boolean(readJson(PASSCODE_KEY, null));

  root.innerHTML = `
    <form class="card auth-card reveal visible" id="admin-gate" novalidate>
      <h2 class="card-section-title">${hasPasscode ? 'Masuk Admin' : 'Atur Passcode Admin'}</h2>
      <p class="wallet-hint">
        ${hasPasscode
          ? 'Masukkan passcode admin untuk membuka panel.'
          : 'Pertama kali di perangkat ini: buat passcode admin (min. 6 karakter).'}
      </p>
      <div class="id-field-group">
        <label class="label" for="admin-passcode">Passcode</label>
        <input type="password" id="admin-passcode" class="input" autocomplete="current-password" placeholder="Minimal 6 karakter">
      </div>
      <button type="submit" class="btn btn-primary w-full">${hasPasscode ? 'Masuk' : 'Simpan & Masuk'}</button>
      <p class="summary-note">Panel ini lokal/demo — otorisasi admin produksi WAJIB di backend.</p>
    </form>
  `;

  root.querySelector('#admin-gate').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = root.querySelector('#admin-passcode');
    const code = input.value.trim();

    if (code.length < 6) {
      showError('Passcode minimal 6 karakter.', 3000);
      return;
    }

    if (isAdminLocked()) {
      addAdminLog('admin.login_blocked', '-', 'Percobaan saat lockout aktif');
      showError(`Terlalu banyak percobaan gagal. Coba lagi dalam 15 menit.`, 5000);
      return;
    }

    const codeHash = await hashPassword(code);
    const storedHash = readJson(PASSCODE_KEY, null);

    if (!storedHash) {
      writeJson(PASSCODE_KEY, codeHash);
      touchAdminSession();
      addAdminLog('admin.setup', '-', 'Passcode admin pertama dibuat');
      showSuccess('Passcode admin dibuat.', 2500);
      renderApp(root);
      return;
    }

    if (codeHash !== storedHash) {
      recordAdminFailure();
      const remaining = MAX_ADMIN_ATTEMPTS - getAdminFailures().length;
      addAdminLog('admin.login_failed', '-', `Passcode salah (sisa ${Math.max(0, remaining)})`);
      showError(
        remaining > 0
          ? `Passcode salah. Sisa percobaan: ${remaining}.`
          : 'Terlalu banyak percobaan gagal. Coba lagi dalam 15 menit.',
        4500
      );
      input.value = '';
      return;
    }

    clearAdminFailures();
    touchAdminSession();
    addAdminLog('admin.login', '-', 'Berhasil masuk');
    renderApp(root);
  });
}

/* ===== App shell ===== */

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'products', label: 'Produk & Game' },
  { id: 'orders', label: 'Pesanan' },
  { id: 'logs', label: 'Log Aktivitas' },
];

function renderApp(root) {
  touchAdminSession();
  root.innerHTML = `
    <div class="admin-topbar">
      <div class="admin-tabs" role="tablist">
        ${TABS.map(tab => `
          <button type="button" class="admin-tab ${activeTab === tab.id ? 'active' : ''}" data-tab="${tab.id}">${tab.label}</button>
        `).join('')}
      </div>
      <button type="button" class="btn btn-secondary btn-sm" data-action="admin-logout">Keluar Admin</button>
    </div>
    <div data-admin-content></div>
  `;

  root.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      root.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b === btn));
      touchAdminSession();
      renderTab(root.querySelector('[data-admin-content]'));
    });
  });

  root.querySelector('[data-action="admin-logout"]').addEventListener('click', () => {
    sessionStorageUtil.remove(ADMIN_SESSION_KEY);
    addAdminLog('admin.logout', '-', 'Keluar panel');
    showSuccess('Kamu telah keluar dari panel admin.', 2500);
    renderGate(root);
  });

  renderTab(root.querySelector('[data-admin-content]'));
}

function renderTab(container) {
  if (activeTab === 'dashboard') renderDashboard(container);
  else if (activeTab === 'products') renderProductsTab(container);
  else if (activeTab === 'orders') renderOrdersTab(container);
  else renderLogsTab(container);
}

/* ===== Dashboard ===== */

function renderDashboard(container) {
  const orders = getAllOrders();
  const today = new Date().toDateString();

  const stats = {
    total: orders.length,
    today: orders.filter(o => new Date(o.created_at).toDateString() === today).length,
    success: orders.filter(o => o.topup_status === ORDER_STATUS.SUCCESS).length,
    failed: orders.filter(o => TERMINAL_FAILURES(o).length > 0).length,
    revenue: orders
      .filter(o => o.topup_status === ORDER_STATUS.SUCCESS)
      .reduce((sum, o) => sum + (o.price || 0), 0),
    pendingPayment: orders.filter(o =>
      o.payment_status === ORDER_STATUS.WAITING_PAYMENT && o.topup_status === ORDER_STATUS.PENDING).length,
    pendingTopup: orders.filter(o =>
      o.payment_status === ORDER_STATUS.PAID && o.topup_status === ORDER_STATUS.PROCESSING).length,
  };

  container.innerHTML = `
    <div class="admin-stats">
      ${statCard('Total Pesanan', String(stats.total))}
      ${statCard('Pesanan Hari Ini', String(stats.today))}
      ${statCard('Sukses', String(stats.success))}
      ${statCard('Gagal/Batal', String(stats.failed))}
      ${statCard('Menunggu Pembayaran', String(stats.pendingPayment))}
      ${statCard('Top-Up Diproses', String(stats.pendingTopup))}
      ${statCard('Pendapatan (sukses)', formatCurrency(stats.revenue), 'stat-wide')}
    </div>
  `;
}

function TERMINAL_FAILURES(order) {
  return [ORDER_STATUS.FAILED, ORDER_STATUS.EXPIRED, ORDER_STATUS.CANCELLED]
    .filter(s => order.topup_status === s || order.payment_status === s);
}

function statCard(label, value, extraClass = '') {
  return `
    <div class="card stat-card ${extraClass}">
      <span class="stat-value">${value}</span>
      <span class="stat-label">${label}</span>
    </div>
  `;
}

/* ===== Products & Games ===== */

function renderProductsTab(container) {
  const products = getAllProductsAdmin();
  const overrides = readJson('topup_product_overrides', {});

  container.innerHTML = `
    <div class="card profile-card">
      <h3 class="card-section-title">Status Game</h3>
      <div class="game-toggle-list">
        ${GAMES.map(game => `
          <label class="game-toggle-item">
            <input type="checkbox" data-game-toggle="${game.id}" ${isGameEnabled(game.id) ? 'checked' : ''}>
            <span>${game.name}</span>
            <small class="wallet-tx-meta">tampilkan di katalog</small>
          </label>
        `).join('')}
      </div>

      <div class="divider"></div>
      <h3 class="card-section-title">Daftar Produk</h3>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr><th>Produk</th><th>Game</th><th>Harga</th><th>Status</th><th>Aksi</th></tr>
          </thead>
          <tbody>
            ${products.map(p => productRow(p, overrides)).join('')}
          </tbody>
        </table>
      </div>

      <div class="divider"></div>
      <h3 class="card-section-title">Tambah Produk Baru</h3>
      <form id="add-product-form" class="admin-inline-form">
        <select id="new-product-game" class="input">
          ${GAMES.map(g => `<option value="${g.id}">${g.name}</option>`).join('')}
        </select>
        <input type="text" id="new-product-name" class="input" placeholder="Nama produk (mis. 70 Diamonds)" maxlength="60">
        <input type="number" id="new-product-price" class="input" placeholder="Harga" min="1000" step="500">
        <button type="submit" class="btn btn-primary btn-sm">Tambah</button>
      </form>
    </div>
  `;

  container.querySelectorAll('[data-game-toggle]').forEach(cb => {
    cb.addEventListener('change', () => {
      const gameId = cb.dataset.gameToggle;
      setGameEnabled(gameId, cb.checked);
      addAdminLog('game.toggle', gameId, cb.checked ? 'diaktifkan' : 'dinonaktifkan');
      showSuccess(`Game ${cb.checked ? 'diaktifkan' : 'dinonaktifkan'}.`, 2500);
    });
  });

  container.querySelectorAll('[data-action="edit-product"]').forEach(btn => {
    btn.addEventListener('click', () => openEditProductModal(container, btn.dataset.editProduct));
  });

  container.querySelectorAll('[data-action="reset-product"]').forEach(btn => {
    btn.addEventListener('click', () => {
      resetProductOverride(btn.dataset.resetProduct);
      addAdminLog('product.reset', btn.dataset.resetProduct, 'override dihapus');
      showSuccess('Produk dikembalikan ke nilai awal.', 2500);
      renderTab(container);
    });
  });

  container.querySelector('#add-product-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const gameId = container.querySelector('#new-product-game').value;
    const nameInput = container.querySelector('#new-product-name');
    const name = nameInput.value.trim();
    const price = clampNumber(container.querySelector('#new-product-price').value, { min: AMOUNT_MIN, max: AMOUNT_MAX });

    if (!name || name.length > PRODUCT_NAME_MAX_LENGTH) {
      showError(`Nama produk wajib diisi (maks. ${PRODUCT_NAME_MAX_LENGTH} karakter).`, 3500);
      return;
    }
    if (price === null) {
      showError(`Harga harus antara ${formatCurrency(AMOUNT_MIN)} - ${formatCurrency(AMOUNT_MAX)}.`, 3500);
      return;
    }

    try {
      const created = addCustomProduct({ game: gameId, name, price });
      addAdminLog('product.create', created.id, `${name} (${formatCurrency(price)})`);
      showSuccess('Produk baru ditambahkan.', 2500);
      renderTab(container);
    } catch (err) {
      showError(err.message, 4000);
    }
  });
}

function productRow(product, overrides) {
  const gameLabel = GAMES.find(g => g.id === product.game)?.name || product.game;
  const badges = [];
  if (product.disabled) badges.push('<span class="badge badge-error">Nonaktif</span>');
  if (product.custom) badges.push('<span class="badge badge-primary">Kustom</span>');
  if (overrides[product.id]) badges.push('<span class="badge badge-warning">Diedit</span>');

  return `
    <tr>
      <td>${escapeHtml(product.name)}<br><small class="wallet-tx-meta">${escapeHtml(product.id)}</small></td>
      <td>${gameLabel}</td>
      <td>${formatCurrency(product.price)}</td>
      <td>${badges.join(' ') || '<span class="badge badge-success">Aktif</span>'}</td>
      <td class="admin-actions-cell">
        <button type="button" class="btn btn-secondary btn-sm" data-action="edit-product" data-edit-product="${product.id}">Edit</button>
        ${overrides[product.id] ? `<button type="button" class="btn btn-ghost btn-sm" data-action="reset-product" data-reset-product="${product.id}">Reset</button>` : ''}
      </td>
    </tr>
  `;
}

function openEditProductModal(container, productId) {
  const product = getAllProductsAdmin().find(p => p.id === productId);
  if (!product) return;

  const content = `
    <div class="id-field-group">
      <label class="label" for="edit-price">Harga (Rp)</label>
      <input type="number" id="edit-price" class="input" min="1000" step="500" value="${product.price}">
    </div>
    <div class="id-field-group">
      <label class="label" for="edit-original-price">Harga Coret (opsional)</label>
      <input type="number" id="edit-original-price" class="input" min="0" step="500" value="${product.originalPrice ?? ''}">
    </div>
    <label class="auth-terms">
      <input type="checkbox" id="edit-popular" ${product.popular ? 'checked' : ''}>
      <span>Tandai sebagai Populer</span>
    </label>
    <label class="auth-terms">
      <input type="checkbox" id="edit-disabled" ${product.disabled ? 'checked' : ''}>
      <span>Nonaktifkan produk (sembunyikan dari katalog)</span>
    </label>
  `;

  const modal = showModal(content, { title: `Edit: ${escapeHtml(product.name)}`, width: '380px' });

  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  footer.innerHTML = `
    <button type="button" class="btn btn-secondary" data-action="cancel-edit">Batal</button>
    <button type="button" class="btn btn-primary" data-action="save-edit">Simpan</button>
  `;
  modal.modal.appendChild(footer);

  footer.querySelector('[data-action="cancel-edit"]').addEventListener('click', () => modal.close());

  footer.querySelector('[data-action="save-edit"]').addEventListener('click', () => {
    const price = clampNumber(modal.modal.querySelector('#edit-price').value, { min: AMOUNT_MIN, max: AMOUNT_MAX });
    const originalRaw = modal.modal.querySelector('#edit-original-price').value;
    const originalPrice = originalRaw === '' ? null : clampNumber(originalRaw, { min: AMOUNT_MIN, max: AMOUNT_MAX });
    const popular = modal.modal.querySelector('#edit-popular').checked;
    const disabled = modal.modal.querySelector('#edit-disabled').checked;

    if (price === null) {
      showError(`Harga harus antara ${formatCurrency(AMOUNT_MIN)} - ${formatCurrency(AMOUNT_MAX)}.`, 3500);
      return;
    }
    if (originalPrice === null && originalRaw !== '') {
      showError('Harga coret tidak valid.', 3000);
      return;
    }

    try {
      saveProductOverride(productId, { price, originalPrice, popular, disabled });
      addAdminLog('product.update', productId, `harga=${price}, populer=${popular}, nonaktif=${disabled}`);
      modal.close();
      showSuccess('Produk berhasil diperbarui.', 2500);
      renderTab(container);
    } catch (err) {
      showError(err.message, 4000);
    }
  });
}

/* ===== Orders ===== */

let orderFilter = 'ALL';

function renderOrdersTab(container) {
  const orders = getAllOrders();
  const filtered = orderFilter === 'ALL'
    ? orders
    : orders.filter(o => filterMatch(o));

  container.innerHTML = `
    <div class="card profile-card">
      <div class="admin-orders-filter">
        <label class="label" for="order-filter">Filter status</label>
        <select id="order-filter" class="input" style="max-width:240px;">
          <option value="ALL" ${orderFilter === 'ALL' ? 'selected' : ''}>Semua</option>
          <option value="WAITING_PAYMENT" ${orderFilter === 'WAITING_PAYMENT' ? 'selected' : ''}>Menunggu Pembayaran</option>
          <option value="PROCESSING" ${orderFilter === 'PROCESSING' ? 'selected' : ''}>Diproses</option>
          <option value="SUCCESS" ${orderFilter === 'SUCCESS' ? 'selected' : ''}>Selesai</option>
          <option value="CANCELLED" ${orderFilter === 'CANCELLED' ? 'selected' : ''}>Batal/Gagal</option>
        </select>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr><th>Nomor / Tanggal</th><th>Produk</th><th>Total</th><th>Status</th><th>Aksi</th></tr>
          </thead>
          <tbody>
            ${filtered.length === 0
              ? '<tr><td colspan="5" class="text-center" style="padding:var(--spacing-lg);color:var(--color-text-muted);">Tidak ada pesanan.</td></tr>'
              : filtered.map(orderRow).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.querySelector('#order-filter').addEventListener('change', (e) => {
    orderFilter = e.target.value;
    renderOrdersTab(container);
  });

  container.querySelectorAll('[data-action="cancel-order"]').forEach(btn => {
    btn.addEventListener('click', () => confirmCancelOrder(container, btn.dataset.cancelOrder));
  });
}

function filterMatch(order) {
  if (orderFilter === 'SUCCESS') return order.topup_status === ORDER_STATUS.SUCCESS;
  if (orderFilter === 'WAITING_PAYMENT') {
    return order.payment_status === ORDER_STATUS.WAITING_PAYMENT && order.topup_status === ORDER_STATUS.PENDING;
  }
  if (orderFilter === 'PROCESSING') {
    return order.payment_status === ORDER_STATUS.PAID && order.topup_status === ORDER_STATUS.PROCESSING;
  }
  if (orderFilter === 'CANCELLED') {
    return [ORDER_STATUS.CANCELLED, ORDER_STATUS.FAILED, ORDER_STATUS.EXPIRED].includes(order.topup_status)
      || [ORDER_STATUS.CANCELLED, ORDER_STATUS.FAILED].includes(order.payment_status);
  }
  return true;
}

function orderRow(order) {
  const cancellable =
    order.payment_status === ORDER_STATUS.WAITING_PAYMENT &&
    order.topup_status === ORDER_STATUS.PENDING;

  let statusBadge = '<span class="badge badge-warning">Menunggu Bayar</span>';
  if (order.topup_status === ORDER_STATUS.SUCCESS) statusBadge = '<span class="badge badge-success">Selesai</span>';
  else if (order.topup_status === ORDER_STATUS.PROCESSING) statusBadge = '<span class="badge badge-primary">Diproses</span>';
  else if ([ORDER_STATUS.CANCELLED, ORDER_STATUS.FAILED, ORDER_STATUS.EXPIRED].includes(order.topup_status)) statusBadge = `<span class="badge badge-error">${order.topup_status}</span>`;

  return `
    <tr>
      <td>${escapeHtml(order.order_number)}<br><small class="wallet-tx-meta">${formatDate(order.created_at)}</small></td>
      <td>${escapeHtml(order.product_name)}<br><small class="wallet-tx-meta">${escapeHtml(order.player_id)}${order.zone_id ? ` (${escapeHtml(order.zone_id)})` : ''}</small></td>
      <td>${formatCurrency(order.price)}</td>
      <td>${statusBadge}</td>
      <td class="admin-actions-cell">
        <a href="/order?id=${order.order_number}" class="btn btn-ghost btn-sm">Lihat</a>
        ${cancellable ? `<button type="button" class="btn btn-secondary btn-sm" data-action="cancel-order" data-cancel-order="${order.order_number}">Batalkan</button>` : ''}
      </td>
    </tr>
  `;
}

function confirmCancelOrder(container, orderNumber) {
  const modal = showModal(
    '<p style="font-size:.9375rem;">Batalkan pesanan ini? Tindakan dicatat di log aktivitas.</p>',
    { title: 'Batalkan Pesanan', width: '360px' }
  );

  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  footer.innerHTML = `
    <button type="button" class="btn btn-secondary" data-action="no">Tidak</button>
    <button type="button" class="btn btn-primary" data-action="yes">Ya, Batalkan</button>
  `;
  modal.modal.appendChild(footer);

  footer.querySelector('[data-action="no"]').addEventListener('click', () => modal.close());
  footer.querySelector('[data-action="yes"]').addEventListener('click', () => {
    updateOrder(orderNumber, {
      payment_status: ORDER_STATUS.CANCELLED,
      topup_status: ORDER_STATUS.CANCELLED,
    });
    addAdminLog('order.cancel', orderNumber, 'dibatalkan oleh admin (belum bayar)');
    modal.close();
    showSuccess('Pesanan dibatalkan.', 2500);
    renderTab(container);
  });
}

/* ===== Logs ===== */

function renderLogsTab(container) {
  const logs = getAdminLogs();
  container.innerHTML = `
    <div class="card profile-card">
      <h3 class="card-section-title">Log Aktivitas Admin</h3>
      ${logs.length === 0
        ? '<p class="wallet-empty">Belum ada aktivitas tercatat.</p>'
        : `<div class="admin-table-wrap"><table class="admin-table">
            <thead><tr><th>Waktu</th><th>Aksi</th><th>Target</th><th>Detail</th></tr></thead>
            <tbody>${logs.map(log => `
              <tr>
                <td>${formatDate(log.at)}</td>
                <td>${escapeHtml(log.action)}</td>
                <td>${escapeHtml(log.target)}</td>
                <td>${escapeHtml(log.detail)}</td>
              </tr>`).join('')}</tbody>
          </table></div>`}
    </div>
  `;
}

/* ===== Init ===== */

async function initAdminPage() {
  initTheme();
  initLayout();

  const root = document.querySelector('[data-admin-root]');
  if (!root) return;

  await loadProducts();

  if (!isAdminLoggedIn()) {
    renderGate(root);
    return;
  }
  renderApp(root);
  console.log('Admin page initialized successfully');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdminPage);
} else {
  initAdminPage();
}

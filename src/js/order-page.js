import { initTheme } from './storage.js';
import { initLayout } from './layout.js';
import { initScrollReveal, showModal, showToast, showSuccess, showError, formatCurrency } from './ui.js';
import { getOrderByNumber, getStatusMeta, formatDate, ORDER_STATUS } from './orders.js';
import { escapeHtml } from './security.js';
import { getPaymentProvider, LocalWalletProvider, processOrderPayment } from './payment.js';
import { getTopupProvider, startTopupProcessing, checkTopupStatus } from './topup-providers.js';

const TIMELINE_STEPS = [
  { title: 'Pesanan Dibuat', desc: 'Pesanan kamu tercatat di sistem.' },
  { title: 'Pembayaran', desc: 'Selesaikan pembayaran sesuai metode yang dipilih.' },
  { title: 'Verifikasi & Top-Up', desc: 'Kami verifikasi pembayaran dan memproses top-up.' },
  { title: 'Selesai', desc: 'Diamond masuk ke akun game kamu.' },
];

const TERMINAL_FAILURE_STATUSES = [ORDER_STATUS.FAILED, ORDER_STATUS.EXPIRED, ORDER_STATUS.CANCELLED];

function getGameLabel(gameId) {
  const labels = { mobile_legends: 'Mobile Legends', free_fire: 'Free Fire' };
  return labels[gameId] || gameId;
}

function getPaymentLabel(methodId) {
  const labels = {
    wallet: 'Dompet Lokal',
    qris: 'QRIS',
    ewallet: 'E-Wallet',
    bank_transfer: 'Bank Transfer',
    virtual_account: 'Virtual Account',
  };
  return labels[methodId] || methodId;
}

function getEffectiveStatus(order) {
  if (TERMINAL_FAILURE_STATUSES.includes(order.topup_status)) {
    return order.topup_status;
  }
  if (order.topup_status === ORDER_STATUS.SUCCESS) {
    return ORDER_STATUS.SUCCESS;
  }
  if (order.payment_status === ORDER_STATUS.PAID) {
    return ORDER_STATUS.PROCESSING;
  }
  if (TERMINAL_FAILURE_STATUSES.includes(order.payment_status)) {
    return order.payment_status;
  }
  return order.payment_status;
}

function canBePaid(order) {
  return order.payment_status === ORDER_STATUS.WAITING_PAYMENT
    && order.topup_status === ORDER_STATUS.PENDING;
}

function renderNotFound(container) {
  container.innerHTML = `
    <div class="order-not-found">
      <h2 class="empty-state-title">Pesanan tidak ditemukan</h2>
      <p class="empty-state-desc">
        Nomor pesanan tidak valid atau pesanan tidak ada di perangkat ini.
        Pesanan tersimpan secara lokal di browser — cek dari perangkat yang sama saat memesan.
      </p>
      <div class="order-not-found-actions">
        <a href="/orders" class="btn btn-secondary">Lihat Semua Pesanan</a>
        <a href="/games" class="btn btn-primary">Mulai Top Up</a>
      </div>
    </div>
  `;
}

function getTimelineItemHTML(step, index, currentStep) {
  const state = index < currentStep ? 'done' : (index === currentStep ? 'active' : 'upcoming');
  const icon = state === 'done'
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>'
    : String(index + 1);
  return `
    <li class="timeline-item ${state}">
      <span class="timeline-dot" aria-hidden="true">${icon}</span>
      <div class="timeline-content">
        <p class="timeline-title">${step.title}</p>
        <p class="timeline-desc">${step.desc}</p>
      </div>
    </li>
  `;
}

function renderTimeline(status) {
  const currentStep = status === ORDER_STATUS.SUCCESS
    ? TIMELINE_STEPS.length
    : (getStatusMeta(status).step ?? -1);

  return `
    <ol class="order-timeline" aria-label="Progres pesanan">
      ${TIMELINE_STEPS.map((step, i) => getTimelineItemHTML(step, i, currentStep)).join('')}
    </ol>
  `;
}

function renderOrder(order) {
  const effectiveStatus = getEffectiveStatus(order);
  const meta = getStatusMeta(effectiveStatus);
  const isFailed = TERMINAL_FAILURE_STATUSES.includes(effectiveStatus);
  const account = escapeHtml(order.zone_id ? `${order.player_id} (${order.zone_id})` : order.player_id);

  return `
    <article class="card order-detail-card reveal visible">
      <header class="order-header">
        <div class="order-header-info">
          <p class="summary-label">Nomor Pesanan</p>
          <div class="order-number-row">
            <h2 class="order-number">${escapeHtml(order.order_number)}</h2>
            <button class="btn btn-ghost btn-sm copy-order-btn" data-action="copy-order-number" aria-label="Salin nomor pesanan">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Salin
            </button>
          </div>
          <p class="order-date">${formatDate(order.created_at)}</p>
        </div>
        <span class="badge ${meta.badge} order-status-badge">${meta.label}</span>
      </header>

      <p class="order-status-desc ${isFailed ? 'is-failed' : ''}">${meta.description}</p>

      ${renderTimeline(effectiveStatus)}

      <div class="divider"></div>

      <div class="summary-rows">
        <div class="summary-row">
          <span class="summary-label">Game</span>
          <span class="summary-value">${escapeHtml(getGameLabel(order.game))}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Produk</span>
          <span class="summary-value">${escapeHtml(order.product_name)}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">ID Pemain</span>
          <span class="summary-value">${account}</span>
        </div>
        ${order.player_nickname ? `
          <div class="summary-row">
            <span class="summary-label">Nickname</span>
            <span class="summary-value">${escapeHtml(order.player_nickname)}</span>
          </div>
        ` : ''}
        <div class="summary-row">
          <span class="summary-label">Metode Pembayaran</span>
          <span class="summary-value">${escapeHtml(getPaymentLabel(order.payment_method))}</span>
        </div>
        <div class="summary-total-row">
          <span class="summary-label">Total</span>
          <span class="summary-total">${formatCurrency(order.price)}</span>
        </div>
      </div>

      <div class="order-actions">
        ${canBePaid(order) ? '<button class="btn btn-primary btn-lg" data-action="pay-now">Bayar Sekarang</button>' : ''}
        <a href="/games" class="btn btn-secondary">Top Up Lagi</a>
        <a href="/orders" class="btn btn-secondary">Semua Pesanan</a>
      </div>
    </article>
  `;
}

function buildWalletModalContent(order) {
  const provider = new LocalWalletProvider();
  const balance = provider.getBalance();
  const remaining = balance - order.price;
  const sufficient = remaining >= 0;

  return `
    <div class="summary-rows">
      <div class="summary-row">
        <span class="summary-label">Total tagihan</span>
        <span class="summary-value">${formatCurrency(order.price)}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Saldo dompet</span>
        <span class="summary-value">${formatCurrency(balance)}</span>
      </div>
      <div class="summary-total-row">
        <span class="summary-label">Sisa setelah bayar</span>
        <span class="summary-total ${sufficient ? '' : 'is-negative'}">${formatCurrency(remaining)}</span>
      </div>
    </div>
    ${sufficient ? '' : `
      <p class="pay-insufficient">Saldo dompet tidak cukup untuk pesanan ini.</p>
    `}
  `;
}

function buildSimulatedModalContent(order, providerLabel) {
  return `
    <p class="pay-sim-note">
      Mode test: pembayaran <strong>${providerLabel}</strong> disimulasikan secara lokal.
      Tidak ada transaksi nyata yang diproses.
    </p>
    <div class="summary-total-row">
      <span class="summary-label">Total tagihan</span>
      <span class="summary-total">${formatCurrency(order.price)}</span>
    </div>
  `;
}

function handlePayNow(order) {
  const provider = getPaymentProvider(order.payment_method);
  const isWallet = provider instanceof LocalWalletProvider;
  const insufficient = isWallet && provider.getBalance() < order.price;

  const content = isWallet
    ? buildWalletModalContent(order)
    : buildSimulatedModalContent(order, provider.label);

  const modal = showModal(content, {
    title: 'Pembayaran',
    width: '400px',
  });

  const footer = document.createElement('div');
  footer.className = 'modal-footer';

  if (insufficient) {
    footer.innerHTML = `
      <button class="btn btn-secondary" data-action="close-pay">Tutup</button>
      <a href="/profile#wallet" class="btn btn-primary">Isi Saldo</a>
    `;
    footer.querySelector('[data-action="close-pay"]').addEventListener('click', () => modal.close());
    modal.modal.appendChild(footer);
    return;
  }

  footer.innerHTML = `
    <button class="btn btn-secondary" data-action="cancel-pay">Batal</button>
    <button class="btn btn-primary" data-action="confirm-pay">
      ${isWallet ? 'Bayar dengan Dompet' : `Bayar via ${provider.label}`}
    </button>
  `;
  modal.modal.appendChild(footer);

  footer.querySelector('[data-action="cancel-pay"]').addEventListener('click', () => modal.close());

  const confirmBtn = footer.querySelector('[data-action="confirm-pay"]');
  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Memproses...';
    try {
      await processOrderPayment(order);
    } catch (err) {
      showError(err.message || 'Pembayaran gagal. Silakan coba lagi.', 4500);
      modal.close();
      renderCurrentOrder();
      return;
    }

    modal.close();
    showToast('Pembayaran diterima. Top-up sedang diproses...', 'success', 3000);

    try {
      const paidOrder = await getOrderByNumber(order.order_number);
      if (paidOrder) {
        await getTopupProvider(paidOrder.game).startTopup(paidOrder);
      }
    } catch {}

    renderCurrentOrder();
    pollTopupStatus(order.order_number);
  });
}

function pollTopupStatus(orderNumber, attempt = 0) {
  const MAX_ATTEMPTS = 30;
  const current = getOrderByNumber(orderNumber);
  if (!current) return;

  if (TERMINAL_FAILURE_STATUSES.includes(current.topup_status)) {
    showError('Proses top-up berhenti. Silakan hubungi customer service.', 5000);
    renderCurrentOrder();
    return;
  }

  const result = checkTopupStatus(current);

  if (result.status === ORDER_STATUS.SUCCESS) {
    showSuccess('Top-up berhasil! Diamond telah masuk ke akun kamu.', 5000);
    renderCurrentOrder();
    return;
  }

  if (attempt >= MAX_ATTEMPTS) {
    showError('Pembaruan status lebih lambat dari biasanya. Muat ulang halaman untuk cek status terbaru.', 6000);
    return;
  }

  renderCurrentOrder();
  setTimeout(() => pollTopupStatus(orderNumber, attempt + 1), 1000);
}

function attachOrderListeners(container, order) {
  container.querySelector('[data-action="copy-order-number"]')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(order.order_number);
      showToast('Nomor pesanan disalin.', 'success', 2500);
    } catch {
      showToast('Gagal menyalin. Salin manual: ' + order.order_number, 'warning', 4000);
    }
  });

  container.querySelector('[data-action="pay-now"]')?.addEventListener('click', () => {
    if (canBePaid(order)) handlePayNow(order);
  });
}

async function renderCurrentOrder() {
  const container = document.querySelector('[data-order-loading]');
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const order = await getOrderByNumber(params.get('id'));

  if (!order) {
    document.title = 'Pesanan Tidak Ditemukan - Mama Scarlet';
    renderNotFound(container);
    return;
  }

  document.title = `Pesanan ${order.order_number} - Mama Scarlet`;
  container.innerHTML = renderOrder(order);
  attachOrderListeners(container, order);
}

function initOrderPage() {
  initTheme();
  initLayout();
  initScrollReveal();
  renderCurrentOrder();
  console.log('Order detail page initialized successfully');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOrderPage);
} else {
  initOrderPage();
}

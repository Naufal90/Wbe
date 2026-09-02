import { initTheme } from './storage.js';
import { initLayout } from './layout.js';
import { initScrollReveal, formatCurrency } from './ui.js';
import { fetchAllOrders, getStatusMeta, formatDate, ORDER_STATUS } from './orders.js';
import { escapeHtml } from './security.js';

function getGameLabel(gameId) {
  const labels = { mobile_legends: 'Mobile Legends', free_fire: 'Free Fire' };
  return labels[gameId] || gameId;
}

function getOrderItemHTML(order) {
  const meta = getStatusMeta(order.payment_status);
  return `
    <a href="/order?id=${order.order_number}" class="card order-item hover-lift reveal visible" aria-label="Lihat pesanan ${order.order_number}">
      <div class="order-item-main">
        <p class="order-item-title">${escapeHtml(order.product_name)}</p>
        <p class="order-item-sub">${escapeHtml(getGameLabel(order.game))}</p>
        <p class="order-item-sub">${escapeHtml(order.order_number)} &middot; ${formatDate(order.created_at)}</p>
      </div>
      <div class="order-item-side">
        <span class="badge ${meta.badge}">${meta.label}</span>
        <span class="order-item-price">${formatCurrency(order.price)}</span>
      </div>
    </a>
  `;
}

async function renderOrders() {
  const list = document.querySelector('[data-orders-list]');
  const emptyState = document.querySelector('[data-empty-state]');
  if (!list) return;

  const orders = await fetchAllOrders();

  if (orders.length === 0) {
    list.innerHTML = '';
    if (emptyState) emptyState.hidden = false;
    return;
  }

  if (emptyState) emptyState.hidden = true;
  list.innerHTML = orders.map(getOrderItemHTML).join('');
}

function initOrdersPage() {
  initTheme();
  initLayout();
  initScrollReveal();
  renderOrders();
  console.log('Order history page initialized successfully');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOrdersPage);
} else {
  initOrdersPage();
}

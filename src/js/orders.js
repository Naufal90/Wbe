import { api } from './api.js';
import { formatDateTime } from './ui.js';

export const ORDER_STATUS = {
  PENDING: 'PENDING',
  WAITING_PAYMENT: 'WAITING_PAYMENT',
  UNPAID: 'UNPAID',
  PAID: 'PAID',
  PROCESSING: 'PROCESSING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
};

export const STATUS_META = {
  [ORDER_STATUS.PENDING]: {
    label: 'Menunggu Pembayaran',
    badge: 'badge-warning',
    description: 'Pesanan dibuat. Selesaikan pembayaran untuk melanjutkan.',
    step: 1,
    terminal: false,
  },
  [ORDER_STATUS.WAITING_PAYMENT]: {
    label: 'Menunggu Pembayaran',
    badge: 'badge-warning',
    description: 'Selesaikan pembayaran sebelum batas waktu berakhir.',
    step: 1,
    terminal: false,
  },
  [ORDER_STATUS.UNPAID]: {
    label: 'Menunggu Pembayaran',
    badge: 'badge-warning',
    description: 'Selesaikan pembayaran sebelum batas waktu berakhir.',
    step: 1,
    terminal: false,
  },
  [ORDER_STATUS.PAID]: {
    label: 'Dibayar',
    badge: 'badge-primary',
    description: 'Pembayaran diterima. Pesanan menunggu verifikasi.',
    step: 2,
    terminal: false,
  },
  [ORDER_STATUS.PROCESSING]: {
    label: 'Diproses',
    badge: 'badge-primary',
    description: 'Top-up sedang diproses ke akun game kamu.',
    step: 2,
    terminal: false,
  },
  [ORDER_STATUS.SUCCESS]: {
    label: 'Selesai',
    badge: 'badge-success',
    description: 'Top-up berhasil. Terima kasih telah menggunakan Mama Scarlet!',
    step: 3,
    terminal: true,
  },
  [ORDER_STATUS.FAILED]: {
    label: 'Gagal',
    badge: 'badge-error',
    description: 'Terjadi kendala saat memproses pesanan. Hubungi customer service untuk bantuan.',
    step: null,
    terminal: true,
  },
  [ORDER_STATUS.EXPIRED]: {
    label: 'Kedaluwarsa',
    badge: 'badge-error',
    description: 'Batas waktu pembayaran habis. Silakan buat pesanan baru.',
    step: null,
    terminal: true,
  },
  [ORDER_STATUS.CANCELLED]: {
    label: 'Dibatalkan',
    badge: 'badge-muted',
    description: 'Pesanan ini dibatalkan.',
    step: null,
    terminal: true,
  },
};

export function getStatusMeta(status) {
  return STATUS_META[status] || {
    label: status || 'Tidak Diketahui',
    badge: 'badge-muted',
    description: 'Status pesanan tidak diketahui.',
    step: null,
    terminal: true,
  };
}

export function formatDate(isoString) {
  if (!isoString) return '-';
  return formatDateTime(isoString);
}

function generateRandomCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function generateOrderNumber(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `TOPUP-${y}${m}${d}-${generateRandomCode()}`;
}

export async function createOrder(data) {
  try {
    const result = await api.post('/orders', {
      game_id: data.game,
      product_id: data.product_id,
      player_id: data.player_id,
      zone_id: data.zone_id,
      payment_method: data.payment_method,
    });
    return mapBackendOrder(result);
  } catch (err) {
    throw new Error(err.message || 'Gagal membuat pesanan.');
  }
}

export async function getOrderByNumber(orderNumber) {
  try {
    const result = await api.get(`/orders/${orderNumber}`);
    return mapBackendOrder(result);
  } catch {
    return null;
  }
}

export function getAllOrders() {
  return [];
}

export async function fetchAllOrders() {
  try {
    const results = await api.get('/orders');
    return Array.isArray(results) ? results.map(mapBackendOrder) : [];
  } catch {
    return [];
  }
}

export async function updateOrder(orderNumber, patch) {
  try {
    const result = await api.patch(`/admin/orders/${orderNumber}`, patch);
    return mapBackendOrder(result);
  } catch {
    return null;
  }
}

function mapBackendOrder(o) {
  if (!o) return null;
  return {
    order_id: o.order_id,
    user_id: o.user_id,
    order_number: o.order_id,
    game: o.game_id,
    game_name: o.game_name,
    product_id: o.product_id,
    product_name: o.product_name,
    player_id: o.player_id,
    zone_id: o.zone_id,
    player_nickname: o.player_nickname,
    payment_method: o.payment_method,
    price: o.amount,
    admin_fee: o.admin_fee,
    total_amount: o.total_amount,
    payment_status: o.payment_status,
    topup_status: o.topup_status,
    payment_ref: o.payment_reference,
    topup_ref: o.provider_tx_id,
    created_at: o.created_at,
    paid_at: o.paid_at,
    completed_at: o.completed_at,
  };
}

import { api } from './api.js';
import { deductWallet, getWalletBalance, fetchWalletData } from './wallet.js';
import { updateOrder } from './orders.js';

function generatePaymentRef() {
  return `PAY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

export class PaymentProvider {
  constructor(id, label) {
    this.id = id;
    this.label = label;
  }

  async createPayment() {
    throw new Error(`Provider ${this.constructor.name} belum mengimplementasikan createPayment().`);
  }
}

export class LocalWalletProvider extends PaymentProvider {
  constructor() {
    super('wallet', 'Dompet Lokal');
  }

  getBalance() {
    return getWalletBalance();
  }

  async createPayment(order) {
    const walletBalanceAfter = await deductWallet(order.price, { reference: order.order_number });
    return {
      id: generatePaymentRef(),
      provider: this.id,
      amount: order.price,
      status: 'PAID',
      paid_at: new Date().toISOString(),
      wallet_balance_after: walletBalanceAfter,
    };
  }
}

export class SimulatedProvider extends PaymentProvider {
  async createPayment(order) {
    return {
      id: generatePaymentRef(),
      provider: this.id,
      amount: order.price,
      status: 'PAID',
      paid_at: new Date().toISOString(),
    };
  }
}

export function getPaymentProvider(methodId) {
  if (methodId === 'wallet') {
    return new LocalWalletProvider();
  }
  const labels = { qris: 'QRIS', ewallet: 'E-Wallet', bank_transfer: 'Bank Transfer', virtual_account: 'Virtual Account' };
  return new SimulatedProvider(methodId, labels[methodId] || methodId);
}

export async function processOrderPayment(order) {
  try {
    const result = await api.post(`/orders/${order.order_number}/pay`, {
      payment_method: order.payment_method,
    });
    return {
      id: result.payment_reference || generatePaymentRef(),
      provider: order.payment_method,
      amount: order.amount,
      status: 'PAID',
      paid_at: result.paid_at || new Date().toISOString(),
    };
  } catch (err) {
    throw new Error(err.message || 'Pembayaran gagal.');
  }
}

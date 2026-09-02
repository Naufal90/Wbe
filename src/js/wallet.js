import { api } from './api.js';

export const WALLET_TX_TYPE = {
  TOPUP: 'TOPUP',
  PAYMENT: 'PAYMENT',
};

let cachedBalance = null;
let cachedTransactions = null;

export function getWalletBalance() {
  if (cachedBalance !== null) return cachedBalance;
  return 0;
}

export async function fetchWalletData() {
  try {
    const user = await api.get('/auth/me');
    cachedBalance = user.wallet_balance || 0;
    return cachedBalance;
  } catch {
    return cachedBalance || 0;
  }
}

export async function addWalletFunds(amount, { reference = null } = {}) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Nominal harus berupa angka lebih besar dari nol.');
  }
  try {
    const user = await api.post('/wallet/topup', { amount: Math.round(amount), payment_method: 'qris' });
    cachedBalance = user.wallet_balance;
    cachedTransactions = null;
    return cachedBalance;
  } catch (err) {
    throw new Error(err.message || 'Gagal mengisi saldo.');
  }
}

export async function deductWallet(amount, { reference = null } = {}) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Nominal harus berupa angka lebih besar dari nol.');
  }
  if (cachedBalance !== null && cachedBalance < Math.round(amount)) {
    throw new Error('Saldo dompet tidak cukup. Silakan isi saldo terlebih dahulu.');
  }
  cachedBalance = (cachedBalance || 0) - Math.round(amount);
  cachedTransactions = null;
  return cachedBalance;
}

export function getWalletTransactions() {
  return cachedTransactions || [];
}

export async function fetchWalletTransactions() {
  try {
    const txs = await api.get('/wallet/transactions');
    cachedTransactions = Array.isArray(txs) ? txs : [];
    return cachedTransactions;
  } catch {
    return cachedTransactions || [];
  }
}

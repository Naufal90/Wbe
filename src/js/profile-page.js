import { initTheme } from './storage.js';
import { initLayout } from './layout.js';
import {
  initScrollReveal,
  showSuccess,
  showError,
  showModal,
  formatCurrency,
} from './ui.js';
import { getCurrentUser, updateProfileName, updateProfileAvatar, changePassword, logout } from './auth.js';
import { formatDate } from './orders.js';
import { validateRequired, validatePassword as validateNewPassword } from './validation.js';
import { getWalletBalance, addWalletFunds, fetchWalletTransactions, fetchWalletData, WALLET_TX_TYPE } from './wallet.js';
import { clampNumber } from './security.js';

const TOPUP_PRESETS = [10000, 25000, 50000, 100000];
const AVATAR_MAX_INPUT_BYTES = 3 * 1024 * 1024;
const AVATAR_SIZE_PX = 192;
const WALLET_MIN_TOPUP = 1000;
const WALLET_MAX_TOPUP = 100000000;

function setFieldError(fieldKey, message) {
  const errorEl = document.querySelector(`[data-error-for="${fieldKey}"]`);
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.hidden = !message;
  }
}

function renderProfile(user) {
  const initial = (user.name || 'U').trim().charAt(0).toUpperCase();
  document.title = `Profil ${user.name} - Mama Scarlet`;

  const avatarEl = document.querySelector('[data-profile-avatar]');
  const name = document.querySelector('[data-profile-name]');
  const email = document.querySelector('[data-profile-email]');
  const since = document.querySelector('[data-profile-since]');
  const removeBtn = document.querySelector('[data-action="remove-avatar"]');
  const nameInput = document.querySelector('#profile-name-input');

  if (avatarEl) {
    avatarEl.innerHTML = user.avatar
      ? `<img src="${user.avatar}" alt="Foto profil ${user.name}">`
      : initial;
    avatarEl.classList.toggle('has-photo', Boolean(user.avatar));
  }
  if (removeBtn) removeBtn.hidden = !user.avatar;
  if (name) name.textContent = user.name;
  if (email) email.textContent = user.email;
  if (since) since.textContent = formatDate(user.created_at);
  if (nameInput && !nameInput.value) nameInput.value = user.name;
}

/* ===== Wallet ===== */

function getWalletTxItemHTML(tx) {
  const isTopup = tx.type === WALLET_TX_TYPE.TOPUP;
  return `
    <li class="wallet-tx-item">
      <span class="wallet-tx-icon ${isTopup ? 'is-in' : 'is-out'}" aria-hidden="true">
        ${isTopup
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 11 12 6 7 11"/><line x1="12" y1="18" x2="12" y2="6"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="7 13 12 18 17 13"/><line x1="12" y1="6" x2="12" y2="18"/></svg>'}
      </span>
      <div class="wallet-tx-info">
        <span class="wallet-tx-label">${isTopup ? 'Isi Saldo' : 'Pembayaran'}</span>
        <small class="wallet-tx-meta">${tx.reference ? `${tx.reference} &middot; ` : ''}${formatDate(tx.created_at)}</small>
      </div>
      <span class="wallet-tx-amount ${isTopup ? 'is-in' : 'is-out'}">${isTopup ? '+' : '-'}${formatCurrency(tx.amount)}</span>
    </li>
  `;
}

async function renderWallet() {
  const balanceEl = document.querySelector('[data-wallet-balance]');
  const listEl = document.querySelector('[data-wallet-tx]');
  const emptyEl = document.querySelector('[data-wallet-empty]');

  await fetchWalletData();
  if (balanceEl) balanceEl.textContent = formatCurrency(getWalletBalance());
  if (!listEl) return;

  const transactions = await fetchWalletTransactions();
  if (transactions.length === 0) {
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.hidden = false;
    return;
  }
  if (emptyEl) emptyEl.hidden = true;
  listEl.innerHTML = transactions.map(getWalletTxItemHTML).join('');
}

function openTopupModal() {
  const content = `
    <p class="wallet-modal-hint">Pilih nominal isi saldo (simulasi — tidak ada uang nyata):</p>
    <div class="preset-grid">
      ${TOPUP_PRESETS.map(amount => `
        <button type="button" class="option-card preset-card" data-preset-amount="${amount}">
          <span class="option-price">${formatCurrency(amount)}</span>
        </button>
      `).join('')}
    </div>
    <div class="id-field-group">
      <label class="label" for="wallet-custom-amount">Atau masukkan nominal lain</label>
      <input type="number" id="wallet-custom-amount" class="input" min="1000" step="1000" placeholder="Contoh: 15000" inputmode="numeric">
    </div>
  `;

  const modal = showModal(content, {
    title: 'Isi Saldo Dompet',
    width: '380px',
  });

  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  footer.innerHTML = `
    <button type="button" class="btn btn-secondary" data-action="cancel-topup">Batal</button>
    <button type="button" class="btn btn-primary" data-action="confirm-topup">Isi Saldo</button>
  `;
  modal.modal.appendChild(footer);

  let selectedAmount = null;

  modal.modal.querySelectorAll('[data-preset-amount]').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.modal.querySelectorAll('[data-preset-amount]').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedAmount = parseInt(btn.dataset.presetAmount, 10);
    });
  });

  footer.querySelector('[data-action="cancel-topup"]').addEventListener('click', () => modal.close());

  footer.querySelector('[data-action="confirm-topup"]').addEventListener('click', async () => {
    const customInput = modal.modal.querySelector('#wallet-custom-amount');
    const rawValue = customInput?.value ?? '';
    const customValue = parseInt(rawValue, 10);

    const requested = Number.isFinite(customValue) && rawValue !== ''
      ? customValue
      : selectedAmount;

    const amount = clampNumber(requested, { min: WALLET_MIN_TOPUP, max: WALLET_MAX_TOPUP });
    if (amount === null) {
      showError(`Nominal isi saldo harus antara ${formatCurrency(WALLET_MIN_TOPUP)} - ${formatCurrency(WALLET_MAX_TOPUP)}.`, 4000);
      return;
    }

    try {
      await addWalletFunds(amount);
      modal.close();
      await renderWallet();
      showSuccess(`Saldo berhasil ditambahkan. Saldo sekarang: ${formatCurrency(getWalletBalance())}`, 3500);
    } catch (err) {
      showError(err.message, 4000);
    }
  });
}

/* ===== Avatar ===== */

function fileToSquareDataUrl(file, sizePx) {
  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = sizePx;
      canvas.height = sizePx;
      const ctx = canvas.getContext('2d');

      const minSide = Math.min(img.width, img.height);
      ctx.drawImage(
        img,
        (img.width - minSide) / 2,
        (img.height - minSide) / 2,
        minSide,
        minSide,
        0,
        0,
        sizePx,
        sizePx
      );

      URL.revokeObjectURL(imageUrl);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };

    img.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error('Gagal membaca gambar.'));
    };

    img.src = imageUrl;
  });
}

async function handleAvatarChange(e) {
  const input = e.target;
  const file = input.files?.[0];

  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showError('File harus berupa gambar (JPG/PNG/WebP).', 4000);
    input.value = '';
    return;
  }
  if (file.size > AVATAR_MAX_INPUT_BYTES) {
    showError('Ukuran gambar maksimal 3 MB.', 4000);
    input.value = '';
    return;
  }

  try {
    const dataUrl = await fileToSquareDataUrl(file, AVATAR_SIZE_PX);
    const result = updateProfileAvatar(dataUrl);
    if (!result.ok) {
      showError(result.error, 4500);
      return;
    }
    renderProfile(result.user);
    showSuccess('Foto profil berhasil diperbarui.', 3000);
  } catch (err) {
    showError(err.message || 'Gagal memproses gambar.', 4000);
  } finally {
    input.value = '';
  }
}

function handleRemoveAvatar() {
  const result = updateProfileAvatar(null);
  if (!result.ok) {
    showError(result.error, 4000);
    return;
  }
  renderProfile(result.user);
  showSuccess('Foto profil dihapus.', 2500);
}

/* ===== Forms ===== */

function handleProfileSubmit(e) {
  e.preventDefault();
  const input = document.querySelector('#profile-name-input');
  const value = input?.value ?? '';

  const check = validateRequired(value, 'Nama tampilan');
  if (!check.valid || value.trim().length < 3) {
    setFieldError('name', value.trim().length < 3 ? 'Nama minimal 3 karakter' : check.message);
    return;
  }
  setFieldError('name', '');

  const result = updateProfileName(value);
  if (!result.ok) {
    showError(result.error, 4000);
    return;
  }

  renderProfile(result.user);
  showSuccess('Profil berhasil diperbarui.', 2500);
}

function handlePasswordSubmit(e) {
  e.preventDefault();

  const current = document.querySelector('#password-current')?.value ?? '';
  const newPassword = document.querySelector('#password-new')?.value ?? '';
  const confirm = document.querySelector('#password-confirm')?.value ?? '';

  let valid = true;

  const currentCheck = validateRequired(current, 'Kata sandi saat ini');
  if (!currentCheck.valid) {
    setFieldError('current', currentCheck.message);
    valid = false;
  } else {
    setFieldError('current', '');
  }

  const newCheck = validateNewPassword(newPassword);
  if (!newCheck.valid) {
    setFieldError('new', newCheck.message);
    valid = false;
  } else {
    setFieldError('new', '');
  }

  if (newPassword && newPassword !== confirm) {
    setFieldError('confirm', 'Konfirmasi kata sandi tidak sama.');
    valid = false;
  } else {
    setFieldError('confirm', '');
  }

  if (!valid) return;

  const submitBtn = document.querySelector('[data-password-submit]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Menyimpan...';
  }

  changePassword(current, newPassword)
    .then(result => {
      if (!result.ok) {
        if (result.error.includes('Kata sandi saat ini salah')) {
          setFieldError('current', result.error);
        }
        showError(result.error, 4500);
        return;
      }
      document.querySelector('#password-current').value = '';
      document.querySelector('#password-new').value = '';
      document.querySelector('#password-confirm').value = '';
      showSuccess('Kata sandi berhasil diganti.', 3000);
    })
    .catch(() => showError('Terjadi kesalahan tak terduga. Silakan coba lagi.', 4000))
    .finally(() => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Simpan Kata Sandi';
      }
    });
}

/* ===== Init ===== */

window.addEventListener('authchange', () => {
  const user = getCurrentUser();
  if (user) renderProfile(user);
});

function initProfilePage() {
  initTheme();
  initLayout();
  initScrollReveal();

  const user = getCurrentUser();
  if (!user) {
    window.location.replace('/login');
    return;
  }

  renderProfile(user);
  renderWallet();

  document.querySelector('[data-profile-form]')
    ?.addEventListener('submit', handleProfileSubmit);

  document.querySelector('[data-avatar-input]')
    ?.addEventListener('change', handleAvatarChange);

  document.querySelector('[data-action="remove-avatar"]')
    ?.addEventListener('click', handleRemoveAvatar);

  document.querySelector('[data-action="open-topup"]')
    ?.addEventListener('click', openTopupModal);

  document.querySelector('#password-form')
    ?.addEventListener('submit', handlePasswordSubmit);

  document.querySelector('[data-action="logout"]')?.addEventListener('click', () => {
    logout();
    showSuccess('Kamu telah keluar dari akun.', 2500);
    setTimeout(() => {
      window.location.href = '/';
    }, 600);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProfilePage);
} else {
  initProfilePage();
}

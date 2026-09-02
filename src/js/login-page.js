import { initTheme } from './storage.js';
import { initLayout } from './layout.js';
import { initScrollReveal, showError } from './ui.js';
import { validateEmail, validateRequired } from './validation.js';
import { login, getLoginLockInfo } from './auth.js';

function setFieldError(fieldKey, message) {
  const errorEl = document.querySelector(`[data-error-for="${fieldKey}"]`);
  const input = document.querySelector(fieldKey === 'email' ? '#login-email' : '#login-password');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.hidden = !message;
  }
  if (input) input.classList.toggle('input-error', Boolean(message));
}

function clearErrors() {
  setFieldError('email', '');
  setFieldError('password', '');
}

function setLoading(isLoading) {
  const btn = document.querySelector('[data-login-submit]');
  if (!btn) return;
  btn.disabled = isLoading;
  btn.textContent = isLoading ? 'Memproses...' : 'Masuk';
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  clearErrors();

  const email = document.querySelector('#login-email')?.value ?? '';
  const password = document.querySelector('#login-password')?.value ?? '';

  let valid = true;
  const emailCheck = validateEmail(email);
  if (!emailCheck.valid) {
    setFieldError('email', emailCheck.message);
    valid = false;
  }
  const passwordCheck = validateRequired(password, 'Kata sandi');
  if (!passwordCheck.valid) {
    setFieldError('password', passwordCheck.message);
    valid = false;
  }

  const lockInfo = getLoginLockInfo(email);
  if (lockInfo.locked) {
    const minutes = Math.ceil(lockInfo.remainingMs / 60000);
    showError(`Terlalu banyak percobaan gagal. Coba lagi dalam ${minutes} menit.`, 5000);
    return;
  }

  if (!valid) return;

  setLoading(true);
  try {
    const result = await login({ email, password });
    if (!result.ok) {
      if (result.error.includes('Email atau kata sandi salah')) {
        setFieldError('password', 'Email atau kata sandi salah.');
      }
      showError(result.error, 4500);
      return;
    }
    window.location.href = '/profile';
  } catch {
    showError('Terjadi kesalahan tak terduga. Silakan coba lagi.', 4000);
  } finally {
    setLoading(false);
  }
}

function initLoginPage() {
  initTheme();
  initLayout();
  initScrollReveal();

  document.querySelector('#login-form')
    ?.addEventListener('submit', handleLoginSubmit);

  console.log('Login page initialized successfully');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLoginPage);
} else {
  initLoginPage();
}

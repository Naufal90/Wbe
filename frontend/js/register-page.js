import { initTheme } from './storage.js';
import { initLayout } from './layout.js';
import { initScrollReveal, showError, showSuccess } from './ui.js';
import { validateEmail, validatePassword, validateRequired } from './validation.js';
import { register } from './auth.js';

function setFieldError(fieldKey, message) {
  const errorEl = document.querySelector(`[data-error-for="${fieldKey}"]`);
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.hidden = !message;
  }
  const inputMap = {
    name: '#register-name',
    email: '#register-email',
    password: '#register-password',
    confirm: '#register-confirm',
  };
  if (inputMap[fieldKey]) {
    document.querySelector(inputMap[fieldKey])
      ?.classList.toggle('input-error', Boolean(message));
  }
}

function clearErrors() {
  ['name', 'email', 'password', 'confirm', 'terms'].forEach(k => setFieldError(k, ''));
}

function setLoading(isLoading) {
  const btn = document.querySelector('[data-register-submit]');
  if (!btn) return;
  btn.disabled = isLoading;
  btn.textContent = isLoading ? 'Memproses...' : 'Daftar';
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  clearErrors();

  const name = document.querySelector('#register-name')?.value ?? '';
  const email = document.querySelector('#register-email')?.value ?? '';
  const password = document.querySelector('#register-password')?.value ?? '';
  const confirm = document.querySelector('#register-confirm')?.value ?? '';
  const terms = document.querySelector('#register-terms')?.checked ?? false;

  let valid = true;

  const nameCheck = validateRequired(name, 'Nama lengkap');
  if (!nameCheck.valid || name.trim().length < 3) {
    setFieldError('name', name.trim().length < 3 ? 'Nama minimal 3 karakter' : nameCheck.message);
    valid = false;
  }

  const emailCheck = validateEmail(email);
  if (!emailCheck.valid) {
    setFieldError('email', emailCheck.message);
    valid = false;
  }

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) {
    setFieldError('password', passwordCheck.message);
    valid = false;
  } else if (password !== confirm) {
    setFieldError('confirm', 'Konfirmasi kata sandi tidak sama.');
    valid = false;
  }

  if (!terms) {
    setFieldError('terms', 'Kamu harus menyetujui Syarat & Ketentuan.');
    valid = false;
  }

  if (!valid) return;

  setLoading(true);
  try {
    const result = await register({ name, email, password });
    if (!result.ok) {
      if (result.error.includes('Email sudah terdaftar')) {
        setFieldError('email', result.error);
      }
      showError(result.error, 4500);
      return;
    }
    showSuccess(`Akun berhasil dibuat. Selamat datang, ${result.user.name}!`, 3000);
    setTimeout(() => {
      window.location.href = '/profile';
    }, 800);
  } catch {
    showError('Terjadi kesalahan tak terduga. Silakan coba lagi.', 4000);
  } finally {
    setLoading(false);
  }
}

function initRegisterPage() {
  initTheme();
  initLayout();
  initScrollReveal();

  document.querySelector('#register-form')
    ?.addEventListener('submit', handleRegisterSubmit);

  console.log('Register page initialized successfully');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRegisterPage);
} else {
  initRegisterPage();
}

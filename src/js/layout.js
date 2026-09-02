import { initBackToTop, initSmoothScroll } from './ui.js';
import { getCurrentUser, logout } from './auth.js';
import { escapeHtml } from './security.js';

function renderHeaderAuth() {
  const slot = document.querySelector('[data-header-auth]');
  if (!slot) return;

  const user = getCurrentUser();

  if (user) {
    const safeName = escapeHtml(user.name || 'User');
    const initial = (user.name || 'U').trim().charAt(0).toUpperCase();
    const avatarContent = user.avatar
      ? `<img src="${user.avatar}" alt="${safeName}">`
      : initial;
    slot.innerHTML = `
      <a href="/profile" class="header-avatar ${user.avatar ? 'has-photo' : ''}" aria-label="Profil ${safeName}" title="${safeName}">${avatarContent}</a>
    `;
    return;
  }

  slot.innerHTML = `
    <a href="/login" class="btn btn-primary btn-sm header-login-btn">Masuk</a>
  `;
}

function attachHeaderAuthListeners() {
  const slot = document.querySelector('[data-header-auth]');
  if (!slot) return;

  slot.addEventListener('click', (e) => {
    const logoutBtn = e.target.closest('[data-action="header-logout"]');
    if (!logoutBtn) return;
    e.preventDefault();
    logout();
  });

  window.addEventListener('authchange', renderHeaderAuth);
  window.addEventListener('storage', (e) => {
    if (e.key === 'topup_auth_session') renderHeaderAuth();
  });
}

export function initHeader() {
  const header = document.querySelector('.header');
  if (!header) return;

  const threshold = 100;

  window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;
    if (currentScrollY > threshold) {
      header.style.background = 'rgba(10, 10, 15, 0.95)';
      header.style.boxShadow = 'var(--shadow-md)';
    } else {
      header.style.background = 'rgba(10, 10, 15, 0.85)';
      header.style.boxShadow = 'none';
    }
  }, { passive: true });

  const mobileMenuBtn = header.querySelector('.mobile-menu-btn');
  const nav = header.querySelector('.nav');

  if (mobileMenuBtn && nav) {
    const setMenuState = (isOpen) => {
      nav.classList.toggle('open', isOpen);
      mobileMenuBtn.setAttribute('aria-expanded', String(isOpen));
      document.body.style.overflow = isOpen ? 'hidden' : '';
      mobileMenuBtn.innerHTML = isOpen
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
    };

    mobileMenuBtn.addEventListener('click', () => {
      setMenuState(!nav.classList.contains('open'));
    });

    nav.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => setMenuState(false));
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('open')) setMenuState(false);
    });
  }
}

export function initLayout() {
  initHeader();
  renderHeaderAuth();
  attachHeaderAuthListeners();
  initBackToTop();
  initSmoothScroll();
}

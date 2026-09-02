let toastContainer = null;
let modalStack = [];

function createToastContainer() {
  if (toastContainer) return toastContainer;
  toastContainer = document.createElement('div');
  toastContainer.id = 'toast-container';
  toastContainer.style.cssText = `
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    z-index: 300;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    pointer-events: none;
    max-width: 400px;
  `;
  document.body.appendChild(toastContainer);
  return toastContainer;
}

export function showToast(message, type = 'info', duration = 4000) {
  const container = createToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.style.pointerEvents = 'auto';
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');

  const icons = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  };

  const colors = {
    success: '#22c55e',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#dc143c',
  };

  toast.innerHTML = `
    <div class="toast-icon" style="color: ${colors[type]}; width: 20px; height: 20px; flex-shrink: 0;">${icons[type]}</div>
    <div class="toast-message" style="flex: 1; font-size: 0.875rem; color: var(--color-text);">${message}</div>
    <button class="toast-close" style="color: var(--color-text-muted); padding: 0.25rem; background: none; border: none; cursor: pointer; flex-shrink: 0;" aria-label="Tutup">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;

  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => removeToast(toast));

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.animation = 'slide-in 0.3s ease-out';
  });

  if (duration > 0) {
    setTimeout(() => removeToast(toast), duration);
  }

  return toast;
}

function removeToast(toast) {
  toast.style.animation = 'fade-out 0.2s ease-in forwards';
  toast.addEventListener('animationend', () => toast.remove(), { once: true });
}

export function showSuccess(message, duration) {
  return showToast(message, 'success', duration);
}

export function showError(message, duration) {
  return showToast(message, 'error', duration);
}

export function showWarning(message, duration) {
  return showToast(message, 'warning', duration);
}

export function showInfo(message, duration) {
  return showToast(message, 'info', duration);
}

export function showModal(content, options = {}) {
  const {
    title = '',
    showClose = true,
    closeOnOverlay = true,
    closeOnEscape = true,
    width = '500px',
    onClose = null,
  } = options;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'modal-title');

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.maxWidth = width;

  let headerHtml = '';
  if (title || showClose) {
    headerHtml = `
      <div class="modal-header">
        ${title ? `<h2 class="modal-title" id="modal-title">${title}</h2>` : ''}
        ${showClose ? `
          <button class="modal-close" aria-label="Tutup modal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        ` : ''}
      </div>
    `;
  }

  modal.innerHTML = `
    ${headerHtml}
    <div class="modal-body">${content}</div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const closeModal = () => {
    overlay.style.animation = 'fade-out 0.2s ease-in forwards';
    modal.style.animation = 'slide-up 0.2s ease-in reverse forwards';
    overlay.addEventListener('animationend', () => {
      overlay.remove();
      document.body.style.overflow = '';
      if (onClose) onClose();
    }, { once: true });
    modalStack = modalStack.filter(m => m !== overlay);
  };

  if (showClose) {
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn.addEventListener('click', closeModal);
  }

  if (closeOnOverlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  if (closeOnEscape) {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && modalStack[modalStack.length - 1] === overlay) {
        closeModal();
      }
    };
    document.addEventListener('keydown', handleEscape);
    overlay._escapeHandler = handleEscape;
  }

  modalStack.push(overlay);

  const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusable.length > 0) {
    focusable[0].focus();
  }

  return { close: closeModal, overlay, modal };
}

export function closeModal() {
  if (modalStack.length > 0) {
    const topModal = modalStack[modalStack.length - 1];
    const closeBtn = topModal.querySelector('.modal-close');
    if (closeBtn) closeBtn.click();
  }
}

export function showLoading(message = 'Memuat...') {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.zIndex = '400';
  overlay.innerHTML = `
    <div class="modal" style="max-width: 200px; text-align: center;">
      <div class="modal-body" style="padding: 2rem;">
        <div class="spinner" style="margin: 0 auto 1rem;"></div>
        <p style="color: var(--color-text-muted);">${message}</p>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  return () => {
    overlay.remove();
    document.body.style.overflow = '';
  };
}

export function initScrollReveal() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => {
      el.classList.add('visible');
    });
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px',
  });

  document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => {
    observer.observe(el);
  });

  return observer;
}

export function initBackToTop() {
  const btn = document.querySelector('.back-to-top');
  if (!btn) return;

  const toggleVisibility = () => {
    if (window.scrollY > 300) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  };

  window.addEventListener('scroll', toggleVisibility, { passive: true });
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  toggleVisibility();
}

export function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        const headerOffset = 80;
        const elementPosition = target.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        target.focus({ preventScroll: true });
      }
    });
  });
}

export function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

export function throttle(fn, limit) {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

export function formatCurrency(amount, currency = 'IDR') {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num) {
  return new Intl.NumberFormat('id-ID').format(num);
}

export function formatDateTime(isoString) {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(isoString));
  } catch {
    return '-';
  }
}

export function generateId(prefix = '') {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
}
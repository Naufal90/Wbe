import { initTheme } from './storage.js';
import { initLayout } from './layout.js';
import { initScrollReveal } from './ui.js';
import { initGames } from './games.js';
import { loadProducts, initProductCarousel, destroyCarousel } from './products.js';

function initFAQ() {
  const accordionItems = document.querySelectorAll('.accordion-item');
  accordionItems.forEach(item => {
    const trigger = item.querySelector('.accordion-trigger');
    const content = item.querySelector('.accordion-content');
    if (!trigger || !content) return;

    trigger.addEventListener('click', () => {
      const isOpen = item.classList.toggle('open');
      trigger.setAttribute('aria-expanded', isOpen);
      content.style.maxHeight = isOpen ? `${content.scrollHeight}px` : '0';
    });
  });
}

function initTestimonials() {
  const track = document.querySelector('[data-testimonial-track]');
  if (!track) return;

  const slides = track.querySelectorAll('.testimonial-card');
  const prevBtn = document.querySelector('[data-testimonial-prev]');
  const nextBtn = document.querySelector('[data-testimonial-next]');
  const dotsContainer = document.querySelector('[data-testimonial-dots]');

  if (slides.length <= 1) {
    prevBtn?.remove();
    nextBtn?.remove();
    dotsContainer?.remove();
    return;
  }

  let currentIndex = 0;
  let autoRotateInterval = null;

  function updateCarousel() {
    track.style.transform = `translateX(-${currentIndex * 100}%)`;
    updateDots();
  }

  function updateDots() {
    if (!dotsContainer) return;
    dotsContainer.innerHTML = Array.from({ length: slides.length }, (_, i) => `
      <button class="carousel-dot ${i === currentIndex ? 'active' : ''}" data-dot="${i}" aria-label="Testimoni ${i + 1}"></button>
    `).join('');

    dotsContainer.querySelectorAll('.carousel-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        currentIndex = parseInt(dot.dataset.dot);
        updateCarousel();
        resetAutoRotate();
      });
    });
  }

  function next() {
    currentIndex = (currentIndex + 1) % slides.length;
    updateCarousel();
  }

  function prev() {
    currentIndex = (currentIndex - 1 + slides.length) % slides.length;
    updateCarousel();
  }

  function startAutoRotate() {
    autoRotateInterval = setInterval(next, 5000);
  }

  function stopAutoRotate() {
    if (autoRotateInterval) clearInterval(autoRotateInterval);
  }

  function resetAutoRotate() {
    stopAutoRotate();
    startAutoRotate();
  }

  prevBtn?.addEventListener('click', () => { prev(); resetAutoRotate(); });
  nextBtn?.addEventListener('click', () => { next(); resetAutoRotate(); });

  let touchStartX = 0;
  track.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    stopAutoRotate();
  }, { passive: true });

  track.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) next();
      else prev();
    }
    startAutoRotate();
  }, { passive: true });

  track.addEventListener('mouseenter', stopAutoRotate);
  track.addEventListener('mouseleave', startAutoRotate);

  updateCarousel();
  startAutoRotate();
}

async function initHomepage() {
  initTheme();
  initLayout();
  initScrollReveal();
  initFAQ();
  initTestimonials();

  await loadProducts();
  initProductCarousel();
  initGames();

  const heroContent = document.querySelector('.hero-content');
  if (heroContent) {
    heroContent.style.opacity = '1';
    heroContent.style.transform = 'translateY(0)';
  }

  console.log('Homepage initialized successfully');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHomepage);
} else {
  initHomepage();
}

window.addEventListener('beforeunload', () => {
  destroyCarousel();
});

export { initHomepage };

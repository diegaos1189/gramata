(function () {
  if (window.__distInit) return;
  window.__distInit = true;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  function countUp(el) {
    const target = parseFloat(el.dataset.target || '0');
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const format = (n) => prefix + Math.round(n).toLocaleString('es-CO') + suffix;

    if (reduceMotion) {
      el.textContent = format(target);
      return;
    }

    const duration = 2000;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 4);
      el.textContent = format(target * eased);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.classList.add('is-visible');
        if (el.hasAttribute('data-count')) countUp(el);
        observer.unobserve(el);
      });
    },
    { threshold: 0.2, rootMargin: '0px 0px -40px 0px' }
  );

  function bindTilt(card) {
    if (!finePointer || reduceMotion || card.__tilt) return;
    card.__tilt = true;
    const max = parseFloat(card.dataset.tilt || '8');

    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      card.style.transform = `rotateX(${(0.5 - y) * max}deg) rotateY(${(x - 0.5) * max}deg) translateZ(0)`;
      card.style.setProperty('--mx', `${x * 100}%`);
      card.style.setProperty('--my', `${y * 100}%`);
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  }

  function bindHeroParallax(hero) {
    if (!finePointer || reduceMotion || hero.__parallax) return;
    hero.__parallax = true;
    const stack = hero.querySelector('.dist-hero__stack');
    if (!stack) return;

    hero.addEventListener('mousemove', (e) => {
      const rect = hero.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      stack.style.transform = `rotateY(${x * 14}deg) rotateX(${-y * 10}deg)`;
    });

    hero.addEventListener('mouseleave', () => {
      stack.style.transform = '';
    });
  }

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href="#catalogo"], a[href="#DistCta"]');
    if (!link) return;
    const target =
      link.getAttribute('href') === '#DistCta'
        ? document.getElementById('DistCta')
        : document.querySelector('.featured-collection--premium, .collection');
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  });

  function init(root) {
    root.querySelectorAll('.dist-reveal, [data-count], .dist-process__steps').forEach((el) => observer.observe(el));
    root.querySelectorAll('[data-tilt]').forEach(bindTilt);
    root.querySelectorAll('.dist-hero').forEach(bindHeroParallax);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init(document));
  } else {
    init(document);
  }

  document.addEventListener('shopify:section:load', (e) => init(e.target));
})();

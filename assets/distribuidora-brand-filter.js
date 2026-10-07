(function () {
  if (window.__distBrandFilter) return;
  window.__distBrandFilter = true;

  const SECTION_ID = 'distribuidora-results';
  const cache = new Map();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function skeleton() {
    const cards = Array.from({ length: 5 })
      .map(() => '<div class="dist-results__skeleton"><span></span><i></i><i></i></div>')
      .join('');
    return `<div class="dist-results__skeletons">${cards}</div>`;
  }

  async function loadBrand(url) {
    if (cache.has(url)) return cache.get(url);
    const sep = url.includes('?') ? '&' : '?';
    const response = await fetch(`${url}${sep}section_id=${SECTION_ID}`, { headers: { Accept: 'text/html' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const inner = doc.querySelector('.dist-results__inner');
    if (!inner) throw new Error('Respuesta sin resultados');
    cache.set(url, inner.outerHTML);
    return inner.outerHTML;
  }

  function setActive(section, key) {
    section.querySelectorAll('[data-brand-key]').forEach((link) => {
      const active = key !== null && link.dataset.brandKey === key;
      link.classList.toggle('is-active', active);
      if (!link.hasAttribute('aria-hidden')) link.setAttribute('aria-pressed', String(active));
    });
    section.classList.toggle('is-filtering', key !== null);
  }

  function clear(section) {
    const panel = section.querySelector('[data-brand-results]');
    setActive(section, null);
    section.dataset.activeBrand = '';
    if (panel) {
      panel.classList.remove('is-open');
      panel.hidden = true;
    }
  }

  async function select(section, link) {
    const panel = section.querySelector('[data-brand-results]');
    const body = section.querySelector('[data-brand-results-body]');
    const nameEl = section.querySelector('[data-brand-results-name]');
    if (!panel || !body) return false;

    const key = link.dataset.brandKey;
    if (section.dataset.activeBrand === key) {
      clear(section);
      return true;
    }

    section.dataset.activeBrand = key;
    setActive(section, key);
    if (nameEl) nameEl.textContent = link.dataset.brandName || '';
    body.innerHTML = skeleton();
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add('is-open'));
    panel.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });

    try {
      const html = await loadBrand(link.href);
      if (section.dataset.activeBrand !== key) return true;
      body.innerHTML = html;
    } catch (error) {
      window.location.href = link.href;
    }
    return true;
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-brand-filter] a[data-brand-key]');
    if (!link) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    const section = link.closest('[data-brand-filter]');
    event.preventDefault();
    select(section, link);
  });

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-brand-clear]');
    if (!button) return;
    const section = button.closest('[data-brand-filter]');
    clear(section);
    section.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  });
})();

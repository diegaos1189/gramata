(function () {
  if (typeof subscribe !== 'function' || typeof PUB_SUB_EVENTS === 'undefined') return;

  const CHECK_SVG =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l6 6L20 6"/></svg>';

  subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
    if (event.source !== 'product-form') return;

    document.querySelectorAll('.product-form__submit').forEach((button) => {
      if (!button.querySelector('.product-form__submit-check')) {
        const check = document.createElement('span');
        check.className = 'product-form__submit-check';
        check.innerHTML = `${CHECK_SVG}<span>Agregado</span>`;
        button.appendChild(check);
      }

      button.classList.add('is-added');
      window.setTimeout(() => button.classList.remove('is-added'), 1400);
    });
  });
})();

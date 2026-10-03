class FrequentlyBoughtTogether extends HTMLElement {
  constructor() {
    super();
    this.checkboxes = Array.from(this.querySelectorAll('.frequently-bought-together__checkbox'));
    this.totalPriceEl = this.querySelector('[data-total-price]');
    this.statusEl = this.querySelector('[data-status]');
    this.addButton = this.querySelector('[data-add-all]');

    this.checkboxes.forEach((checkbox) => {
      checkbox.addEventListener('change', this.updateTotal.bind(this));
    });

    this.addButton?.addEventListener('click', this.addAllToCart.bind(this));

    this.updateTotal();
  }

  updateTotal() {
    const cents = this.checkboxes
      .filter((checkbox) => checkbox.checked)
      .reduce((sum, checkbox) => sum + Number(checkbox.dataset.price || 0), 0);

    if (this.totalPriceEl) {
      this.totalPriceEl.textContent = (cents / 100).toLocaleString(document.documentElement.lang || undefined, {
        style: 'currency',
        currency: window.Shopify?.currency?.active || 'USD',
      });
    }
  }

  async addAllToCart() {
    const items = this.checkboxes
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => ({ id: Number(checkbox.dataset.variantId), quantity: 1 }));

    if (items.length === 0) return;

    this.addButton.setAttribute('disabled', 'disabled');
    this.setStatus('', false);

    try {
      const response = await fetch(`${this.dataset.cartAddUrl}.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.description || error.message || 'No se pudo agregar al carrito');
      }

      if (typeof window.refreshDawnCartUI === 'function') {
        await window.refreshDawnCartUI();
      }
      const drawer = document.querySelector('cart-drawer');
      if (drawer && typeof drawer.open === 'function') {
        drawer.open();
      }
      this.setStatus('Agregado al carrito', false);
    } catch (error) {
      this.setStatus(error.message, true);
    } finally {
      this.addButton.removeAttribute('disabled');
    }
  }

  setStatus(message, isError) {
    if (!this.statusEl) return;
    this.statusEl.hidden = !message;
    this.statusEl.textContent = message;
    this.statusEl.toggleAttribute('data-error', Boolean(isError));
  }
}

customElements.define('frequently-bought-together', FrequentlyBoughtTogether);

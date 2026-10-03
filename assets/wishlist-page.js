class WishlistPage extends HTMLElement {
  connectedCallback() {
    this.grid = this.querySelector('[data-wishlist-grid]');
    this.emptyEl = this.querySelector('[data-wishlist-empty]');
    this.render();
    document.addEventListener('wishlist:updated', () => this.render());
  }

  getHandles() {
    try {
      return JSON.parse(localStorage.getItem('wishlist_product_ids')) || [];
    } catch {
      return [];
    }
  }

  async render() {
    const handles = this.getHandles();

    if (handles.length === 0) {
      this.grid.innerHTML = '';
      this.emptyEl.hidden = false;
      return;
    }

    this.emptyEl.hidden = true;

    const products = await Promise.all(
      handles.map((handle) =>
        fetch(`/products/${handle}.js`)
          .then((response) => (response.ok ? response.json() : null))
          .catch(() => null)
      )
    );

    this.grid.innerHTML = products
      .filter(Boolean)
      .map(
        (product) => `
          <li class="grid__item">
            <div class="card-wrapper product-card-wrapper underline-links-hover">
              <a href="/products/${product.handle}" class="wishlist-card">
                ${
                  product.featured_image
                    ? `<img src="${product.featured_image}" width="300" loading="lazy" alt="${product.title}">`
                    : ''
                }
                <p>${product.title}</p>
                <p class="price">${(product.price / 100).toLocaleString(document.documentElement.lang || undefined, {
                  style: 'currency',
                  currency: window.Shopify?.currency?.active || 'USD',
                })}</p>
              </a>
            </div>
          </li>
        `
      )
      .join('');
  }
}

customElements.define('wishlist-page', WishlistPage);

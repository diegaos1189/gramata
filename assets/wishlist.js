const WISHLIST_STORAGE_KEY = 'wishlist_product_ids';

function getWishlist() {
  try {
    return JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function setWishlist(ids) {
  localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(ids));
  document.dispatchEvent(new CustomEvent('wishlist:updated', { detail: { ids } }));
}

class WishlistButton extends HTMLElement {
  connectedCallback() {
    this.button = this.querySelector('.wishlist-button__toggle');
    this.handle = this.dataset.productHandle;
    this.updateState();
    this.button.addEventListener('click', () => this.toggle());
    document.addEventListener('wishlist:updated', () => this.updateState());
  }

  updateState() {
    const isSaved = getWishlist().includes(this.handle);
    this.button.setAttribute('aria-pressed', String(isSaved));
  }

  toggle() {
    const handles = getWishlist();
    const index = handles.indexOf(this.handle);
    if (index === -1) {
      handles.push(this.handle);
    } else {
      handles.splice(index, 1);
    }
    setWishlist(handles);
  }
}

customElements.define('wishlist-button', WishlistButton);

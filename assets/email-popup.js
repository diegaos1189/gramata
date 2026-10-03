class EmailPopup extends HTMLElement {
  static COOKIE_NAME = 'email-popup-dismissed';

  connectedCallback() {
    this.querySelectorAll('[data-popup-close]').forEach((el) =>
      el.addEventListener('click', () => this.close())
    );

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.hidden) this.close();
    });

    const posted = this.querySelector('.email-popup__success');
    if (posted) {
      this.hidden = false;
    } else if (!this.wasDismissed()) {
      const delay = Number(this.dataset.delay || 0);
      this.timer = window.setTimeout(() => this.open(), delay);
    }

    const copyButton = this.querySelector('[data-copy-button]');
    const codeValue = this.querySelector('.email-popup__code-value');
    if (copyButton && codeValue) {
      copyButton.addEventListener('click', () => {
        navigator.clipboard.writeText(codeValue.textContent.trim()).then(() => {
          const label = copyButton.querySelector('[data-copy-label]');
          if (!label) return;
          const original = label.textContent;
          label.textContent = 'Copiado';
          window.setTimeout(() => {
            label.textContent = original;
          }, 2000);
        });
      });
    }
  }

  wasDismissed() {
    return document.cookie.split('; ').some((row) => row.startsWith(`${EmailPopup.COOKIE_NAME}=`));
  }

  open() {
    this.hidden = false;
    document.body.style.overflow = 'hidden';
    this.querySelector('input[type="email"]')?.focus();
  }

  close() {
    this.hidden = true;
    document.body.style.overflow = '';
    const days = Number(this.dataset.cookieDays || 14);
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${EmailPopup.COOKIE_NAME}=1; expires=${expires}; path=/`;
  }
}

customElements.define('email-popup', EmailPopup);

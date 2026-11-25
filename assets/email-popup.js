class EmailPopup extends HTMLElement {
  static COOKIE_NAME = 'email-popup-dismissed';
  static SCROLL_THRESHOLD = 0.5;

  connectedCallback() {
    this.querySelectorAll('[data-popup-close]').forEach((el) =>
      el.addEventListener('click', () => this.close())
    );

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.hidden) this.close();
    });

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

    const posted = this.querySelector('.email-popup__success');
    if (posted) {
      this.open();
      this.setDismissedCookie(3650);
      return;
    }

    if (this.wasDismissed()) return;

    this.minDelay = Number(this.dataset.delay || 0);
    this.readyAt = Date.now() + this.minDelay;
    this.armTriggers();
  }

  armTriggers() {
    this.onScroll = this.onScroll.bind(this);
    this.onMouseOut = this.onMouseOut.bind(this);
    window.addEventListener('scroll', this.onScroll, { passive: true });
    document.addEventListener('mouseout', this.onMouseOut);
  }

  disarmTriggers() {
    window.removeEventListener('scroll', this.onScroll);
    document.removeEventListener('mouseout', this.onMouseOut);
  }

  isReady() {
    return Date.now() >= this.readyAt;
  }

  onScroll() {
    if (!this.isReady()) return;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = scrollable > 0 ? window.scrollY / scrollable : 0;
    if (ratio >= EmailPopup.SCROLL_THRESHOLD) {
      this.disarmTriggers();
      this.open();
    }
  }

  onMouseOut(event) {
    if (!this.isReady()) return;
    if (event.clientY > 0 || event.relatedTarget) return;
    this.disarmTriggers();
    this.open();
  }

  wasDismissed() {
    return document.cookie.split('; ').some((row) => row.startsWith(`${EmailPopup.COOKIE_NAME}=`));
  }

  open() {
    this.hidden = false;
    this.querySelector('input[type="email"]')?.focus();
  }

  close() {
    this.hidden = true;
    this.disarmTriggers();
    const days = Number(this.dataset.cookieDays || 14);
    this.setDismissedCookie(days);
  }

  setDismissedCookie(days) {
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${EmailPopup.COOKIE_NAME}=1; expires=${expires}; path=/`;
  }
}

customElements.define('email-popup', EmailPopup);

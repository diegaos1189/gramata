class RestockNotify extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('[data-restock-form]');
    this.statusEl = this.querySelector('[data-restock-status]');
    this.form?.addEventListener('submit', this.onSubmit.bind(this));
  }

  async onSubmit(event) {
    event.preventDefault();

    const formData = new FormData(this.form);

    if (formData.get('company')) {
      return;
    }

    if (!formData.get('consent')) {
      this.setStatus('Debes aceptar el tratamiento de datos.', true);
      return;
    }

    const email = formData.get('email');
    const webhookUrl = this.dataset.webhookUrl;
    const productId = this.dataset.productId;
    const submitButton = this.form.querySelector('button[type="submit"]');

    submitButton?.setAttribute('disabled', 'disabled');
    this.setStatus('Enviando...', false);

    try {
      const response = await fetch(`${webhookUrl}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, email }),
      });

      if (!response.ok) {
        throw new Error('request_failed');
      }

      this.form.hidden = true;
      this.setStatus('Listo, te avisaremos por correo cuando vuelva a estar disponible.', false);
    } catch (error) {
      this.setStatus('No pudimos guardar tu correo. Intenta de nuevo en un momento.', true);
    } finally {
      submitButton?.removeAttribute('disabled');
    }
  }

  setStatus(message, isError) {
    if (!this.statusEl) return;
    this.statusEl.hidden = !message;
    this.statusEl.textContent = message;
    this.statusEl.toggleAttribute('data-error', Boolean(isError));
  }
}

customElements.define('restock-notify', RestockNotify);

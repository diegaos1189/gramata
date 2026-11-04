(function () {
  if (customElements.get('hero-particles')) return;

  const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const MAX_PARTICLES = 45000;
  const FOV = 900;
  const MAX_DELAY = 0.4;

  function parseColor(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
    const v = m ? parseInt(m[1], 16) : 0x120c0d;
    const r = (v >> 16) & 255;
    const g = (v >> 8) & 255;
    const b = v & 255;
    return { r, g, b, u32: (0xff000000 | (b << 16) | (g << 8) | r) >>> 0 };
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.crossOrigin = 'anonymous';
      im.decoding = 'async';
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = src;
    });
  }

  function waitImg(img) {
    if (img.complete && img.naturalWidth) return Promise.resolve();
    img.loading = 'eager';
    return new Promise((resolve, reject) => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', reject, { once: true });
    });
  }

  class HeroParticles extends HTMLElement {
    connectedCallback() {
      if (this._init) return;
      this._init = true;

      this.stage = this.querySelector('.hp__stage');
      this.canvas = this.querySelector('.hp__canvas');
      this.media = Array.from(this.querySelectorAll('.hp__slide-media'));
      this.contents = Array.from(this.querySelectorAll('.hp__content'));
      this.bars = Array.from(this.querySelectorAll('.hp__bar'));
      this.currentEl = this.querySelector('[data-hp-current]');

      this.count = this.media.length;
      this.index = 0;
      this.busy = false;
      this.duration = Number(this.dataset.duration) || 2200;
      this.baseStep = Number(this.dataset.particle) || 5;
      this.fit = this.dataset.fit === 'contain' ? 'contain' : 'cover';
      this.bg = parseColor(this.dataset.bg);
      this.autoplay = this.dataset.autoplay === 'true' && this.count > 1;
      this.mode = this.dataset.transition || 'page';
      this.particlesOk = this.mode === 'particles' && !!(this.canvas && this.canvas.getContext);
      this.cache = new Map();

      if (this.count < 2) return;

      this.bindControls();
      this.bindGestures();
      this.bindVisibility();
      this.bindEditor();
      if (this.dataset.tilt === 'true') this.bindTilt();

      this.ro = new ResizeObserver(() => this.cache.clear());
      this.ro.observe(this.stage);

      this.setActiveBar(0, true);

      const warm = () => {
        if (this.mode !== 'particles') {
          this.media.forEach((m) => {
            const img = m.querySelector('img');
            if (img) img.loading = 'eager';
          });
          return;
        }
        this.media.forEach((m) => {
          const img = m.querySelector('img');
          if (img) img.loading = 'eager';
        });
        this.sample(0).catch(() => {});
        this.sample(1).catch(() => {});
      };
      if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 2500 });
      else setTimeout(warm, 1200);
    }

    disconnectedCallback() {
      if (this.ro) this.ro.disconnect();
      if (this.io) this.io.disconnect();
      cancelAnimationFrame(this.raf);
    }

    bindControls() {
      const prev = this.querySelector('[data-hp-prev]');
      const next = this.querySelector('[data-hp-next]');
      if (prev) prev.addEventListener('click', () => this.go(this.index - 1, -1));
      if (next) next.addEventListener('click', () => this.go(this.index + 1, 1));

      this.bars.forEach((bar, i) => {
        bar.addEventListener('click', () => this.go(i, i > this.index ? 1 : -1));
        bar.addEventListener('animationend', () => {
          if (i === this.index && this.autoplay) this.go(this.index + 1, 1);
        });
      });

      this.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') this.go(this.index + 1, 1);
        else if (e.key === 'ArrowLeft') this.go(this.index - 1, -1);
      });
    }

    bindGestures() {
      let x0 = null;
      let y0 = 0;
      this.stage.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') return;
        x0 = e.clientX;
        y0 = e.clientY;
      });
      this.stage.addEventListener('pointerup', (e) => {
        if (x0 === null) return;
        const dx = e.clientX - x0;
        const dy = e.clientY - y0;
        x0 = null;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
          const dir = dx < 0 ? 1 : -1;
          this.go(this.index + dir, dir);
        }
      });
    }

    bindVisibility() {
      this.io = new IntersectionObserver(([entry]) => {
        this.classList.toggle('is-offscreen', !entry.isIntersecting);
      });
      this.io.observe(this);
      document.addEventListener('visibilitychange', () => {
        if (this.isConnected) this.classList.toggle('is-hidden-tab', document.hidden);
      });
    }

    bindEditor() {
      document.addEventListener('shopify:block:select', (e) => {
        if (!this.isConnected || !this.contains(e.target)) return;
        const content = e.target.closest('.hp__content');
        const i = this.contents.indexOf(content);
        if (i < 0) return;
        this.autoplay = false;
        this.classList.remove('hp--autoplay');
        this.go(i, i > this.index ? 1 : -1, true);
      });
    }

    bindTilt() {
      if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches || reduceMQ.matches) return;
      this.stage.addEventListener('pointermove', (e) => {
        const r = this.stage.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        this.style.setProperty('--hp-rx', `${(x * 5).toFixed(2)}deg`);
        this.style.setProperty('--hp-ry', `${(-y * 4).toFixed(2)}deg`);
        this.style.setProperty('--hp-px', `${(x * 24).toFixed(1)}px`);
        this.style.setProperty('--hp-py', `${(y * 16).toFixed(1)}px`);
      });
      this.stage.addEventListener('pointerleave', () => {
        ['--hp-rx', '--hp-ry', '--hp-px', '--hp-py'].forEach((p) => this.style.removeProperty(p));
      });
    }

    size() {
      const r = this.stage.getBoundingClientRect();
      return { W: Math.max(1, Math.round(r.width)), H: Math.max(1, Math.round(r.height)) };
    }

    sample(i) {
      const { W, H } = this.size();
      const key = `${i}:${W}x${H}`;
      if (this.cache.has(key)) return this.cache.get(key);
      const promise = this.buildSample(i, W, H);
      this.cache.set(key, promise);
      promise.catch(() => this.cache.delete(key));
      return promise;
    }

    async buildSample(i, W, H) {
      const img = this.media[i].querySelector('img.hp__img');
      if (!img) throw new Error('Slide sin imagen');
      await waitImg(img);
      const im = await loadImage(img.currentSrc || img.src);

      const off = document.createElement('canvas');
      off.width = W;
      off.height = H;
      const c = off.getContext('2d', { willReadFrequently: true });
      const bg = this.bg;
      c.fillStyle = `rgb(${bg.r},${bg.g},${bg.b})`;
      c.fillRect(0, 0, W, H);

      const iw = im.naturalWidth;
      const ih = im.naturalHeight;
      const s = this.fit === 'contain' ? Math.min(W / iw, H / ih) : Math.max(W / iw, H / ih);
      const dw = iw * s;
      const dh = ih * s;
      c.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh);

      const overlay = parseFloat(this.media[i].dataset.overlay || '0');
      if (overlay > 0) {
        c.fillStyle = `rgba(0,0,0,${overlay})`;
        c.fillRect(0, 0, W, H);
      }

      const data = c.getImageData(0, 0, W, H).data;
      const step = Math.max(this.baseStep, Math.ceil(Math.sqrt((W * H) / MAX_PARTICLES)));
      const cols = Math.ceil(W / step);
      const rows = Math.ceil(H / step);
      const n = cols * rows;
      const xs = new Float32Array(n);
      const ys = new Float32Array(n);
      const col = new Uint32Array(n);
      const lum = new Float32Array(n);

      let k = 0;
      for (let r = 0; r < rows; r++) {
        const cy = Math.min(H - 1, (r * step + step / 2) | 0);
        for (let q = 0; q < cols; q++, k++) {
          const cx = Math.min(W - 1, (q * step + step / 2) | 0);
          const o = (cy * W + cx) * 4;
          const R = data[o];
          const G = data[o + 1];
          const B = data[o + 2];
          xs[k] = q * step + step / 2;
          ys[k] = r * step + step / 2;
          col[k] = (0xff000000 | (B << 16) | (G << 8) | R) >>> 0;
          lum[k] = (R * 0.299 + G * 0.587 + B * 0.114) / 255;
        }
      }

      return { W, H, step, n, xs, ys, col, lum };
    }

    async go(target, dir = 1, instant = false) {
      if (this.busy || this.count < 2) return;
      target = (target + this.count) % this.count;
      if (target === this.index) return;

      this.busy = true;
      this.classList.add('is-busy');
      const from = this.index;

      let A = null;
      let B = null;
      if (this.particlesOk && !reduceMQ.matches && !instant) {
        try {
          [A, B] = await Promise.all([this.sample(from), this.sample(target)]);
          if (A.n !== B.n || A.W !== B.W || A.H !== B.H) A = B = null;
        } catch (error) {
          this.particlesOk = false;
          A = B = null;
        }
      }

      this.index = target;
      this.setActiveBar(target, false);
      this.updateCounter();

      if (A) {
        this.runParticles(A, B, from, target, dir);
        return;
      }

      if (!instant && !reduceMQ.matches && this.mode === 'page') {
        this.runPage(from, target, dir);
        return;
      }

      if (!instant && !reduceMQ.matches && this.mode === 'slide') {
        this.runSlide(from, target, dir);
        return;
      }

      this.swapMedia(from, target, instant);
      this.swapContent(from, target, instant ? 0 : 400);
      setTimeout(() => this.finish(), instant ? 50 : 1300);
    }

    runPage(from, to, dir) {
      const duration = this.duration;
      const flip = document.createElement('div');
      flip.className = 'hp__flip';
      flip.dataset.dir = dir > 0 ? 'next' : 'prev';
      flip.style.setProperty('--hp-dur', `${duration}ms`);

      const front = document.createElement('div');
      front.className = 'hp__flip-front';
      Array.from(this.media[from].childNodes).forEach((node) => front.appendChild(node.cloneNode(true)));
      front.querySelectorAll('img').forEach((img) => {
        img.loading = 'eager';
        img.removeAttribute('fetchpriority');
      });

      const back = document.createElement('div');
      back.className = 'hp__flip-back';
      flip.append(front, back);

      const shadow = document.createElement('div');
      shadow.className = 'hp__flip-shadow';
      shadow.dataset.dir = flip.dataset.dir;
      shadow.style.setProperty('--hp-dur', `${duration}ms`);

      const media = this.querySelector('.hp__media');
      media.after(shadow, flip);
      this.swapMedia(from, to, true);
      this.swapContent(from, to, duration * 0.45);

      requestAnimationFrame(() => {
        flip.classList.add('is-turning');
        shadow.classList.add('is-turning');
      });

      const done = () => {
        flip.remove();
        shadow.remove();
        this.finish();
      };
      flip.addEventListener('animationend', done, { once: true });
      setTimeout(() => flip.isConnected && done(), duration + 300);
    }

    runSlide(from, to, dir) {
      const duration = this.duration;
      this.style.setProperty('--hp-dir', String(dir > 0 ? 1 : -1));
      this.style.setProperty('--hp-dur', `${duration}ms`);
      const out = this.media[from];
      const inn = this.media[to];
      this.classList.add('hp--instant');
      out.classList.add('is-leaving');
      inn.classList.add('is-entering');
      this.swapMedia(from, to, true);
      this.swapContent(from, to, duration * 0.4);
      setTimeout(() => {
        out.classList.remove('is-leaving');
        inn.classList.remove('is-entering');
        this.finish();
      }, duration + 50);
    }

    swapMedia(from, to, instant) {
      if (instant) this.classList.add('hp--instant');
      this.media[from].classList.remove('is-active');
      this.media[to].classList.add('is-active');
      if (instant) {
        void this.offsetWidth;
        requestAnimationFrame(() => this.classList.remove('hp--instant'));
      }
    }

    swapContent(from, to, delay) {
      this.contents[from]?.classList.remove('is-active');
      setTimeout(() => this.contents[to]?.classList.add('is-active'), delay);
    }

    runParticles(A, B, from, to, dir) {
      const { W, H, n } = A;
      const canvas = this.canvas;
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
      if (!this.ctx) this.ctx = canvas.getContext('2d');
      if (!this.imageData || this.imageData.width !== W || this.imageData.height !== H) {
        this.imageData = this.ctx.createImageData(W, H);
        this.buf = new Uint32Array(this.imageData.data.buffer);
      }

      const jitter = 0.06;
      const ia = new Uint32Array(n);
      const ib = new Uint32Array(n);
      const ka = new Float32Array(n);
      const kb = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        ia[i] = i;
        ib[i] = i;
        ka[i] = A.lum[i] + Math.random() * jitter;
        kb[i] = B.lum[i] + Math.random() * jitter;
      }
      ia.sort((x, y) => ka[x] - ka[y]);
      ib.sort((x, y) => kb[x] - kb[y]);
      const map = new Uint32Array(n);
      for (let k = 0; k < n; k++) map[ia[k]] = ib[k];

      const delay = new Float32Array(n);
      const ang = new Float32Array(n);
      const rad = new Float32Array(n);
      const zz = new Float32Array(n);
      const diag = Math.hypot(W, H);
      for (let i = 0; i < n; i++) {
        const nx = A.xs[i] / W;
        delay[i] = (dir > 0 ? nx : 1 - nx) * (MAX_DELAY - 0.1) + Math.random() * 0.1;
        ang[i] = Math.random() * Math.PI * 2;
        rad[i] = (0.04 + Math.random() * 0.18) * diag;
        zz[i] = (Math.random() * 2.1 - 0.6) * FOV;
      }

      this.anim = { A, B, map, delay, ang, rad, zz, span: 1 - MAX_DELAY };
      this.renderFrame(0);
      canvas.classList.add('is-visible');

      setTimeout(() => this.swapMedia(from, to, true), 200);
      this.swapContent(from, to, this.duration * 0.5);

      let t0 = null;
      const tick = (now) => {
        if (t0 === null) t0 = now + 200;
        const t = Math.min(1, Math.max(0, (now - t0) / this.duration));
        this.renderFrame(t);
        if (t < 1) {
          this.raf = requestAnimationFrame(tick);
        } else {
          canvas.classList.remove('is-visible');
          setTimeout(() => this.finish(), 400);
        }
      };
      this.raf = requestAnimationFrame(tick);
    }

    renderFrame(t) {
      const { A, B, map, delay, ang, rad, zz, span } = this.anim;
      const buf = this.buf;
      const W = A.W;
      const H = A.H;
      const step = A.step;
      const n = A.n;
      const bg = this.bg.u32;
      const cx = W / 2;
      const cy = H / 2;
      const ax = A.xs;
      const ay = A.ys;
      const bx = B.xs;
      const by = B.ys;
      const ca = A.col;
      const cb = B.col;

      buf.fill(bg);

      for (let i = 0; i < n; i++) {
        const j = map[i];
        const c1 = ca[i];
        const c2 = cb[j];
        if (c1 === bg && c2 === bg) continue;

        let u = (t - delay[i]) / span;
        if (u < 0) u = 0;
        else if (u > 1) u = 1;
        const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
        const lift = Math.sin(Math.PI * u);

        let x = ax[i] + (bx[j] - ax[i]) * e + Math.cos(ang[i]) * rad[i] * lift;
        let y = ay[i] + (by[j] - ay[i]) * e + Math.sin(ang[i]) * rad[i] * lift * 0.55;
        const sc = FOV / (FOV + zz[i] * lift);
        x = cx + (x - cx) * sc;
        y = cy + (y - cy) * sc;

        let s = (step * sc * (1 - 0.45 * lift) + 0.5) | 0;
        if (s < 1) s = 1;

        let color;
        if (e <= 0) {
          color = c1;
        } else if (e >= 1) {
          color = c2;
        } else {
          const glow = lift * 60;
          let r = (c1 & 255) + ((c2 & 255) - (c1 & 255)) * e + glow;
          let g = ((c1 >> 8) & 255) + (((c2 >> 8) & 255) - ((c1 >> 8) & 255)) * e + glow;
          let b = ((c1 >> 16) & 255) + (((c2 >> 16) & 255) - ((c1 >> 16) & 255)) * e + glow;
          if (r > 255) r = 255;
          if (g > 255) g = 255;
          if (b > 255) b = 255;
          color = (0xff000000 | ((b | 0) << 16) | ((g | 0) << 8) | (r | 0)) >>> 0;
        }

        let x0 = Math.floor(x - s / 2);
        let y0 = Math.floor(y - s / 2);
        let x1 = x0 + s;
        let y1 = y0 + s;
        if (x1 <= 0 || y1 <= 0 || x0 >= W || y0 >= H) continue;
        if (x0 < 0) x0 = 0;
        if (y0 < 0) y0 = 0;
        if (x1 > W) x1 = W;
        if (y1 > H) y1 = H;
        for (let yy = y0; yy < y1; yy++) {
          const row = yy * W;
          buf.fill(color, row + x0, row + x1);
        }
      }

      this.ctx.putImageData(this.imageData, 0, 0);
    }

    finish() {
      this.busy = false;
      this.classList.remove('is-busy');
      this.setActiveBar(this.index, true);
    }

    setActiveBar(i, start) {
      this.bars.forEach((bar, k) => {
        bar.classList.toggle('is-done', k < i);
        bar.classList.remove('is-active');
        bar.setAttribute('aria-current', k === i ? 'true' : 'false');
      });
      if (start) {
        const bar = this.bars[i];
        if (bar) {
          void bar.offsetWidth;
          bar.classList.add('is-active');
        }
      }
    }

    updateCounter() {
      if (this.currentEl) this.currentEl.textContent = String(this.index + 1).padStart(2, '0');
    }
  }

  customElements.define('hero-particles', HeroParticles);
})();

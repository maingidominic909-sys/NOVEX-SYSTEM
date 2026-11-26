/* Shared initialiser for editorial portal pages (services, about, contact)
   — fills [data-icon] placeholders and reveals scroll animations. */
(function () {
  const NV = window.NV;

  function hydrateIcons(scope) {
    (scope || document).querySelectorAll('[data-icon]').forEach(el => {
      if (el.dataset.done) return;
      el.dataset.done = '1';
      el.innerHTML = NV.icon(el.dataset.icon);
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    hydrateIcons();
    NV.reveal();

    /* count-up for stat strips */
    document.querySelectorAll('[data-count-to]').forEach(el => {
      const target = Number(el.dataset.countTo);
      const suffix = el.dataset.suffix || '';
      const dur = 1100;
      const start = performance.now();
      const step = now => {
        const p = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });

    /* anchors with data-year */
    document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
  });

  window.NVStatic = { hydrateIcons };
})();

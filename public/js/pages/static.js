/* NORVEX v2 — static pages (services, about, 404): icons, accordions, reveal */
(function () {
  'use strict';
  const NV = window.NV;
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = NV.icon(el.dataset.icon); });
    document.querySelectorAll('.acc-btn').forEach(btn => btn.addEventListener('click', () => btn.closest('.acc-item').classList.toggle('open')));
    NV.reveal();
  });
})();

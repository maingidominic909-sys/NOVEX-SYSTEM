/* NORVEX v2 — contact page */
(function () {
  'use strict';
  const NV = window.NV;
  const E = NV.esc;
  let sent = false;
  const data = { name: '', organisation: '', email: '', phone: '', subject: 'General enquiry', message: '' };

  function validate() {
    let ok = true;
    [['name', v => v.trim().length > 1], ['email', v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())], ['message', v => v.trim().length > 9]]
      .forEach(([k, test]) => {
        const input = document.querySelector(`#contactForm [name="${k}"]`);
        const good = test(String(data[k] || ''));
        input.closest('.field').classList.toggle('bad', !good);
        if (!good) ok = false;
      });
    if (!ok) NV.toast('Complete the highlighted fields.', { type: 'error', title: 'Almost there' });
    return ok;
  }

  async function submit(e) {
    e.preventDefault();
    if (sent || !validate()) return;
    const btn = document.getElementById('contactSend');
    btn.disabled = true; btn.innerHTML = 'Sending…';
    let refNo;
    try { const res = await NV.api('/enquiries', { method: 'POST', body: { type: 'general', ...data } }); refNo = res.enquiry.ref; }
    catch (err) {
      if (err.offline) {
        refNo = NV.ref('ENQ');
        const rows = NV.read('norvex.enquiries.local.v1', []);
        rows.unshift({ ...data, type: 'general', ref: refNo, createdAt: new Date().toISOString(), status: 'new' });
        NV.write('norvex.enquiries.local.v1', rows);
      } else { NV.toast(err.message, { type: 'error', title: 'Not sent' }); btn.disabled = false; btn.innerHTML = `${NV.icon('send')} Send message`; return; }
    }
    sent = true;
    document.getElementById('contactFormCard').innerHTML = `
      <div class="card-body center" style="padding:44px 26px">
        <span class="ok" style="width:64px;height:64px;border-radius:50%;background:var(--green-100);color:var(--green-700);display:grid;place-items:center;margin:0 auto 16px">${NV.icon('check')}</span>
        <h3 class="serif" style="font-size:1.4rem;margin-bottom:8px">Message received</h3>
        <p class="muted small mb-2">Reference <b>${E(refNo)}</b> — our desk replies to ${E(data.email)} within business hours.</p>
        <a class="btn btn-ghost btn-sm" href="https://wa.me/${NV.CONFIG.whatsapp}" target="_blank" rel="noopener">${NV.icon('whatsapp')} Need a faster answer? WhatsApp us</a>
      </div>`;
    NV.toast('Message sent — we reply within business hours.', { title: 'Received' });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const saved = NV.customer.get();
    const user = NV.auth && NV.auth.current();
    Object.keys(data).forEach(k => { if (saved[k]) data[k] = saved[k]; });
    if (user) { data.name = user.name; data.organisation = user.organisation; data.email = user.email; data.phone = user.phone; }
    document.querySelectorAll('#contactForm [name]').forEach(el => {
      if (data[el.name]) el.value = data[el.name];
      el.addEventListener('input', () => { data[el.name] = el.value; el.closest('.field').classList.remove('bad'); });
      el.addEventListener('change', () => { data[el.name] = el.value; });
    });
    document.getElementById('contactForm').addEventListener('submit', submit);
    document.querySelectorAll('.acc-btn').forEach(btn => btn.addEventListener('click', () => btn.closest('.acc-item').classList.toggle('open')));
    NV.reveal();
  });
})();

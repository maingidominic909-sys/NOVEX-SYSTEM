/* Contact page — validated enquiry form posting to /api/enquiries */
(function () {
  const NV = window.NV;

  document.addEventListener('DOMContentLoaded', () => {
    /* hydrate inline icon placeholders */
    document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = NV.icon(el.dataset.icon); });
    NV.reveal();

    /* prefill from saved profile */
    const saved = NV.customer.get();
    const form = document.getElementById('contactForm');
    if (saved.name) form.name.value = saved.name;
    if (saved.organisation) form.organisation.value = saved.organisation;
    if (saved.email) form.email.value = saved.email;
    if (saved.phone) form.phone.value = saved.phone;

    const validate = () => {
      let ok = true;
      form.querySelectorAll('[required]').forEach(input => {
        const field = input.closest('.field') || input.parentElement;
        const empty = input.type === 'checkbox' ? !input.checked : !String(input.value).trim();
        const badEmail = input.type === 'email' && input.value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value);
        const invalid = empty || badEmail;
        if (field.classList.contains('field')) field.classList.toggle('has-error', invalid);
        if (invalid) ok = false;
      });
      return ok;
    };

    form.querySelectorAll('.input, .select, .textarea').forEach(el => {
      el.addEventListener('input', () => el.closest('.field')?.classList.remove('has-error'));
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!validate()) { NV.toast('Please complete the highlighted fields.', { title: 'Check the form', type: 'error' }); return; }
      const btn = document.getElementById('submitBtn');
      const original = btn.innerHTML;
      btn.innerHTML = '<span class="spinner"></span> Sending…';
      btn.classList.add('is-disabled');

      const data = Object.fromEntries(new FormData(form).entries());
      data.type = 'contact';
      data.message = `${data.message}\n\nService: ${data.subject}`;

      try {
        const res = await NV.api('/enquiries', { method: 'POST', body: data });
        NV.customer.save({ name: data.name, organisation: data.organisation, email: data.email, phone: data.phone });
        form.classList.add('hide');
        const success = document.getElementById('contactSuccess');
        success.classList.remove('hide');
        document.getElementById('enqRef').textContent = res.enquiry.ref;
        NV.toast('Our desk has your enquiry and will respond within one working day.', { title: 'Enquiry received' });
      } catch (err) {
        if (err.offline) {
          const local = { ref: NV.ref('ENQ'), ...data };
          const queue = NV.read('norvex.enquiries.local.v1', []);
          queue.unshift({ ...local, createdAt: new Date().toISOString() });
          NV.write('norvex.enquiries.local.v1', queue);
          form.classList.add('hide');
          document.getElementById('contactSuccess').classList.remove('hide');
          document.getElementById('enqRef').textContent = local.ref;
          NV.toast('Saved locally — connect the server to sync enquiries.', { title: 'Enquiry captured' });
        } else {
          NV.toast(err.message, { title: 'Could not send', type: 'error' });
        }
      } finally {
        btn.innerHTML = original;
        btn.classList.remove('is-disabled');
      }
    });

    document.getElementById('sendAnother').addEventListener('click', () => {
      document.getElementById('contactSuccess').classList.add('hide');
      form.reset();
      form.classList.remove('hide');
    });
  });
})();

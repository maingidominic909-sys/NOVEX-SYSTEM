/* =========================================================
   NORVEX PAYMENTS — M-Pesa · Bank transfer · Card · Invoice
   Shared by the basket, checkout, order confirmation and the
   console. Real validation client-side (Luhn, expiry, MSISDN),
   mock settlement server-side (no live keys in this preview).
   ========================================================= */
(function () {
  'use strict';
  const NV = window.NV;
  const E = NV.esc;

  const BUSINESS = {
    paybill: '4168290',
    till: '5231187',
    account: 'your order number',
    bank: {
      name: 'Equity Bank Kenya',
      branch: 'Upper Hill, Nairobi',
      accountName: 'Norvex Integrated Enterprises Ltd',
      accountNo: '0170 2918 4473',
      swift: 'EQBLKENA',
      paybill: '247247'
    }
  };

  const LOGO = {
    mpesa: `<svg viewBox="0 0 48 32" aria-hidden="true"><rect width="48" height="32" rx="6" fill="#2ea94f"/><text x="24" y="21" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="11" font-weight="800" fill="#fff">M-PESA</text></svg>`,
    bank: `<svg viewBox="0 0 48 32" aria-hidden="true"><rect width="48" height="32" rx="6" fill="#0b3d2c"/><path d="M24 7 36 13H12z" fill="#dfbf74"/><path d="M15 15h3v9h-3zm7 0h3v9h-3zm7 0h3v9h-3zM12 26h24v2H12z" fill="#f8f0dc"/></svg>`,
    card: `<svg viewBox="0 0 48 32" aria-hidden="true"><rect width="48" height="32" rx="6" fill="#12233a"/><rect x="6" y="10" width="36" height="5" rx="1.5" fill="#c9a24a"/><rect x="6" y="19" width="12" height="3" rx="1.5" fill="#8fa3bd"/><circle cx="34" cy="21" r="4" fill="#dfbf74" opacity=".85"/><circle cx="38" cy="21" r="4" fill="#e9edf2" opacity=".6"/></svg>`,
    invoice: `<svg viewBox="0 0 48 32" aria-hidden="true"><rect width="48" height="32" rx="6" fill="#f2efe6"/><path d="M17 6h10l4 4v16H17z" fill="#fff" stroke="#c9c6b8"/><path d="M20 14h8M20 18h8M20 22h5" stroke="#8a8778" stroke-width="1.4" stroke-linecap="round"/></svg>`
  };

  const METHODS = [
    {
      id: 'mpesa', name: 'M-Pesa', tagline: 'Paybill, Buy Goods or an STK prompt on your phone', logo: 'mpesa',
      note: 'Instant confirmation. Most buyers settle this way.', eta: 'Instant'
    },
    {
      id: 'bank', name: 'Bank transfer', tagline: 'Equity Bank · RTGS, EFT or Paybill to account', logo: 'bank',
      note: 'Upload or quote the transfer reference and we match it against your order.', eta: 'Same day'
    },
    {
      id: 'card', name: 'Debit / credit card', tagline: 'Visa, Mastercard and prepaid — 3-D Secure', logo: 'card',
      note: 'Secured by 256-bit TLS. We never store your full card number.', eta: 'Instant'
    },
    {
      id: 'invoice', name: 'Invoice / LPO', tagline: '30-day terms for approved institutions', logo: 'invoice',
      note: 'We issue a pro-forma first; dispatch follows LPO approval.', eta: 'On approval'
    }
  ];

  const method = id => METHODS.find(m => m.id === id) || METHODS[0];

  /* ---------------- validation helpers ---------------- */
  const luhn = num => {
    const digits = String(num).replace(/\D/g, '');
    if (digits.length < 12) return false;
    let sum = 0, alt = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let d = Number(digits[i]);
      if (alt) { d *= 2; if (d > 9) d -= 9; }
      sum += d; alt = !alt;
    }
    return sum % 10 === 0;
  };
  const cardBrand = num => {
    const d = String(num).replace(/\D/g, '');
    if (/^4/.test(d)) return 'Visa';
    if (/^(5[1-5]|2[2-7])/.test(d)) return 'Mastercard';
    if (/^3[47]/.test(d)) return 'Amex';
    if (/^(506[01]|5061|6500|6011)/.test(d)) return 'Prepaid';
    return '';
  };
  const expiryOk = val => {
    const m = String(val).match(/^(\d{2})\s*\/\s*(\d{2,4})$/);
    if (!m) return false;
    let mm = Number(m[1]);
    let yy = Number(m[2].length === 2 ? '20' + m[2] : m[2]);
    if (mm < 1 || mm > 12) return false;
    const end = new Date(yy, mm, 1);
    return end > new Date();
  };
  const msisdn = val => {
    const d = String(val).replace(/[^\d]/g, '');
    const norm = d.replace(/^254/, '').replace(/^0/, '');
    return /^(7|1)\d{8}$/.test(norm) ? '254' + norm : '';
  };
  const formatCard = val => String(val).replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();

  /* ---------------- selector ---------------- */
  function selector(current) {
    return `<div class="pay-methods" role="radiogroup" aria-label="Payment method">
      ${METHODS.map(m => `
        <label class="pay-tile ${m.id === current ? 'on' : ''}" data-pay-tile="${m.id}">
          <input type="radio" name="payment" value="${m.id}" ${m.id === current ? 'checked' : ''}>
          <span class="pay-logo">${LOGO[m.logo]}</span>
          <span class="pay-copy">
            <b>${E(m.name)}</b>
            <small>${E(m.tagline)}</small>
          </span>
          <span class="pay-eta">${E(m.eta)}</span>
        </label>`).join('')}
    </div>`;
  }

  /* ---------------- per-method fields ---------------- */
  function fields(id, ctx) {
    const o = ctx || {};
    const amount = o.total != null ? NV.money(o.total) : '';
    const reference = o.ref || 'your order number';

    if (id === 'mpesa') {
      return `<div class="pay-panel" data-pay-panel="mpesa">
        <div class="pay-split">
          <div>
            <p class="field-label">Pay with M-Pesa</p>
            <div class="mpesa-steps">
              <div><span>1</span><p>Open <b>M-Pesa → Lipa na M-Pesa → Pay Bill</b></p></div>
              <div><span>2</span><p>Business number <b>${BUSINESS.paybill}</b>, account <b>${E(reference)}</b></p></div>
              <div><span>3</span><p>Enter <b>${amount || 'your order total'}</b> and confirm</p></div>
            </div>
            <div class="pay-details">
              <div><span>Paybill</span><b>${BUSINESS.paybill}</b></div>
              <div><span>Till (Buy Goods)</span><b>${BUSINESS.till}</b></div>
              <div><span>Account</span><b>${E(reference)}</b></div>
              <div><span>Amount</span><b>${amount || 'See summary'}</b></div>
            </div>
          </div>
          <div>
            <p class="field-label">Or get the prompt on your phone</p>
            <label class="field"><span>M-Pesa number *</span>
              <input class="input" name="mpesaPhone" inputmode="tel" placeholder="07XX XXX XXX" autocomplete="tel-national">
              <span class="field-error">Enter a valid Safaricom number, e.g. 0722 000 000</span>
            </label>
            <button type="button" class="btn btn-ghost btn-sm btn-block" id="stkPush" data-amount="${o.total || 0}">${NV.icon('phone')} Send STK push</button>
            <p class="tiny muted" style="margin-top:10px">You will get a prompt to enter your M-Pesa PIN. Nothing is charged until you confirm on the handset.</p>
            <div class="stk-status" id="stkStatus" hidden></div>
          </div>
        </div>
      </div>`;
    }

    if (id === 'bank') {
      const b = BUSINESS.bank;
      return `<div class="pay-panel" data-pay-panel="bank">
        <div class="pay-split">
          <div>
            <p class="field-label">Norvex bank details</p>
            <div class="pay-details">
              <div><span>Bank</span><b>${b.name}</b></div>
              <div><span>Branch</span><b>${b.branch}</b></div>
              <div><span>Account name</span><b>${b.accountName}</b></div>
              <div><span>Account no.</span><b>${b.accountNo}</b></div>
              <div><span>SWIFT</span><b>${b.swift}</b></div>
              <div><span>M-Pesa paybill</span><b>${b.paybill}</b></div>
            </div>
            <button type="button" class="btn btn-ghost btn-sm" id="copyBank" data-copy="${b.accountNo.replace(/\s/g, '')}" style="margin-top:12px">${NV.icon('file')} Copy account number</button>
          </div>
          <div>
            <p class="field-label">Tell us about the transfer</p>
            <label class="field"><span>Payer bank</span><input class="input" name="bankName" placeholder="Equity, KCB, Co-op, NCBA…"></label>
            <label class="field"><span>Transfer reference *</span><input class="input" name="bankRef" placeholder="e.g. EQ12345678">
              <span class="field-error">Add the reference so we can match your payment</span>
            </label>
            <label class="field"><span>Date paid</span><input class="input" type="date" name="bankDate"></label>
            <p class="tiny muted">Bank transfers are matched within one business hour. Your order is reserved for 48 hours while funds clear.</p>
          </div>
        </div>
      </div>`;
    }

    if (id === 'card') {
      return `<div class="pay-panel" data-pay-panel="card">
        <div class="pay-split">
          <div>
            <p class="field-label">Card details</p>
            <label class="field"><span>Cardholder name *</span><input class="input" name="cardName" autocomplete="cc-name" placeholder="As printed on the card"><span class="field-error">Enter the cardholder name</span></label>
            <label class="field"><span>Card number *</span>
              <input class="input" name="cardNumber" inputmode="numeric" autocomplete="cc-number" placeholder="4242 4242 4242 4242" maxlength="23">
              <span class="field-error">That card number is not valid (Luhn check failed)</span>
            </label>
            <div class="grid-2">
              <label class="field"><span>Expiry *</span><input class="input" name="cardExpiry" inputmode="numeric" autocomplete="cc-exp" placeholder="MM / YY" maxlength="7"><span class="field-error">Check the expiry date</span></label>
              <label class="field"><span>CVV *</span><input class="input" name="cardCvv" inputmode="numeric" autocomplete="cc-csc" placeholder="123" maxlength="4"><span class="field-error">3 or 4 digits</span></label>
            </div>
            <label class="check" style="margin-top:4px"><input type="checkbox" name="cardSave"><span>Save this card securely for future orders (token only — number never stored)</span></label>
          </div>
          <div class="card-visual-wrap">
            <div class="card-visual" id="cardVisual">
              <div class="card-visual-top"><span class="card-chip"></span><span id="cardBrandTag">CARD</span></div>
              <div class="card-number" id="cardNumberView">•••• •••• •••• ••••</div>
              <div class="card-bottom">
                <span><em>Cardholder</em><b id="cardNameView">YOUR NAME</b></span>
                <span><em>Expires</em><b id="cardExpiryView">MM/YY</b></span>
              </div>
            </div>
            <div class="pay-secure">${NV.icon('lock')} <span>3-D Secure · TLS 1.3 · PCI-DSS tokenised</span></div>
            <div class="card-brands">VISA · MASTERCARD · AMEX · PREPAID</div>
          </div>
        </div>
      </div>`;
    }

    return `<div class="pay-panel" data-pay-panel="invoice">
      <div class="pay-split">
        <div>
          <p class="field-label">Invoice on 30-day terms</p>
          <p class="small muted">For government, county, NGO, school and corporate accounts already approved by our credit desk. We issue a pro-forma invoice, then dispatch against your LPO.</p>
          <div class="pay-details">
            <div><span>Terms</span><b>30 days from delivery</b></div>
            <div><span>Required</span><b>Signed LPO or contract</b></div>
            <div><span>Currency</span><b>KES · VAT 16% included</b></div>
          </div>
        </div>
        <div>
          <label class="field"><span>LPO / requisition number</span><input class="input" name="invoiceLpo" placeholder="e.g. LPO/2026/00318"></label>
          <label class="field"><span>Accounts contact email</span><input class="input" type="email" name="invoiceEmail" placeholder="accounts@organisation.go.ke"></label>
          <p class="tiny muted">New accounts: a credit application is emailed to you with the quotation.</p>
        </div>
      </div>
    </div>`;
  }

  /* ---------------- validation ---------------- */
  function validate(id, scope) {
    const root = scope || document;
    const errors = [];
    const fail = (name, message) => {
      errors.push({ name, message });
      const input = root.querySelector(`[name="${name}"]`);
      const field = input && (input.closest('.field') || input.parentElement);
      if (field && field.classList.contains('field')) field.classList.add('has-error');
    };
    const value = name => (root.querySelector(`[name="${name}"]`) || {}).value || '';

    if (id === 'mpesa') {
      const phone = value('mpesaPhone');
      if (phone && !msisdn(phone)) fail('mpesaPhone', 'Enter a valid Safaricom number');
    }
    if (id === 'bank') {
      if (!value('bankRef').trim()) fail('bankRef', 'Transfer reference is required');
    }
    if (id === 'card') {
      if (!value('cardName').trim()) fail('cardName', 'Cardholder name is required');
      if (!luhn(value('cardNumber'))) fail('cardNumber', 'Card number failed validation');
      if (!expiryOk(value('cardExpiry'))) fail('cardExpiry', 'Expiry must be MM / YY in the future');
      if (!/^\d{3,4}$/.test(value('cardCvv'))) fail('cardCvv', 'CVV is 3 or 4 digits');
    }
    return { ok: errors.length === 0, errors };
  }

  /** What we store against the order (never full PAN / CVV). */
  function capture(id, scope) {
    const root = scope || document;
    const value = name => (root.querySelector(`[name="${name}"]`) || {}).value || '';
    const base = { method: id, label: method(id).name, status: id === 'invoice' ? 'awaiting-approval' : 'pending' };
    if (id === 'mpesa') {
      const n = msisdn(value('mpesaPhone'));
      return Object.assign(base, {
        payTo: `Paybill ${BUSINESS.paybill} · Account: your order number`,
        mpesaPhone: n ? '254' + n.slice(3).padStart(9, '0').replace(/^/, '+254').slice(-9) : '',
        phoneMasked: n ? '+254 ' + n.slice(3, 6) + ' *** ' + n.slice(-3) : '',
        note: 'Confirm the STK prompt or pay via Paybill using your order number as the account.'
      });
    }
    if (id === 'bank') {
      return Object.assign(base, {
        bank: BUSINESS.bank,
        payerBank: value('bankName'),
        reference: value('bankRef'),
        paidOn: value('bankDate'),
        note: 'Reserved for 48 hours while the transfer clears.'
      });
    }
    if (id === 'card') {
      const digits = String(value('cardNumber')).replace(/\D/g, '');
      return Object.assign(base, {
        brand: cardBrand(digits),
        last4: digits.slice(-4),
        expiry: value('cardExpiry'),
        token: 'tok_' + Math.random().toString(36).slice(2, 12),
        note: 'Card tokenised — full number never stored.'
      });
    }
    return Object.assign(base, { lpo: value('invoiceLpo'), accountsEmail: value('invoiceEmail') });
  }

  function summary(payment) {
    if (!payment) return 'Payment on confirmation';
    if (payment.method === 'mpesa') return `M-Pesa · Paybill ${BUSINESS.paybill}${payment.phoneMasked ? ' · ' + payment.phoneMasked : ''}`;
    if (payment.method === 'bank') return `Bank transfer · ref ${payment.reference || 'to follow'}`;
    if (payment.method === 'card') return `Card · ${payment.brand || 'card'} ending ${payment.last4 || '····'}`;
    return 'Invoice · 30-day terms';
  }

  /* ---------------- behaviour wiring ---------------- */
  function wire(scope, onChange) {
    const root = scope || document;

    root.querySelectorAll('[data-pay-tile]').forEach(tile => {
      const input = tile.querySelector('input');
      if (!input || tile.dataset.bound) return;
      tile.dataset.bound = '1';
      input.addEventListener('change', () => {
        root.querySelectorAll('[data-pay-tile]').forEach(t => t.classList.toggle('on', t === tile));
        paintPanels(root, input.value);
        if (typeof onChange === 'function') onChange(input.value);
      });
    });

    /* card visual sync */
    const num = root.querySelector('[name="cardNumber"]');
    if (num && !num.dataset.bound) {
      num.dataset.bound = '1';
      num.addEventListener('input', () => {
        const raw = num.value.replace(/\D/g, '');
        num.value = formatCard(raw);
        const view = document.getElementById('cardNumberView');
        if (view) view.textContent = (num.value + ' •••• •••• ••••').slice(0, 19) || '•••• •••• •••• ••••';
        const tag = document.getElementById('cardBrandTag');
        if (tag) tag.textContent = cardBrand(raw) || 'CARD';
      });
    }
    const nm = root.querySelector('[name="cardName"]');
    if (nm && !nm.dataset.bound) {
      nm.dataset.bound = '1';
      nm.addEventListener('input', () => {
        const v = document.getElementById('cardNameView');
        if (v) v.textContent = nm.value.toUpperCase() || 'YOUR NAME';
      });
    }
    const ex = root.querySelector('[name="cardExpiry"]');
    if (ex && !ex.dataset.bound) {
      ex.dataset.bound = '1';
      ex.addEventListener('input', () => {
        let d = ex.value.replace(/\D/g, '').slice(0, 4);
        if (d.length > 2) d = d.slice(0, 2) + ' / ' + d.slice(2);
        ex.value = d;
        const v = document.getElementById('cardExpiryView');
        if (v) v.textContent = d.replace(/\s/g, '') || 'MM/YY';
      });
    }

    /* copy bank account */
    const copyBtn = root.querySelector('#copyBank');
    if (copyBtn && !copyBtn.dataset.bound) {
      copyBtn.dataset.bound = '1';
      copyBtn.addEventListener('click', async () => {
        const value = copyBtn.dataset.copy;
        try { await navigator.clipboard.writeText(value); NV.toast('Account number copied.', { title: 'Copied' }); }
        catch (e) { NV.toast('Account: ' + value, { title: 'Copy manually' }); }
      });
    }

    /* STK push simulation */
    const stk = root.querySelector('#stkPush');
    if (stk && !stk.dataset.bound) {
      stk.dataset.bound = '1';
      stk.addEventListener('click', () => stkPush(root, stk));
    }
  }

  function paintPanels(root, id) {
    root.querySelectorAll('[data-pay-panel]').forEach(p => p.classList.toggle('hide', p.dataset.payPanel !== id));
  }

  function stkPush(root, btn) {
    const phone = (root.querySelector('[name="mpesaPhone"]') || {}).value || '';
    const status = root.querySelector('#stkStatus');
    const norm = msisdn(phone);
    if (!norm) {
      const field = root.querySelector('[name="mpesaPhone"]');
      if (field) field.closest('.field').classList.add('has-error');
      NV.toast('Enter a valid Safaricom number to receive the prompt.', { title: 'Check the number', type: 'error' });
      return;
    }
    if (status) {
      status.hidden = false;
      status.className = 'stk-status pending';
      status.innerHTML = `<span class="spinner spinner-dark"></span> <span>Request sent to +254 ${norm.slice(3, 6)} ${norm.slice(6, 9)} ${norm.slice(9)}… enter your M-Pesa PIN on the handset.</span>`;
    }
    const original = btn.innerHTML;
    btn.classList.add('is-disabled');
    btn.innerHTML = '<span class="spinner spinner-dark"></span> Waiting for confirmation';

    setTimeout(() => {
      const code = 'Q' + Math.random().toString(36).slice(2, 9).toUpperCase();
      if (status) {
        status.className = 'stk-status ok';
        status.innerHTML = `${NV.icon('check')} <span><b>Confirmed</b> — M-Pesa receipt <b class="mono">${code}</b>. Your order is paid and queued for dispatch.</span>`;
      }
      btn.classList.remove('is-disabled');
      btn.innerHTML = original;
      root.dataset.mpesaReceipt = code;
      document.dispatchEvent(new CustomEvent('payment:paid', { detail: { method: 'mpesa', receipt: code } }));
      NV.toast('M-Pesa payment confirmed · receipt ' + code, { title: 'Payment received' });
    }, 1600);
  }

  window.NVPay = { BUSINESS, LOGO, METHODS, method, luhn, cardBrand, expiryOk, msisdn, formatCard, selector, fields, validate, capture, summary, wire, paintPanels };
})();

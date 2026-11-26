/* =========================================================
   NORVEX COOKIE & PRIVACY CONTROL
   • consent banner (first visit) + preferences dialog
   • essential cookies always on, analytics & marketing opt-in
   • the API sets the session cookie HttpOnly/Secure/SameSite;
     the client only ever handles the non-sensitive consent flag
   ========================================================= */
(function () {
  'use strict';
  const NV = window.NV;
  const KEY = 'norvex.consent.v1';
  const COOKIE = 'nv_consent';

  const DEFAULTS = { essential: true, analytics: false, marketing: false, ts: null, version: 1 };

  const state = { data: null, hasChoice: false };

  function readStored() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* storage blocked — fall through to cookie */ }
    const m = document.cookie.match(new RegExp('(?:^|; )' + COOKIE + '=([^;]*)'));
    if (m) { try { return JSON.parse(decodeURIComponent(m[1])); } catch (e) { return null; } }
    return null;
  }

  function load() {
    const stored = readStored();
    if (stored && stored.version === 1 && stored.ts) {
      state.data = Object.assign({}, DEFAULTS, stored);
      state.hasChoice = true;
    } else {
      state.data = Object.assign({}, DEFAULTS);
      state.hasChoice = false;
    }
    return state.data;
  }

  function persist(data) {
    const payload = Object.assign({}, data, { essential: true, ts: new Date().toISOString(), version: 1 });
    state.data = payload;
    state.hasChoice = true;
    try { localStorage.setItem(KEY, JSON.stringify(payload)); } catch (e) { /* ignore */ }
    try {
      /* flag only — never personal data; 6 months, Lax, Secure where available */
      const secure = location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = COOKIE + '=' + encodeURIComponent(JSON.stringify({ a: payload.analytics ? 1 : 0, m: payload.marketing ? 1 : 0 })) +
        '; Max-Age=15552000; Path=/; SameSite=Lax' + secure;
    } catch (e) { /* ignore */ }
    document.dispatchEvent(new CustomEvent('consent:change', { detail: payload }));
    return payload;
  }

  /* ---------------- markup ---------------- */
  const BANNER = `
  <div class="cookie-bar" id="cookieBar" role="dialog" aria-live="polite" aria-label="Cookie preferences">
    <div class="cookie-bar-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M12 3a9 9 0 1 0 9 9 3.6 3.6 0 0 1-4.6-3.4A3.6 3.6 0 0 1 12 3Z"/><circle cx="9" cy="10" r=".8" fill="currentColor"/><circle cx="13" cy="14" r=".8" fill="currentColor"/><circle cx="8.5" cy="15" r=".8" fill="currentColor"/></svg>
    </div>
    <div class="cookie-bar-copy">
      <strong>Privacy &amp; cookies</strong>
      <p>We use essential cookies to run your basket and secure session. Analytics cookies — only if you allow them — help us see which departments buyers need most. <a href="#" data-cookie-open>Read the details</a>.</p>
    </div>
    <div class="cookie-bar-actions">
      <button type="button" class="btn btn-ghost btn-sm" data-cookie="essential">Essential only</button>
      <button type="button" class="btn btn-ghost btn-sm" data-cookie-open>Preferences</button>
      <button type="button" class="btn btn-gold btn-sm" data-cookie="all">Accept all</button>
    </div>
  </div>`;

  const PREFS = `
  <dialog class="modal cookie-modal" id="cookieModal" aria-label="Cookie preferences">
    <div class="modal-head">
      <div>
        <p class="label-xs" style="margin-bottom:4px">Privacy centre</p>
        <h3 style="margin:0;font-size:1.25rem">Cookie preferences</h3>
      </div>
      <button class="icon-btn" data-cookie-close aria-label="Close">${NV.icon ? NV.icon('close') : '×'}</button>
    </div>
    <div class="modal-body">
      <p class="small muted" style="margin-bottom:20px">You can change these at any time. Essential cookies cannot be switched off — without them the basket and secure checkout session would not work.</p>

      <div class="cookie-row">
        <div>
          <strong>Essential <span class="pill pill-soft" style="margin-left:6px">Always on</span></strong>
          <p>Session cookie (<code>nv_session</code>) set <b>HttpOnly, Secure, SameSite=Lax</b>, plus local basket storage. Keeps you signed in during checkout.</p>
        </div>
        <span class="switch"><input type="checkbox" checked disabled aria-label="Essential cookies, always on"><span></span></span>
      </div>

      <div class="cookie-row">
        <div>
          <strong>Analytics</strong>
          <p>Anonymous page and department interest counts so we stock the right things. No personal data leaves Kenya.</p>
        </div>
        <span class="switch"><input type="checkbox" data-pref="analytics" aria-label="Analytics cookies"><span></span></span>
      </div>

      <div class="cookie-row">
        <div>
          <strong>Marketing</strong>
          <p>Tender alerts and re-order reminders. Off by default — we will never sell your contact list.</p>
        </div>
        <span class="switch"><input type="checkbox" data-pref="marketing" aria-label="Marketing cookies"><span></span></span>
      </div>

      <div class="cookie-note">
        ${NV.icon ? NV.icon('lock') : ''}
        <span><b>How we secure sessions:</b> the Norvex API issues the session cookie with <code>HttpOnly</code> (invisible to scripts), <code>Secure</code> (HTTPS only) and <code>SameSite=Lax</code> (blocks cross-site forgery). Consent flags are the only cookies your browser lets our scripts read.</span>
      </div>
    </div>
    <div class="modal-foot">
      <button type="button" class="btn btn-ghost btn-sm" data-cookie="essential">Essential only</button>
      <button type="button" class="btn btn-gold btn-sm" data-cookie-save>Save preferences</button>
    </div>
  </dialog>`;

  /* ---------------- wiring ---------------- */
  function mount() {
    if (document.getElementById('cookieBar') || document.querySelector('[data-nvcookies]')) return;
    load();

    const wrap = document.createElement('div');
    wrap.setAttribute('data-nvcookies', '1');
    wrap.innerHTML = BANNER + PREFS;
    document.body.appendChild(wrap);

    const bar = document.getElementById('cookieBar');
    const modal = document.getElementById('cookieModal');
    if (!state.hasChoice) { requestAnimationFrame(() => bar.classList.add('show')); }
    else { bar.remove(); }

    const dismiss = () => { bar.classList.remove('show'); setTimeout(() => bar.remove(), 400); };

    wrap.querySelectorAll('[data-cookie-open]').forEach(el => el.addEventListener('click', e => {
      e.preventDefault();
      modal.querySelectorAll('[data-pref]').forEach(input => { input.checked = !!state.data[input.dataset.pref]; });
      if (modal.showModal) modal.showModal(); else modal.setAttribute('open', '');
    }));
    wrap.querySelectorAll('[data-cookie-close]').forEach(el => el.addEventListener('click', () => { if (modal.close) modal.close(); else modal.removeAttribute('open'); }));

    wrap.querySelectorAll('[data-cookie]').forEach(btn => btn.addEventListener('click', () => {
      const choice = btn.dataset.cookie;
      persist(choice === 'all' ? { essential: true, analytics: true, marketing: true }
                              : { essential: true, analytics: false, marketing: false });
      if (modal.open) modal.close();
      dismiss();
      NV.toast && NV.toast(choice === 'all' ? 'All cookies accepted. Thank you.' : 'Only essential cookies are active.', { title: 'Preferences saved' });
    }));

    const saveBtn = wrap.querySelector('[data-cookie-save]');
    if (saveBtn) saveBtn.addEventListener('click', () => {
      const pick = { essential: true };
      modal.querySelectorAll('[data-pref]').forEach(input => { pick[input.dataset.pref] = input.checked; });
      persist(pick);
      if (modal.close) modal.close();
      dismiss();
      NV.toast && NV.toast('Your cookie preferences have been updated.', { title: 'Preferences saved' });
    });

    /* re-open from footer / any [data-cookie-open] button anywhere on the page */
    document.addEventListener('click', e => {
      const trigger = e.target.closest('[data-cookie-open]');
      if (!trigger || wrap.contains(trigger)) return;
      e.preventDefault();
      modal.querySelectorAll('[data-pref]').forEach(input => { input.checked = !!state.data[input.dataset.pref]; });
      if (modal.showModal) modal.showModal(); else modal.setAttribute('open', '');
    });
  }

  window.NVCookies = {
    mount,
    get: () => state.data || load(),
    hasChoice: () => state.hasChoice,
    open() { const m = document.getElementById('cookieModal'); if (m && m.showModal) m.showModal(); },
    reset() { try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); },
    /** gate any non-essential script on consent */
    allow(kind) { return kind === 'essential' || !!(state.data || load())[kind]; }
  };
  document.addEventListener('DOMContentLoaded', () => { load(); });
})();

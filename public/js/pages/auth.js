/* NORVEX v2 — sign in / create account panel */
(function () {
  'use strict';
  const NV = window.NV;
  const A = NV.auth;
  let mode = 'signin', busy = false;

  const $ = sel => document.querySelector(sel);
  const form = () => $('#authForm');
  const field = name => form().querySelector(`[data-field="${name}"]`);
  const input = name => form().querySelector(`[name="${name}"]`);

  function setMode(next, focus) {
    mode = next === 'signup' ? 'signup' : 'signin';
    $('#authSeg').dataset.mode = mode;
    form().dataset.mode = mode;
    document.querySelectorAll('#authSeg [role="tab"]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === mode)));
    $('#authTitle').textContent = mode === 'signup' ? 'Create your trade account' : 'Welcome back';
    $('#authSub').textContent = mode === 'signup'
      ? 'One minute to set up — then every order, quote and delivery lives in one place.'
      : 'Sign in to your trade account. Browsing the catalogue stays open to everyone.';
    $('#authSubmitLabel').textContent = mode === 'signup' ? 'Create my account' : 'Sign in to my account';
    input('password').setAttribute('autocomplete', mode === 'signup' ? 'new-password' : 'current-password');
    $('#pwMeter').style.display = mode === 'signup' ? 'flex' : 'none';
    $('#termsRow').style.display = mode === 'signup' ? 'flex' : 'none';
    hideNote();
    clearMarks();
    if (focus) {
      const first = input(mode === 'signup' ? 'name' : 'identifier');
      if (first) setTimeout(() => first.focus({ preventScroll: true }), 80);
    }
  }

  function mark(name, ok, msg) {
    const f = field(name);
    if (!f) return;
    f.classList.toggle('ok', ok === true);
    f.classList.toggle('bad', ok === false);
    if (msg) { const err = f.querySelector('.auth-err'); if (err) err.textContent = msg; }
  }
  function clearMarks() {
    form().querySelectorAll('.auth-field').forEach(f => f.classList.remove('ok', 'bad'));
  }
  function showNote(msg, type) {
    const n = $('#authNote');
    n.className = 'auth-note show ' + (type || 'error');
    n.innerHTML = `${NV.icon(type === 'ok' ? 'check' : 'warning')} <span>${NV.esc(msg)}</span>`;
  }
  function hideNote() { $('#authNote').className = 'auth-note'; }

  const checks = {
    identifier: v => v.trim().length >= 3 || 'Enter the email, phone or username on your account.',
    name: v => v.trim().length >= 2 || 'Tell us who we are quoting.',
    organisation: v => v.trim().length >= 2 || 'Organisation or institution name is required.',
    email: v => A.emailOk(v) || 'That email does not look right.',
    phone: v => A.phoneOk(v) || 'Kenyan mobile, e.g. 0712 345 678.',
    username: v => A.usernameOk(v) || '3–20 characters: letters, numbers, dot, dash or underscore.',
    password: v => mode === 'signin'
      ? (v.length > 0 || 'Enter your password.')
      : (v.length >= 8 && /[a-z]/i.test(v) && /\d/.test(v) || 'At least 8 characters with letters and a number.'),
    confirm: v => v === input('password').value || 'Passwords do not match.'
  };
  function checkField(name) {
    const el = input(name);
    if (!el) return true;
    const res = checks[name] ? checks[name](el.value) : true;
    if (res === true) { mark(name, el.value ? true : null); return true; }
    mark(name, false, res);
    return false;
  }

  /* Animated logistics scene: trucks passing through + crew loading goods.
     Pure SVG + CSS keyframes, no external assets. Injected into every
     [data-auth-scene] mount (brand stage on desktop, card banner on phone). */
  const WHEEL = '<circle r="12" class="tyre"/><circle r="4.5" class="hub"/><path d="M-8 0H8M0 -8V8" class="spoke"/>';
  const SCENE_SVG = `
  <svg viewBox="0 0 720 250" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Norvex logistics — trucks passing through while the crew loads goods">
    <g class="sc-bg">
      <rect x="24" y="78" width="150" height="104" rx="4"/>
      <path d="M24 78 99 52 174 78" class="roof"/>
      <rect x="58" y="120" width="34" height="62" class="door"/>
      <rect x="112" y="104" width="26" height="20" class="win"/>
      <rect x="555" y="96" width="140" height="86" rx="4"/>
      <path d="M555 96 625 74 695 96" class="roof"/>
      <rect x="600" y="128" width="30" height="54" class="door"/>
      <circle cx="300" cy="40" r="1.6"/><circle cx="420" cy="26" r="1.3"/><circle cx="520" cy="48" r="1.6"/><circle cx="240" cy="24" r="1.2"/>
    </g>

    <line x1="0" y1="150" x2="720" y2="150" class="sc-farroad"/>
    <line x1="0" y1="150" x2="720" y2="150" class="sc-dash"/>

    <!-- passing truck A: box truck -->
    <g class="pass-truck a"><g transform="translate(0,88) scale(0.62)">
      <rect x="0" y="10" width="120" height="52" rx="6" class="sc-cargo"/>
      <rect x="0" y="34" width="120" height="7" class="sc-stripe"/>
      <text x="14" y="28" class="sc-brand">NORVEX</text>
      <path d="M120 22h34l16 18v22h-50z" class="sc-cab"/>
      <rect x="126" y="26" width="22" height="14" rx="3" class="sc-window"/>
      <rect x="166" y="48" width="8" height="6" rx="2" class="sc-light"/>
      <g transform="translate(28,66)"><g class="wheel">${WHEEL}</g></g>
      <g transform="translate(96,66)"><g class="wheel">${WHEEL}</g></g>
      <g transform="translate(146,66)"><g class="wheel">${WHEEL}</g></g>
    </g></g>

    <!-- passing truck B: flatbed with sacks -->
    <g class="pass-truck b"><g transform="translate(0,102) scale(0.5)">
      <rect x="0" y="34" width="130" height="10" rx="3" class="sc-bed"/>
      <ellipse cx="28" cy="24" rx="18" ry="13" class="sc-sack"/>
      <ellipse cx="64" cy="22" rx="17" ry="14" class="sc-sack"/>
      <rect x="88" y="12" width="30" height="24" rx="3" class="sc-box"/>
      <path d="M130 16h30l16 18v20h-46z" class="sc-cab"/>
      <rect x="136" y="20" width="20" height="13" rx="3" class="sc-window"/>
      <rect x="172" y="42" width="7" height="6" rx="2" class="sc-light"/>
      <g transform="translate(26,52)"><g class="wheel">${WHEEL}</g></g>
      <g transform="translate(96,52)"><g class="wheel">${WHEEL}</g></g>
      <g transform="translate(150,52)"><g class="wheel">${WHEEL}</g></g>
    </g></g>

    <!-- near road -->
    <line x1="0" y1="228" x2="720" y2="228" class="sc-road"/>

    <!-- dolly with sacks -->
    <g transform="translate(96,226)">
      <path d="M0 0 10 -46M0 0h16" class="sc-frame"/>
      <circle cx="4" cy="2" r="6" class="tyre"/>
      <ellipse cx="18" cy="-13" rx="12" ry="9" class="sc-sack"/>
      <ellipse cx="22" cy="-29" rx="11" ry="8" class="sc-sack"/>
    </g>

    <!-- box stack -->
    <g class="stack">
      <rect x="140" y="196" width="34" height="32" rx="3" class="sc-box"/>
      <rect x="176" y="196" width="34" height="32" rx="3" class="sc-box"/>
      <path d="M157 196v32M193 196v32" class="sc-tape"/>
      <g class="top"><rect x="158" y="164" width="34" height="32" rx="3" class="sc-box"/><path d="M175 164v32" class="sc-tape"/></g>
    </g>

    <!-- worker 1: at the stack -->
    <g class="loader l1" transform="translate(252,228)"><g class="bob">
      <circle cx="0" cy="-44" r="7" class="sc-head"/>
      <path d="M-7 -36h14l3 20h-20z" class="sc-shirt"/>
      <rect x="-6" y="-16" width="5" height="16" rx="2" class="sc-leg"/>
      <rect x="1" y="-16" width="5" height="16" rx="2" class="sc-leg"/>
      <path d="M6 -32 20 -24" class="sc-arm"/>
      <path d="M-6 -32 -14 -22" class="sc-arm"/>
      <circle cx="20" cy="-24" r="2.5" class="sc-head"/>
    </g></g>

    <!-- parked flatbed being loaded -->
    <g class="parked">
      <rect x="368" y="186" width="210" height="12" rx="3" class="sc-bed"/>
      <rect x="368" y="160" width="6" height="30" class="sc-rail"/>
      <rect x="572" y="160" width="6" height="30" class="sc-rail"/>
      <path d="M578 150h44l20 24v24h-64z" class="sc-cab"/>
      <rect x="584" y="156" width="26" height="16" rx="3" class="sc-window"/>
      <rect x="638" y="184" width="9" height="7" rx="2" class="sc-light"/>
      <rect x="368" y="198" width="274" height="6" rx="3" class="sc-chassis"/>
      <g transform="translate(400,212)"><circle r="15" class="tyre"/><circle r="5" class="hub"/><path d="M-9 0H9M0 -9V9" class="spoke"/></g>
      <g transform="translate(470,212)"><circle r="15" class="tyre"/><circle r="5" class="hub"/><path d="M-9 0H9M0 -9V9" class="spoke"/></g>
      <g transform="translate(610,212)"><circle r="15" class="tyre"/><circle r="5" class="hub"/><path d="M-9 0H9M0 -9V9" class="spoke"/></g>
      <g class="bed-box"><rect x="386" y="154" width="34" height="32" rx="3" class="sc-box"/><path d="M403 154v32" class="sc-tape"/></g>
      <g class="bed-box"><rect x="424" y="154" width="34" height="32" rx="3" class="sc-box"/><path d="M441 154v32" class="sc-tape"/></g>
    </g>

    <!-- worker 2: on the bed, receiving -->
    <g class="loader l2" transform="translate(524,186)"><g class="bob">
      <circle cx="0" cy="-44" r="7" class="sc-head"/>
      <path d="M-7 -36h14l3 20h-20z" class="sc-shirt"/>
      <rect x="-6" y="-16" width="5" height="16" rx="2" class="sc-leg"/>
      <rect x="1" y="-16" width="5" height="16" rx="2" class="sc-leg"/>
      <path d="M-6 -32 -20 -26" class="sc-arm"/>
      <path d="M6 -32 14 -22" class="sc-arm"/>
      <circle cx="-20" cy="-26" r="2.5" class="sc-head"/>
    </g></g>

    <!-- the box being carried: stack -> worker -> truck bed -->
    <g class="carry-box"><rect x="-15" y="-13" width="30" height="26" rx="3" class="sc-box"/><path d="M0 -13v26" class="sc-tape"/></g>
  </svg>`;

  function wire() {
    document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = NV.icon(el.dataset.icon); });
    document.querySelectorAll('[data-auth-scene]').forEach(el => { el.innerHTML = SCENE_SVG; });

    /* tabs */
    document.querySelectorAll('#authSeg [role="tab"]').forEach(btn => {
      btn.addEventListener('click', () => setMode(btn.dataset.tab, true));
      btn.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setMode(mode === 'signin' ? 'signup' : 'signin', true); }
      });
    });

    /* live validation */
    ['identifier', 'name', 'organisation', 'email', 'phone', 'username', 'password', 'confirm'].forEach(name => {
      const el = input(name);
      if (!el) return;
      el.addEventListener('blur', () => { if (el.value) checkField(name); });
      el.addEventListener('input', () => {
        const f = field(name);
        if (f && f.classList.contains('bad')) checkField(name);
        hideNote();
        if (name === 'password' && mode === 'signup') {
          const s = A.strength(el.value);
          $('#pwMeterFill').style.width = s.pct + '%';
          $('#pwMeterLabel').textContent = el.value ? s.label : '';
          $('#pwMeterFill').style.background = s.score >= 4 ? 'var(--green-600)' : s.score >= 3 ? 'var(--gold-500)' : 'var(--red-600)';
        }
      });
    });

    /* password visibility */
    document.querySelectorAll('[data-pw-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = input(btn.dataset.pwToggle);
        const show = target.type === 'password';
        target.type = show ? 'text' : 'password';
        btn.innerHTML = NV.icon(show ? 'eye' : 'lock');
        btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        target.focus();
      });
    });

    /* demo fill */
    document.querySelectorAll('[data-demo]').forEach(btn => btn.addEventListener('click', () => {
      setMode('signin');
      input('identifier').value = btn.dataset.demo === 'admin' ? 'admin@norvex.co.ke' : 'demo@norvex.co.ke';
      input('password').value = 'Norvex2026';
      mark('identifier', true); mark('password', true);
      showNote('Demo credentials filled — press “Sign in to my account”.', 'ok');
      $('#authSubmit').focus();
    }));

    form().addEventListener('submit', onSubmit);

    const q = NV.queryString();
    setMode(q.get('mode') === 'signup' ? 'signup' : 'signin');
    if (A.isIn()) {
      const u = A.current();
      showNote(`You are already signed in as ${u.name}. Taking you to your order desk…`, 'ok');
      setTimeout(() => A.go(returnPath()), 1100);
    }
  }

  function returnPath() {
    const q = NV.queryString();
    return q.get('next') || A.takeReturn('/desk.html');
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    clearMarks(); hideNote();
    const names = mode === 'signup'
      ? ['name', 'organisation', 'email', 'phone', 'username', 'password', 'confirm']
      : ['identifier', 'password'];
    let ok = true;
    names.forEach(n => { if (!checkField(n)) ok = false; });
    if (mode === 'signup' && !$('#termsCheck').checked) {
      showNote('Please accept the supply terms to create an account.');
      ok = false;
    }
    if (!ok) {
      const firstBad = form().querySelector('.auth-field.bad .auth-input');
      if (firstBad) firstBad.focus();
      return;
    }
    busy = true;
    const btn = $('#authSubmit');
    btn.disabled = true;
    $('#authSubmitLabel').textContent = mode === 'signup' ? 'Creating your account…' : 'Signing you in…';
    btn.querySelector('.spinner').style.display = 'block';

    let res;
    if (mode === 'signup') {
      res = await A.signUp({
        name: input('name').value, organisation: input('organisation').value,
        email: input('email').value, phone: input('phone').value,
        username: input('username').value, password: input('password').value, confirm: input('confirm').value
      });
      if (!res.ok && res.errors) {
        Object.entries(res.errors).forEach(([k, msg]) => mark(k, false, msg));
        showNote('Check the highlighted fields and try again.');
      }
    } else {
      res = await A.signIn(input('identifier').value, input('password').value);
      if (!res.ok) showNote(res.error || 'Could not sign in.');
    }

    btn.disabled = false;
    btn.querySelector('.spinner').style.display = 'none';
    busy = false;
    if (!res.ok) { $('#authSubmitLabel').textContent = mode === 'signup' ? 'Create my account' : 'Sign in to my account'; return; }

    /* success state, then redirect */
    const u = res.user;
    $('#authCardInner').style.display = 'none';
    const s = $('#authSuccess');
    s.classList.add('show');
    s.innerHTML = `
      <span class="ok">${NV.icon('check')}</span>
      <h2 class="serif">${mode === 'signup' ? 'Account created' : 'Signed in'} — karibu, ${NV.esc(u.name.split(' ')[0])}.</h2>
      <p>${NV.esc(u.organisation)}${u.role === 'admin' ? ' · administrator' : ''}<br>Taking you to ${NV.esc(returnPath() === '/desk.html' ? 'your order desk' : 'where you left off')}…</p>`;
    NV.toast(mode === 'signup' ? 'Trade account created. Welcome to Norvex.' : `Welcome back, ${u.name.split(' ')[0]}.`, { title: 'Signed in' });
    setTimeout(() => A.go(returnPath()), 1000);
  }

  document.addEventListener('DOMContentLoaded', wire);
})();

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

  function wire() {
    document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = NV.icon(el.dataset.icon); });

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

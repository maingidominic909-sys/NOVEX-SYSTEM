/* NORVEX — modern compact sign in / create account panel */
(function () {
  'use strict';
  const NV = window.NV;
  const A = NV.auth;
  let mode = 'signin', busy = false;
  let sceneTimer = null;
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = sel => document.querySelector(sel);
  const form = () => $('#authForm');
  const field = name => form().querySelector(`[data-field="${name}"]`);
  const input = name => form().querySelector(`[name="${name}"]`);

  function setMode(next, focus) {
    mode = next === 'signup' ? 'signup' : 'signin';
    $('#authSeg').dataset.mode = mode;
    form().dataset.mode = mode;
    document.querySelectorAll('#authSeg [role="tab"]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === mode)));
    $('#authTitle').textContent = mode === 'signup' ? 'Create your account' : 'Welcome back';
    $('#authSub').textContent = mode === 'signup'
      ? 'Three details now. Organisation and phone can wait until checkout.'
      : 'Sign in to pick up where you left off.';
    $('#authSubmitLabel').textContent = mode === 'signup' ? 'Create account' : 'Sign in';
    input('password').setAttribute('autocomplete', mode === 'signup' ? 'new-password' : 'current-password');
    $('#pwMeter').style.display = mode === 'signup' ? 'flex' : 'none';
    $('#authSwitch').innerHTML = mode === 'signup'
      ? 'Already have an account? <button type="button" data-switch="signin">Sign in</button>'
      : 'New to Norvex? <button type="button" data-switch="signup">Create an account</button>';
    hideNote();
    clearMarks();
    try {
      const url = new URL(location.href);
      url.searchParams.set('mode', mode);
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch {}
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
    const el = f.querySelector('.auth-input');
    if (el) el.setAttribute('aria-invalid', ok === false ? 'true' : 'false');
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
    name: v => v.trim().length >= 2 || 'Tell us your name.',
    email: v => A.emailOk(v) || 'That email does not look right.',
    password: v => mode === 'signin'
      ? (v.length > 0 || 'Enter your password.')
      : (v.length >= 8 && /[a-z]/i.test(v) && /\d/.test(v) || 'At least 8 characters with letters and a number.')
  };
  function checkField(name) {
    const el = input(name);
    if (!el) return true;
    const res = checks[name] ? checks[name](el.value) : true;
    if (res === true) { mark(name, el.value ? true : null); return true; }
    mark(name, false, res);
    return false;
  }

  function updateMeter() {
    if (mode !== 'signup') return;
    const s = A.strength(input('password').value);
    $('#pwMeterFill').style.width = s.pct + '%';
    $('#pwMeterLabel').textContent = input('password').value ? s.label : '';
    $('#pwMeterFill').style.background = s.score >= 4 ? 'var(--green-600)' : s.score >= 3 ? 'var(--gold-500)' : 'var(--red-600)';
  }

  function generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    const buf = new Uint32Array(14);
    const cryptoObj = window.crypto || window.msCrypto;
    if (cryptoObj && cryptoObj.getRandomValues) cryptoObj.getRandomValues(buf);
    else for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 0xffffffff);
    let out = '';
    for (let i = 0; i < 14; i++) out += chars[buf[i] % chars.length];
    if (!/\d/.test(out)) out += '7';
    if (!/[a-z]/i.test(out)) out += 'a';
    return out;
  }

  function openDialog(dlg) {
    if (!dlg) return;
    try { if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', ''); }
    catch { dlg.setAttribute('open', ''); }
  }
  function closeDialog(dlg) {
    if (!dlg) return;
    try { if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open'); }
    catch { dlg.removeAttribute('open'); }
  }

  const ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1.5"/><rect x="14" y="4" width="4" height="16" rx="1.5"/></svg>';
  const ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>';
  const LABELS = ['Loading at the depot', 'On the way to you', 'Tracked to your door'];
  let animPaused = false, labelIdx = 0;

  function setAnimPaused(p) {
    animPaused = p;
    const a = $('#authAnim');
    if (a) a.classList.toggle('paused', p);
    const t = $('#animToggle');
    if (t) {
      t.setAttribute('aria-pressed', String(p));
      t.setAttribute('aria-label', p ? 'Play animation' : 'Pause animation');
      t.innerHTML = p ? ICON_PLAY : ICON_PAUSE;
    }
  }
  function startSceneTimer() {
    stopSceneTimer();
    if (reduceMotion) return;
    sceneTimer = setInterval(() => {
      labelIdx = (labelIdx + 1) % LABELS.length;
      const l = $('#sceneLabel');
      if (l) l.textContent = LABELS[labelIdx];
    }, 6000);
  }
  function stopSceneTimer() { if (sceneTimer) { clearInterval(sceneTimer); sceneTimer = null; } }

  function wire() {
    document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = NV.icon(el.dataset.icon); });

    document.querySelectorAll('#authSeg [role="tab"]').forEach(btn => {
      btn.addEventListener('click', () => setMode(btn.dataset.tab, true));
      btn.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setMode(mode === 'signin' ? 'signup' : 'signin', true); }
      });
    });
    $('#authSwitch').addEventListener('click', e => {
      const btn = e.target.closest('[data-switch]');
      if (btn) setMode(btn.dataset.switch, true);
    });

    ['identifier', 'name', 'email', 'password'].forEach(name => {
      const el = input(name);
      if (!el) return;
      el.addEventListener('blur', () => { if (el.value) checkField(name); });
      el.addEventListener('input', () => {
        const f = field(name);
        if (f && f.classList.contains('bad')) checkField(name);
        hideNote();
        if (name === 'password') updateMeter();
      });
    });

    const pw = input('password');
    const caps = $('#capsHint');
    ['keydown', 'keyup'].forEach(evt => pw.addEventListener(evt, e => {
      if (e.getModifierState) caps.hidden = !e.getModifierState('CapsLock');
    }));
    pw.addEventListener('blur', () => { caps.hidden = true; });

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

    $('#pwGenerate').addEventListener('click', () => {
      if (mode !== 'signup') setMode('signup');
      const value = generatePassword();
      pw.value = value;
      pw.type = 'text';
      const toggle = document.querySelector('[data-pw-toggle="password"]');
      if (toggle) { toggle.innerHTML = NV.icon('eye'); toggle.setAttribute('aria-label', 'Hide password'); }
      updateMeter();
      mark('password', true);
      NV.toast('Strong password generated — save it somewhere safe.', { title: 'Password ready' });
    });

    document.querySelectorAll('[data-demo]').forEach(btn => btn.addEventListener('click', () => {
      setMode('signin');
      input('identifier').value = btn.dataset.demo === 'admin' ? 'admin@norvex.co.ke' : 'demo@norvex.co.ke';
      input('password').value = 'Norvex2026';
      mark('identifier', true); mark('password', true);
      showNote('Demo credentials filled — press Sign in.', 'ok');
      $('#authSubmit').focus();
    }));

    $('#forgotBtn').addEventListener('click', () => {
      $('#resetForm').reset();
      $('#resetNote').className = 'auth-note';
      openDialog($('#resetDialog'));
      setTimeout(() => $('#resetEmail').focus(), 60);
    });
    $('#termsBtn').addEventListener('click', () => openDialog($('#termsDialog')));
    document.querySelectorAll('[data-close-dialog]').forEach(btn => btn.addEventListener('click', () => closeDialog(btn.closest('dialog'))));

    $('#resetForm').addEventListener('submit', async e => {
      e.preventDefault();
      const email = $('#resetEmail').value.trim();
      const next = $('#resetPassword').value;
      const note = $('#resetNote');
      const markReset = (id, ok) => {
        const f = document.querySelector(`[data-field="${id}"]`);
        if (f) f.classList.toggle('bad', !ok);
      };
      markReset('resetEmail', A.emailOk(email));
      markReset('resetPassword', next.length >= 8 && /[a-z]/i.test(next) && /\d/.test(next));
      if (!A.emailOk(email) || next.length < 8 || !/[a-z]/i.test(next) || !/\d/.test(next)) {
        note.className = 'auth-note show error';
        note.innerHTML = `${NV.icon('warning')} <span>Check the highlighted fields.</span>`;
        return;
      }
      const btn = $('#resetSubmit');
      btn.disabled = true;
      const res = await A.resetPasswordLocal(email, next);
      btn.disabled = false;
      if (!res.ok) {
        note.className = 'auth-note show error';
        note.innerHTML = `${NV.icon('warning')} <span>${NV.esc(res.error)}</span>`;
        return;
      }
      closeDialog($('#resetDialog'));
      setMode('signin');
      input('identifier').value = email;
      showNote('Password updated on this device. Sign in with your new password.', 'ok');
      NV.toast('Password updated on this device.', { title: 'Recovered' });
    });

    form().addEventListener('submit', onSubmit);

    const toggle = $('#animToggle');
    if (toggle) toggle.addEventListener('click', () => setAnimPaused(!animPaused));
    document.addEventListener('visibilitychange', () => { document.hidden ? stopSceneTimer() : startSceneTimer(); });
    setAnimPaused(false);
    startSceneTimer();

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
    const next = q.get('next') || A.takeReturn('/desk.html');
    return next && next.startsWith('/') && !next.startsWith('//') ? next : '/desk.html';
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    clearMarks(); hideNote();
    const names = mode === 'signup' ? ['name', 'email', 'password'] : ['identifier', 'password'];
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
    $('#authSubmitLabel').textContent = mode === 'signup' ? 'Creating account…' : 'Signing in…';
    btn.querySelector('.spinner').style.display = 'block';

    let res;
    if (mode === 'signup') {
      res = await A.signUp({
        name: input('name').value,
        email: input('email').value,
        password: input('password').value,
        remember: true
      });
      if (!res.ok && res.errors) {
        Object.entries(res.errors).forEach(([k, msg]) => mark(k, false, msg));
        showNote('Check the highlighted fields and try again.');
      }
    } else {
      res = await A.signIn(input('identifier').value, input('password').value, { days: $('#rememberCheck').checked ? 30 : 1 });
      if (!res.ok) showNote(res.error || 'Could not sign in.');
    }

    btn.disabled = false;
    btn.querySelector('.spinner').style.display = 'none';
    busy = false;
    if (!res.ok) { $('#authSubmitLabel').textContent = mode === 'signup' ? 'Create account' : 'Sign in'; return; }

    const u = res.user;
    const dest = returnPath();
    $('#authCardInner').style.display = 'none';
    const s = $('#authSuccess');
    s.classList.add('show');
    if (mode === 'signup') {
      s.innerHTML = `
        <span class="ok">${NV.icon('check')}</span>
        <h2 class="serif">Account created — karibu, ${NV.esc(u.name.split(' ')[0])}.</h2>
        <p>You can add organisation and phone details later in your profile or at checkout.</p>
        <div class="auth-success-actions">
          <button type="button" class="btn btn-primary" data-success-go="desk">Continue to order desk</button>
          <button type="button" class="btn btn-ghost" data-success-go="account">Complete profile</button>
        </div>`;
      s.querySelectorAll('[data-success-go]').forEach(b => b.addEventListener('click', () => {
        A.go(b.dataset.successGo === 'account' ? '/account.html' : dest);
      }));
      NV.toast('Trade account created. Welcome to Norvex.', { title: 'Signed up' });
    } else {
      s.innerHTML = `
        <span class="ok">${NV.icon('check')}</span>
        <h2 class="serif">Signed in — karibu, ${NV.esc(u.name.split(' ')[0])}.</h2>
        <p>Taking you to ${NV.esc(dest === '/desk.html' ? 'your order desk' : 'where you left off')}…</p>`;
      NV.toast(`Welcome back, ${u.name.split(' ')[0]}.`, { title: 'Signed in' });
      setTimeout(() => A.go(dest), 900);
    }
  }

  document.addEventListener('DOMContentLoaded', wire);
})();

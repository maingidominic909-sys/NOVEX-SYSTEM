/* Auth page — sign in / create account */
(function () {
  const NV = window.NV;
  let mode = 'signin';

  document.addEventListener('DOMContentLoaded', () => {
    const A = NV.auth;
    const form = document.getElementById('authForm');
    const seg = document.getElementById('authSeg');
    const title = document.getElementById('authTitle');
    const sub = document.getElementById('authSub');
    const submit = document.getElementById('authSubmit');
    const submitLabel = document.getElementById('authSubmitLabel');
    const note = document.getElementById('authNote');
    const success = document.getElementById('authSuccess');
    const q = NV.queryString ? NV.queryString() : new URLSearchParams(location.search);

    document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = NV.icon(el.dataset.icon); });
    const $ = sel => form.querySelector(sel);
    const field = name => form.querySelector(`[data-field="${name}"]`);

    /* ---------- mode ---------- */
    function setMode(next, opts) {
      mode = next === 'signup' ? 'signup' : 'signin';
      seg.dataset.mode = mode;
      form.dataset.mode = mode;
      seg.querySelectorAll('[role="tab"]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === mode)));
      title.textContent = mode === 'signup' ? 'Create your trade account' : 'Welcome back';
      sub.textContent = mode === 'signup'
        ? 'Four fields, one minute — then every order sits in one place.'
        : 'Sign in to your trade account. Browsing stays open to everyone.';
      submitLabel.textContent = mode === 'signup' ? 'Create my account' : 'Sign in to my account';
      form.querySelector('[name="password"]').setAttribute('autocomplete', mode === 'signup' ? 'new-password' : 'current-password');
      hideNote();
      if (!opts || !opts.silent) {
        const first = form.querySelector(mode === 'signup' ? '[name="name"]' : '[name="identifier"]');
        if (first && (opts && opts.focus)) setTimeout(() => first.focus({ preventScroll: true }), 80);
      }
    }
    seg.querySelectorAll('[role="tab"]').forEach(btn => {
      btn.addEventListener('click', () => setMode(btn.dataset.tab, { focus: true }));
      btn.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          setMode(mode === 'signin' ? 'signup' : 'signin', { focus: true });
        }
      });
    });

    /* ---------- inline validation ---------- */
    function mark(name, ok, msg) {
      const f = field(name);
      if (!f) return;
      f.classList.toggle('ok', ok === true);
      f.classList.toggle('bad', ok === false);
      const err = f.querySelector('.auth-err');
      if (err && msg) err.textContent = msg;
    }

    const checkers = {
      name: v => v.trim().length >= 2 || 'Tell us who we are quoting.',
      organisation: v => v.trim().length >= 2 || 'Organisation or institution name is required.',
      email: v => A.emailOk(v) || 'That email does not look right.',
      phone: v => A.phoneOk(v) || 'Kenyan mobile, e.g. 0712 345 678.',
      username: v => A.usernameOk(v) || '3–20 characters — letters, numbers, dot, dash or underscore.',
      password: v => (v.length >= 8 && /[a-z]/i.test(v) && /\d/.test(v)) || 'Use at least 8 characters with a letter and a number.',
      confirm: v => v === form.querySelector('[name="password"]').value || 'Passwords do not match.'
    };

    function live(name, silent) {
      const input = form.querySelector(`[name="${name}"]`);
      if (!input) return true;
      const value = input.value;
      if (silent && !value) { mark(name, null); return false; }
      const res = checkers[name] ? checkers[name](value) : true;
      const ok = res === true;
      mark(name, ok, ok ? '' : res);
      return ok;
    }

    Object.keys(checkers).forEach(name => {
      const input = form.querySelector(`[name="${name}"]`);
      if (!input) return;
      input.addEventListener('blur', () => live(name));
      input.addEventListener('input', () => {
        const f = field(name);
        if (f && (f.classList.contains('bad') || f.classList.contains('ok') || (name === 'password' && mode === 'signup'))) live(name);
        if (name === 'password') {
          const s = A.strength(input.value);
          const bars = form.querySelectorAll('.auth-strength-bar i');
          bars.forEach((b, i) => {
            b.className = i < s.score ? 'on-' + s.score : '';
          });
          const small = form.querySelector('.auth-strength small');
          if (small) small.textContent = input.value ? `${s.label} password` : 'Use 8+ characters with a number for a stronger password.';
          const conf = form.querySelector('[name="confirm"]');
          if (conf && conf.value) live('confirm');
        }
        if (name === 'phone') formatPhone(input);
      });
    });

    function formatPhone(input) {
      const digits = input.value.replace(/[^\d+]/g, '');
      if (!digits || digits.length < 4) return;
      if (/^0\d{9}$/.test(digits)) input.value = `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
    }

    /* ---------- password reveal ---------- */
    form.querySelectorAll('[data-reveal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = form.querySelector(`[name="${btn.dataset.reveal}"]`);
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.textContent = show ? 'Hide' : 'Show';
        btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      });
    });

    /* ---------- notes ---------- */
    function showNote(text, tone) {
      note.textContent = text;
      note.className = 'auth-note show' + (tone === 'bad' ? ' bad' : '');
    }
    function hideNote() { note.className = 'auth-note'; note.textContent = ''; }

    document.getElementById('forgotLink').addEventListener('click', e => {
      e.preventDefault();
      showNote('Password resets are handled by the Norvex desk — call +254 742 021 099 or email info@norvex.co.ke and we will reset it within one working hour.');
    });

    document.getElementById('demoFill').addEventListener('click', () => {
      setMode('signin');
      form.querySelector('[name="identifier"]').value = 'demo@norvex.co.ke';
      form.querySelector('[name="password"]').value = 'Norvex2026';
      [form.querySelector('[name="identifier"]'), form.querySelector('[name="password"]')].forEach(i => i.dispatchEvent(new Event('input')));
      showNote('Demo credentials filled — press “Sign in to my account”.');
      form.querySelector('[name="identifier"]').focus();
    });

    /* ---------- submit ---------- */
    form.addEventListener('submit', async e => {
      e.preventDefault();
      hideNote();

      if (mode === 'signin') {
        const identifier = form.querySelector('[name="identifier"]').value.trim();
        const password = form.querySelector('[name="password"]').value;
        const okId = identifier.length >= 3;
        mark('identifier', okId);
        mark('password', password.length > 0);
        if (!okId || !password) { showNote('Enter your account details to continue.', 'bad'); return; }

        submit.classList.add('is-loading');
        const res = await A.signIn(identifier, password);
        submit.classList.remove('is-loading');
        if (!res.ok) {
          mark('password', false, 'That password is not right.');
          showNote(res.error, 'bad');
          return;
        }
        succeed(res.user);
        return;
      }

      /* sign up */
      const data = {
        name: $('[name="name"]').value,
        organisation: $('[name="organisation"]').value,
        email: $('[name="email"]').value,
        phone: $('[name="phone"]').value,
        username: $('[name="username"]').value,
        password: $('[name="password"]').value,
        confirm: $('[name="confirm"]').value
      };
      const errors = A.validateSignup(data);
      ['name', 'organisation', 'email', 'phone', 'username', 'password', 'confirm'].forEach(k => mark(k, !errors[k], errors[k]));
      if (!document.getElementById('authTerms').checked) {
        showNote('Please accept the supply terms to create an account.', 'bad');
        return;
      }
      if (Object.keys(errors).length) {
        showNote('Check the highlighted fields and try again.', 'bad');
        const firstBad = form.querySelector('.auth-field.bad .auth-input');
        if (firstBad) firstBad.focus();
        return;
      }

      submit.classList.add('is-loading');
      const res = await A.signUp(data);
      submit.classList.remove('is-loading');
      if (!res.ok) {
        Object.entries(res.errors || {}).forEach(([k, v]) => mark(k, false, v));
        showNote(res.errors ? Object.values(res.errors)[0] : 'Could not create the account.', 'bad');
        return;
      }
      succeed(res.user, true);
    });

    function succeed(user, isNew) {
      submit.classList.add('is-done');
      submitLabel.textContent = isNew ? 'Account created' : 'Signed in';
      document.getElementById('authSuccessTitle').textContent = isNew ? `Welcome, ${user.name.split(' ')[0]}.` : `Signed in as ${user.name.split(' ')[0]}.`;
      document.getElementById('authSuccessCopy').textContent = isNew
        ? 'Your trade account is ready — tier pricing and saved details are now on every order.'
        : 'Taking you back to where you left off…';
      success.classList.add('show');
      const target = A.takeReturn(mode === 'signup' ? '/account.html' : '/account.html');
      setTimeout(() => A.go(target), 1100);
    }

    /* ---------- already signed in ---------- */
    const existing = A.current();
    if (existing) {
      showNote(`${existing.name} is already signed in (${existing.email}). Continue to your account, or sign out below to use a different login.`);
      const out = document.createElement('button');
      out.type = 'button';
      out.className = 'btn btn-ghost btn-block';
      out.style.marginTop = '4px';
      out.textContent = 'Sign out of this account';
      out.onclick = () => A.signOut({ redirect: false });
      note.appendChild(document.createElement('br'));
      note.appendChild(out);
      form.querySelector('[name="identifier"]').value = existing.email;
    }

    /* ---------- mode from the URL ---------- */
    const want = (q.get('mode') || '').toLowerCase();
    if (want === 'signup') setMode('signup', { silent: true });
    else setMode('signin', { silent: true });
    if (want === 'signup' || want === 'signin') {
      const first = form.querySelector(mode === 'signup' ? '[name="name"]' : '[name="identifier"]');
      if (first && !existing) setTimeout(() => first.focus({ preventScroll: true }), 250);
    }

    /* ---------- pointer-parallax ticket ---------- */
    const ticket = document.getElementById('authTicket');
    const stage = document.querySelector('.auth-stage');
    if (ticket && stage && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      let raf = 0;
      stage.addEventListener('pointermove', e => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const r = stage.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width - 0.5;
          const y = (e.clientY - r.top) / r.height - 0.5;
          ticket.style.setProperty('--ry', (x * 9).toFixed(2) + 'deg');
          ticket.style.setProperty('--rx', (-y * 7).toFixed(2) + 'deg');
        });
      });
      stage.addEventListener('pointerleave', () => {
        ticket.style.setProperty('--ry', '0deg');
        ticket.style.setProperty('--rx', '0deg');
      });
    }

    /* ---------- Enter key on the sign-in identifier jumps to password ---------- */
    form.querySelector('[name="identifier"]').addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        form.querySelector('[name="password"]').focus();
      }
    });

    document.addEventListener('norvex:chrome', () => {
      document.querySelectorAll('.auth-body [data-icon]').forEach(el => { if (!el.firstChild) el.innerHTML = NV.icon(el.dataset.icon); });
    });
  });
})();

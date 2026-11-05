/* =========================================================
   Stackly — role-based auth  |  js/auth.js
   Roles: admin · accountant · viewer
   Sessions + accounts stored in localStorage (demo backend)
   ========================================================= */
(function () {
  'use strict';

  const USERS_KEY = 'stackly.users.v1';
  const SESSION_KEY = 'stackly.session.v1';
  const DEMO_PASSWORD = 'stackly123';

  /* ---------- role definitions & permissions ---------- */
  const ROLES = {
    admin: {
      key: 'admin',
      label: 'Admin',
      tag: 'Admin',
      desc: 'Full control: settings, team, deletes and exports.',
      icon: 'i-shield',
      color: '#6366f1',
      tint: 'rgba(99,102,241,.14)',
      can: { viewSettings: true, create: true, edit: true, remove: true, export: true }
    },
    accountant: {
      key: 'accountant',
      label: 'Accountant',
      tag: 'Accountant',
      desc: 'Bookkeeping: transactions, invoices, budgets, reports.',
      icon: 'i-coin',
      color: '#059669',
      tint: 'rgba(16,185,129,.14)',
      can: { viewSettings: false, create: true, edit: true, remove: false, export: true }
    },
    viewer: {
      key: 'viewer',
      label: 'Viewer',
      tag: 'Viewer',
      desc: 'Read-only access to dashboards and reports.',
      icon: 'i-eye',
      color: '#64748b',
      tint: 'rgba(100,116,139,.14)',
      can: { viewSettings: false, create: false, edit: false, remove: false, export: false }
    }
  };

  const ROLE_ORDER = ['admin', 'accountant', 'viewer'];

  /* demo accounts used by the one-click demo buttons */
  const DEMO_USERS = [
    { role: 'admin',      name: 'Amara Osei',   email: 'admin@stackly.com',      company: 'Stackly Technologies Pvt Ltd' },
    { role: 'accountant', name: 'Priya Anand',  email: 'accountant@stackly.com', company: 'Stackly Technologies Pvt Ltd' },
    { role: 'viewer',     name: 'Marcus Reed',  email: 'viewer@stackly.com',     company: 'Stackly Technologies Pvt Ltd' }
  ];

  /* ---------- storage helpers ---------- */
  const read = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  };

  /* demo password hashing (not cryptography — a demo backend) */
  const hash = str => {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
    return (h >>> 0).toString(36);
  };

  const normalise = email => String(email || '').trim().toLowerCase();
  const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());

  /* ---------- users ---------- */
  function getUsers() {
    let users = read(USERS_KEY, null);
    if (!Array.isArray(users) || !users.length) {
      users = DEMO_USERS.map(u => ({
        name: u.name,
        email: u.email,
        company: u.company,
        role: u.role,
        pass: hash(DEMO_PASSWORD),
        demo: true,
        createdAt: Date.now()
      }));
      write(USERS_KEY, users);
    }
    return users;
  }

  function findUser(email) {
    const target = normalise(email);
    return getUsers().find(u => normalise(u.email) === target) || null;
  }

  /* ---------- session ---------- */
  function current() {
    const s = read(SESSION_KEY, null);
    if (!s || !s.email || !ROLES[s.role]) return null;
    return s;
  }

  function startSession(user) {
    const session = {
      name: user.name,
      email: normalise(user.email),
      company: user.company || 'Stackly Technologies Pvt Ltd',
      role: ROLES[user.role] ? user.role : 'viewer',
      since: Date.now()
    };
    write(SESSION_KEY, session);
    return session;
  }

  function requireAuth() {
    const s = current();
    if (s) return s;
    const page = (location.pathname.split('/').pop() || 'dashboard.html').split('?')[0];
    location.replace('login.html?next=' + encodeURIComponent(page));
    return null;
  }

  function logout(redirect) {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
    location.replace(redirect || 'login.html');
  }

  /* ---------- permissions ---------- */
  function can(perm) {
    const s = current();
    if (!s) return false;
    const role = ROLES[s.role];
    return !!(role && role.can[perm]);
  }

  function roleInfo(key) {
    const s = current();
    return ROLES[key || (s && s.role)] || ROLES.viewer;
  }

  function identity() {
    const s = current();
    if (!s) return null;
    const parts = String(s.name || '').trim().split(/\s+/);
    const initials = ((parts[0] || '?')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
    return {
      name: s.name,
      email: s.email,
      company: s.company,
      role: s.role,
      roleInfo: ROLES[s.role],
      initials
    };
  }

  /* ---------- auth actions ---------- */
  function login(email, password, role) {
    if (!isEmail(email)) return { ok: false, field: 'lEmail', error: 'Enter a valid email address.' };
    if (!password || String(password).length < 6) return { ok: false, field: 'lPass', error: 'Password must be at least 6 characters.' };
    if (!ROLES[role]) return { ok: false, field: null, error: 'Choose the role you are signing in with.' };

    const user = findUser(email);
    if (!user) return { ok: false, field: 'lEmail', error: 'No account found for that email. Create one first.' };
    if (user.pass !== hash(password)) return { ok: false, field: 'lPass', error: 'That password is not correct.' };
    if (user.role !== role) {
      return {
        ok: false,
        field: 'lRole',
        error: `${user.name} is registered as ${ROLES[user.role].label}. Select ${ROLES[user.role].label} to continue.`
      };
    }
    return { ok: true, session: startSession(user) };
  }

  function signup(data) {
    const name = String(data.name || '').trim();
    const email = normalise(data.email);
    const company = String(data.company || '').trim();
    const password = String(data.password || '');
    const confirm = String(data.confirm || '');
    const role = data.role;

    if (name.length < 2) return { ok: false, field: 'sName', error: 'Please enter your full name.' };
    if (!isEmail(email)) return { ok: false, field: 'sEmail', error: 'Enter a valid work email address.' };
    if (company.length < 2) return { ok: false, field: 'sCompany', error: 'Company name is required.' };
    if (password.length < 8) return { ok: false, field: 'sPass', error: 'Use at least 8 characters for the password.' };
    if (password !== confirm) return { ok: false, field: 'sConfirm', error: 'Passwords do not match.' };
    if (!ROLES[role]) return { ok: false, field: 'sRole', error: 'Choose a role for this account.' };

    const users = getUsers();
    if (users.some(u => normalise(u.email) === email)) {
      return { ok: false, field: 'sEmail', error: 'An account with that email already exists.' };
    }

    const user = { name, email, company, role, pass: hash(password), demo: false, createdAt: Date.now() };
    users.push(user);
    write(USERS_KEY, users);
    return { ok: true, session: startSession(user) };
  }

  function demoLogin(role) {
    const seed = DEMO_USERS.find(u => u.role === role) || DEMO_USERS[0];
    getUsers(); // make sure demo accounts exist
    return startSession({ name: seed.name, email: seed.email, company: seed.company, role: seed.role });
  }

  /* ---------- shared page wiring ---------- */
  function toast(msg, type) {
    if (typeof window.stacklyToast === 'function') return window.stacklyToast(msg, type || 'info');
    let host = document.getElementById('toastHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toastHost';
      host.className = 'toast-host';
      document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.className = 'toast ' + (type || 'info');
    el.innerHTML = '<span>' + String(msg) + '</span>';
    host.appendChild(el);
    setTimeout(() => { el.classList.add('hide'); setTimeout(() => el.remove(), 320); }, 3400);
  }

  function setError(id, msg) {
    const input = document.getElementById(id);
    if (!input) return;
    const field = input.closest('.field') || input.closest('.role-field') || input.parentElement;
    if (!field) return;
    const err = field.querySelector('.err[data-for="' + id + '"]') ||
                document.querySelector('.err[data-for="' + id + '"]');
    field.classList.toggle('is-invalid', !!msg);
    if (err) err.textContent = msg || '';
  }

  function focusField(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const target = el.matches('input,select,textarea') ? el : el.querySelector('input');
    if (target) { target.focus(); target.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }

  /* expose */
  window.StacklyAuth = {
    ROLES,
    ROLE_ORDER,
    DEMO_PASSWORD,
    DEMO_USERS,
    current,
    identity,
    requireAuth,
    logout,
    can,
    roleInfo,
    login,
    signup,
    demoLogin,
    isEmail,
    setError,
    focusField,
    toast
  };
})();

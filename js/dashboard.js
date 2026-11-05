/* =========================================================
   Stackly — accounting dashboard  |  js/dashboard.js
   State, charts, CRUD, filters, reports — localStorage backed
   ========================================================= */
(function () {
  'use strict';

  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* ---------- role-based access (js/auth.js) ---------- */
  const Auth = window.StacklyAuth;
  if (!Auth) { location.replace('login.html'); return; }
  const session = Auth.requireAuth();
  if (!session) return;                       /* redirected to login.html?next=… */
  const can = p => Auth.can(p);

  const STORE_KEY = 'stackly.data.v1';
  const PAGE_SIZE = 8;

  const CATEGORIES = ['Sales', 'Software', 'Payroll', 'Marketing', 'Travel', 'Office', 'Contractors', 'Utilities', 'Fees', 'Other'];

  const CAT_COLORS = {
    Sales: '#6366f1', Software: '#8b5cf6', Payroll: '#10b981', Marketing: '#f59e0b',
    Travel: '#0ea5e9', Office: '#64748b', Contractors: '#ec4899', Utilities: '#14b8a6',
    Fees: '#f43f5e', Other: '#94a3b8'
  };

  const DEFAULT_BUDGETS = {
    Payroll: 45000, Contractors: 15000, Marketing: 7000, Software: 5000,
    Travel: 4000, Office: 2500, Utilities: 1200, Fees: 800, Other: 2000
  };

  /* ---------------------------------------------------------
     date helpers
  --------------------------------------------------------- */
  const iso = d => {
    const x = new Date(d);
    x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
    return x.toISOString().slice(0, 10);
  };
  const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
  const daysAhead = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
  const parse = s => new Date(s + 'T00:00:00');
  const fmtDate = s => parse(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const monthKey = s => s.slice(0, 7);
  const monthLabel = key => new Date(key + '-01T00:00:00').toLocaleDateString('en-US', { month: 'short' });

  /* ---------------------------------------------------------
     seed data
  --------------------------------------------------------- */
  function seed() {
    const T = (d, desc, cat, amount, type, status) => ({ id: uid(), date: daysAgo(d), desc, cat, amount, type, status });

    const transactions = [
      // --- this month / recent ---
      T(0,  'Lumen Labs — retainer', 'Sales', 8400, 'income', 'completed'),
      T(1,  'Figma annual plan', 'Software', 960, 'expense', 'completed'),
      T(2,  'Vertex Group — project final', 'Sales', 12250, 'income', 'completed'),
      T(3,  'Google Ads campaign', 'Marketing', 1840, 'expense', 'completed'),
      T(4,  'AWS infrastructure', 'Software', 1320, 'expense', 'completed'),
      T(5,  'Harbor Co. — invoice ST-1040', 'Sales', 3980, 'income', 'pending'),
      T(6,  'Contractor — A. Petrov', 'Contractors', 4500, 'expense', 'completed'),
      T(7,  'Office rent — November', 'Office', 2400, 'expense', 'completed'),
      T(8,  'Cobalt — invoice ST-1039', 'Sales', 6100, 'income', 'pending'),
      T(9,  'Payroll — half month', 'Payroll', 22500, 'expense', 'completed'),
      T(10, 'Stripe processing fees', 'Fees', 312, 'expense', 'completed'),
      T(12, 'Delta Air Lines — sales trip', 'Travel', 1240, 'expense', 'completed'),
      T(13, 'Atlas Foods — bulk order', 'Sales', 15600, 'income', 'completed'),
      T(14, 'Notion + Slack licenses', 'Software', 486, 'expense', 'completed'),
      T(16, 'Meridian — retainer', 'Sales', 5400, 'income', 'completed'),
      T(17, 'Utilities & internet', 'Utilities', 410, 'expense', 'completed'),
      T(19, 'LinkedIn ads', 'Marketing', 2200, 'expense', 'completed'),
      T(21, 'Ridgeline Studio — deposit', 'Sales', 7200, 'income', 'completed'),
      T(22, 'Contractor — M. Silva', 'Contractors', 3800, 'expense', 'completed'),
      T(24, 'Hotel + meals — NYC', 'Travel', 1680, 'expense', 'completed'),
      T(26, 'Northwind — license renew.', 'Sales', 9800, 'income', 'completed'),
      T(28, 'Payroll — full month', 'Payroll', 24000, 'expense', 'completed'),
      T(30, 'Xero migration consultancy', 'Office', 900, 'expense', 'completed'),

      // --- previous months (for charts) ---
      T(38, 'Lumen Labs — retainer', 'Sales', 8400, 'income', 'completed'),
      T(40, 'Facebook Ads', 'Marketing', 2450, 'expense', 'completed'),
      T(42, 'AWS infrastructure', 'Software', 1180, 'expense', 'completed'),
      T(45, 'Vertex Group — milestone 2', 'Sales', 9600, 'income', 'completed'),
      T(47, 'Payroll — October', 'Payroll', 46500, 'expense', 'completed'),
      T(50, 'Office rent — October', 'Office', 2400, 'expense', 'completed'),
      T(52, 'Harbor Co. — services', 'Sales', 6700, 'income', 'completed'),
      T(55, 'Contractors — Q4 batch', 'Contractors', 7200, 'expense', 'completed'),
      T(58, 'Bank & FX fees', 'Fees', 264, 'expense', 'completed'),

      T(66, 'Atlas Foods — order', 'Sales', 11200, 'income', 'completed'),
      T(68, 'Payroll — September', 'Payroll', 45800, 'expense', 'completed'),
      T(70, 'Office rent — September', 'Office', 2400, 'expense', 'completed'),
      T(73, 'SaaS bundle renewal', 'Software', 2140, 'expense', 'completed'),
      T(76, 'Cobalt — retainer', 'Sales', 5800, 'income', 'completed'),
      T(79, 'Trade show booth', 'Marketing', 4200, 'expense', 'completed'),
      T(83, 'Meridian — project', 'Sales', 8900, 'income', 'completed'),

      T(94, 'Payroll — August', 'Payroll', 45200, 'expense', 'completed'),
      T(97, 'Office rent — August', 'Office', 2400, 'expense', 'completed'),
      T(100, 'Northwind — services', 'Sales', 13400, 'income', 'completed'),
      T(104, 'Cloud hosting', 'Software', 1490, 'expense', 'completed'),
      T(108, 'Business travel — Austin', 'Travel', 3120, 'expense', 'completed'),
      T(112, 'Ridgeline Studio — final', 'Sales', 7400, 'income', 'completed'),

      T(124, 'Payroll — July', 'Payroll', 44800, 'expense', 'completed'),
      T(127, 'Office rent — July', 'Office', 2400, 'expense', 'completed'),
      T(131, 'Lumen Labs — retainer', 'Sales', 8400, 'income', 'completed'),
      T(135, 'Agency partnership fee', 'Contractors', 5400, 'expense', 'completed'),
      T(139, 'Search ads', 'Marketing', 1980, 'expense', 'completed'),
      T(144, 'Vertex Group — deposit', 'Sales', 6200, 'income', 'completed'),
      T(150, 'Utilities — June', 'Utilities', 386, 'expense', 'completed'),
      T(156, 'Harbor Co. — Q2 closing', 'Sales', 10500, 'income', 'completed')
    ];

    const invoices = [
      { id: uid(), no: 'ST-1042', client: 'Lumen Labs',   amount: 8400,  issued: daysAgo(2),  due: daysAhead(12), status: 'paid' },
      { id: uid(), no: 'ST-1041', client: 'Vertex Group', amount: 12250, issued: daysAgo(6),  due: daysAhead(8),  status: 'sent' },
      { id: uid(), no: 'ST-1040', client: 'Harbor Co.',   amount: 3980,  issued: daysAgo(11), due: daysAhead(3),  status: 'sent' },
      { id: uid(), no: 'ST-1039', client: 'Cobalt',       amount: 6100,  issued: daysAgo(20), due: daysAgo(6),    status: 'overdue' },
      { id: uid(), no: 'ST-1038', client: 'Atlas Foods',  amount: 15600, issued: daysAgo(26), due: daysAgo(12),   status: 'paid' },
      { id: uid(), no: 'ST-1037', client: 'Northwind',    amount: 9800,  issued: daysAgo(34), due: daysAgo(20),   status: 'paid' },
      { id: uid(), no: 'ST-1036', client: 'Meridian',     amount: 5400,  issued: daysAgo(41), due: daysAgo(27),   status: 'paid' },
      { id: uid(), no: 'ST-1035', client: 'Ridgeline',    amount: 7200,  issued: daysAgo(48), due: daysAgo(34),   status: 'paid' },
      { id: uid(), no: 'ST-1034', client: 'Atlas Foods',  amount: 4300,  issued: daysAgo(1),  due: daysAhead(29), status: 'draft' },
      { id: uid(), no: 'ST-1033', client: 'Cobalt',       amount: 2750,  issued: daysAgo(3),  due: daysAhead(27), status: 'draft' },
      { id: uid(), no: 'ST-1032', client: 'Harbor Co.',   amount: 6600,  issued: daysAgo(55), due: daysAgo(41),   status: 'paid' }
    ];

    return {
      transactions,
      invoices,
      budgets: { ...DEFAULT_BUDGETS },
      settings: {
        business: 'Stackly Inc.',
        email: 'billing@stackly.com',
        tax: 'US-88-1234567',
        address: '548 Market St, San Francisco, CA',
        currency: '$',
        reminders: true,
        theme: 'light'
      }
    };
  }

  function uid() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4); }

  /* ---------------------------------------------------------
     state
  --------------------------------------------------------- */
  let state;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    state = raw ? JSON.parse(raw) : seed();
  } catch (e) { state = seed(); }

  if (!state.transactions) state = seed();

  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {} };
  const cur = () => state.settings.currency || '$';

  const money = (n, opts = {}) => {
    const sign = n < 0 ? '-' : '';
    const v = Math.abs(Number(n) || 0).toLocaleString('en-US', {
      minimumFractionDigits: opts.decimals ?? (Number.isInteger(Math.abs(n)) ? 0 : 2),
      maximumFractionDigits: 2
    });
    return `${sign}${cur()}${v}`;
  };

  /* ---------------------------------------------------------
     toast
  --------------------------------------------------------- */
  const ICONS = {
    success: '<polyline points="20 6 9 17 4 12"/>',
    error: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'
  };

  function toast(msg, type = 'info', action) {
    const host = $('#toastHost');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML =
      `<span class="t-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${ICONS[type] || ICONS.info}</svg></span>
       <span class="flex-1">${msg}</span>` +
      (action ? `<button class="text-brand-600 underline underline-offset-2 dark:text-brand-300">${action.label}</button>` : '');
    host.appendChild(el);

    if (action) {
      el.querySelector('button').addEventListener('click', () => { action.fn(); dismiss(); });
    }
    const timer = setTimeout(dismiss, action ? 6000 : 3200);
    function dismiss() {
      clearTimeout(timer);
      el.classList.add('hide');
      setTimeout(() => el.remove(), 320);
    }
  }

  /* ---------------------------------------------------------
     theme
  --------------------------------------------------------- */
  function applyTheme(theme) {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.toggle('dark', theme === 'dark');
    state.settings.theme = theme;
    save();
    paintCharts();
  }
  function toggleTheme() {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    toast('Appearance updated', 'info');
  }

  /* ---------------------------------------------------------
     navigation
  --------------------------------------------------------- */
  const VIEW_META = {
    overview:     { title: 'Overview',     sub: 'Your financial snapshot for this month' },
    transactions: { title: 'Transactions', sub: 'Search, filter and categorise every entry' },
    invoices:     { title: 'Invoices',     sub: 'Bill clients and track what you are owed' },
    budget:       { title: 'Budget',       sub: 'Monthly limits by category' },
    reports:      { title: 'Reports',      sub: 'Profit & loss and key ratios' },
    settings:     { title: 'Settings',     sub: 'Business profile and preferences' }
  };
  let currentView = 'overview';

  function goto(view) {
    if (!VIEW_META[view]) return;
    if (view === 'settings' && !can('viewSettings')) {
      toast('Your role does not have access to Settings.', 'error');
      view = 'overview';
    }
    currentView = view;
    $$('.view').forEach(v => v.classList.toggle('is-active', v.id === 'view-' + view));
    $$('.side-link[data-view]').forEach(b => b.classList.toggle('is-active', b.dataset.view === view));
    $('#pageTitle').textContent = VIEW_META[view].title;
    $('#pageSub').textContent = VIEW_META[view].sub;
    closeSidebar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (view === 'reports') { ensurePLChart(); renderReports(); }
    if (view === 'budget') { ensureBudgetChart(); renderBudget(); paintCharts(); }
    setTimeout(() => Object.values(charts).forEach(c => c.resize()), 120);
  }

  $$('.side-link[data-view]').forEach(b => b.addEventListener('click', () => goto(b.dataset.view)));
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-goto]');
    if (t) { e.preventDefault(); goto(t.dataset.goto); }
  });

  /* sidebar (mobile) */
  const sidebar = $('#sidebar');
  const overlay = $('#sidebarOverlay');
  function openSidebar() { sidebar.classList.add('is-open'); overlay.classList.remove('hidden'); }
  function closeSidebar() { sidebar.classList.remove('is-open'); overlay.classList.add('hidden'); }
  $('#sidebarOpen').addEventListener('click', openSidebar);
  $('#sidebarClose').addEventListener('click', closeSidebar);
  overlay.addEventListener('click', closeSidebar);

  /* ---------------------------------------------------------
     charts
  --------------------------------------------------------- */
  const charts = {};
  const isDark = () => document.documentElement.dataset.theme === 'dark';
  const axisColor = () => (isDark() ? '#94a3b8' : '#64748b');
  const gridColor = () => (isDark() ? 'rgba(148,163,184,.12)' : 'rgba(148,163,184,.18)');

  function lastNMonths(n) {
    const out = [];
    const d = new Date();
    d.setDate(1);
    for (let i = n - 1; i >= 0; i--) {
      const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
      out.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`);
    }
    return out;
  }

  function monthlyTotals(keys) {
    const map = {};
    keys.forEach(k => map[k] = { income: 0, expense: 0 });
    state.transactions.forEach(t => {
      const k = monthKey(t.date);
      if (!map[k]) return;
      map[k][t.type] += Number(t.amount);
    });
    return map;
  }

  function makeGradient(ctx, color, top = 0.45) {
    const g = ctx.createLinearGradient(0, 0, 0, 260);
    g.addColorStop(0, color.replace('ALPHA', top));
    g.addColorStop(1, color.replace('ALPHA', 0));
    return g;
  }

  function baseOpts() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { usePointStyle: true, boxWidth: 8, color: axisColor(), font: { family: 'Inter', size: 11 } } },
        tooltip: {
          backgroundColor: isDark() ? '#131b30' : '#0b1120',
          titleColor: '#fff', bodyColor: '#e2e8f0', padding: 10, cornerRadius: 10, displayColors: true
        }
      }
    };
  }

  function buildCharts() {
    if (!window.Chart) return;

    /* cash flow */
    const cf = $('#cashflowChart');
    if (cf) {
      const keys = lastNMonths(6);
      const data = monthlyTotals(keys);
      charts.cashflow = new Chart(cf.getContext('2d'), {
        type: 'line',
        data: {
          labels: keys.map(monthLabel),
          datasets: [
            {
              label: 'Income', data: keys.map(k => Math.round(data[k].income)),
              borderColor: '#6366f1', backgroundColor: makeGradient(cf.getContext('2d'), 'rgba(99,102,241,ALPHA)'),
              fill: true, tension: .4, borderWidth: 2.5, pointRadius: 3, pointBackgroundColor: '#6366f1', pointBorderWidth: 0
            },
            {
              label: 'Expenses', data: keys.map(k => Math.round(data[k].expense)),
              borderColor: '#f59e0b', backgroundColor: 'transparent',
              borderDash: [5, 4], tension: .4, borderWidth: 2.5, pointRadius: 3, pointBackgroundColor: '#f59e0b', pointBorderWidth: 0
            }
          ]
        },
        options: {
          ...baseOpts(),
          interaction: { intersect: false, mode: 'index' },
          scales: {
            x: { grid: { display: false }, ticks: { color: axisColor(), font: { size: 11, family: 'Inter' } } },
            y: { grid: { color: gridColor() }, border: { display: false }, ticks: { color: axisColor(), font: { size: 11, family: 'Inter' }, callback: v => cur() + (v / 1000).toFixed(0) + 'k' } }
          }
        }
      });
    }

    /* category doughnut */
    const cat = $('#categoryChart');
    if (cat) {
      charts.category = new Chart(cat.getContext('2d'), {
        type: 'doughnut',
        data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderWidth: 0, hoverOffset: 8 }] },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '68%',
          plugins: { legend: { display: false }, tooltip: baseOpts().plugins.tooltip }
        }
      });
    }

    /* budget bars — created lazily when the Budget view opens (hidden at boot) */
    /* P&L — created lazily when the Reports view opens (hidden at boot) */
  }

  function ensureBudgetChart() {
    if (charts.budget || !window.Chart) return;
    const bg = $('#budgetChart');
    if (!bg) return;
    charts.budget = new Chart(bg.getContext('2d'), {
      type: 'bar',
      data: { labels: [], datasets: [{ label: 'Spent', data: [], backgroundColor: [], borderRadius: 8, barPercentage: .6 }] },
      options: {
        ...baseOpts(),
        plugins: { legend: { display: false }, tooltip: baseOpts().plugins.tooltip },
        scales: {
          x: { grid: { display: false }, ticks: { color: axisColor(), font: { size: 10, family: 'Inter' }, maxRotation: 45, minRotation: 0 } },
          y: { grid: { color: gridColor() }, border: { display: false }, ticks: { color: axisColor(), font: { size: 11, family: 'Inter' }, callback: v => cur() + (v / 1000).toFixed(1) + 'k' } }
        }
      }
    });
  }

  function ensurePLChart() {
    if (charts.pl || !window.Chart) return;
    const pl = $('#plChart');
    if (!pl) return;
    charts.pl = new Chart(pl.getContext('2d'), {
      type: 'bar',
      data: { labels: [], datasets: [] },
      options: {
        ...baseOpts(),
        interaction: { intersect: false, mode: 'index' },
        scales: {
          x: { stacked: false, grid: { display: false }, ticks: { color: axisColor(), font: { size: 11, family: 'Inter' } } },
          y: { grid: { color: gridColor() }, border: { display: false }, ticks: { color: axisColor(), font: { size: 11, family: 'Inter' }, callback: v => cur() + (v / 1000).toFixed(0) + 'k' } }
        }
      }
    });
  }

  function paintCharts() {
    if (!charts.cashflow) return;

    /* cash flow */
    const keys = lastNMonths(6);
    const md = monthlyTotals(keys);
    charts.cashflow.data.labels = keys.map(monthLabel);
    charts.cashflow.data.datasets[0].data = keys.map(k => Math.round(md[k].income));
    charts.cashflow.data.datasets[1].data = keys.map(k => Math.round(md[k].expense));
    charts.cashflow.data.datasets[0].backgroundColor = makeGradient(charts.cashflow.ctx, 'rgba(99,102,241,ALPHA)');
    charts.cashflow.options.scales.x.ticks.color = axisColor();
    charts.cashflow.options.scales.y.ticks.color = axisColor();
    charts.cashflow.options.scales.y.grid.color = gridColor();
    charts.cashflow.options.plugins.legend.labels.color = axisColor();
    charts.cashflow.update();

    /* categories (this month) */
    const thisMonth = monthKey(iso(new Date()));
    const byCat = {};
    state.transactions.forEach(t => {
      if (t.type !== 'expense' || monthKey(t.date) !== thisMonth) return;
      byCat[t.cat] = (byCat[t.cat] || 0) + Number(t.amount);
    });
    const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    charts.category.data.labels = entries.map(e => e[0]);
    charts.category.data.datasets[0].data = entries.map(e => e[1]);
    charts.category.data.datasets[0].backgroundColor = entries.map(e => CAT_COLORS[e[0]] || '#94a3b8');
    charts.category.update();

    const legend = $('#categoryLegend');
    const total = entries.reduce((s, e) => s + e[1], 0) || 1;
    legend.innerHTML = entries.slice(0, 5).map(([name, val]) => `
      <li class="flex items-center justify-between text-xs">
        <span class="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <i class="dot" style="background:${CAT_COLORS[name] || '#94a3b8'}"></i>${name}
        </span>
        <span class="font-semibold text-ink-900 dark:text-white">${money(val)} · ${Math.round(val / total * 100)}%</span>
      </li>`).join('') || '<li class="text-xs text-slate-400">No expenses recorded this month.</li>';

    /* budget chart (only once the Budget view has opened) */
    if (charts.budget) {
      const budgetEntries = Object.entries(state.budgets);
      const spentByCat = {};
      state.transactions.forEach(t => {
        if (t.type === 'expense' && monthKey(t.date) === thisMonth) spentByCat[t.cat] = (spentByCat[t.cat] || 0) + Number(t.amount);
      });
      charts.budget.data.labels = budgetEntries.map(e => e[0]);
      charts.budget.data.datasets[0].data = budgetEntries.map(e => Math.round(spentByCat[e[0]] || 0));
      charts.budget.data.datasets[0].backgroundColor = budgetEntries.map(e => {
        const pct = (spentByCat[e[0]] || 0) / (e[1] || 1);
        return pct > 1 ? '#f43f5e' : pct > .85 ? '#f59e0b' : '#6366f1';
      });
      charts.budget.options.scales.x.ticks.color = axisColor();
      charts.budget.options.scales.y.ticks.color = axisColor();
      charts.budget.options.scales.y.grid.color = gridColor();
      charts.budget.update();
    }
  }

  /* ---------------------------------------------------------
     overview
  --------------------------------------------------------- */
  function renderOverview() {
    const thisMonth = monthKey(iso(new Date()));
    let income = 0, expense = 0;
    state.transactions.forEach(t => {
      if (monthKey(t.date) !== thisMonth) return;
      if (t.type === 'income') income += Number(t.amount); else expense += Number(t.amount);
    });

    const openInv = state.invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
    const receivable = openInv.reduce((s, i) => s + Number(i.amount), 0);

    const balance = 482760 + (income - expense) * 0.4;

    $('#kpiBalance').textContent = money(Math.round(balance));
    $('#kpiIncome').textContent = money(Math.round(income));
    $('#kpiExpense').textContent = money(Math.round(expense));
    $('#kpiReceivable').textContent = money(Math.round(receivable));
    $('#kpiReceivableHint').textContent = `${openInv.length} open invoice${openInv.length === 1 ? '' : 's'}`;

    /* recent transactions */
    const recent = [...state.transactions]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 6);

    $('#recentTx').innerHTML = recent.map(t => `
      <li class="flex items-center gap-3 px-4 py-3">
        <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-bold"
              style="background:${(CAT_COLORS[t.cat] || '#94a3b8')}1f;color:${CAT_COLORS[t.cat] || '#94a3b8'}">${initials(t.cat)}</span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold text-ink-900 dark:text-white">${esc(t.desc)}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">${fmtDate(t.date)} · ${t.cat}</p>
        </div>
        <div class="text-right">
          <p class="tx-amount ${t.type}">${t.type === 'income' ? '+' : '−'}${money(t.amount)}</p>
          <span class="status status-${t.status}">${t.status}</span>
        </div>
      </li>`).join('') || `<li class="px-4 py-10 text-center text-sm text-slate-400">No transactions yet</li>`;

    /* budget health */
    const spentByCat = {};
    state.transactions.forEach(t => {
      if (t.type === 'expense' && monthKey(t.date) === thisMonth) spentByCat[t.cat] = (spentByCat[t.cat] || 0) + Number(t.amount);
    });
    const top = Object.keys(state.budgets).slice(0, 5);
    $('#overviewBudget').innerHTML = top.map(cat => {
      const limit = Number(state.budgets[cat]) || 0;
      const spent = spentByCat[cat] || 0;
      const pct = limit ? Math.min((spent / limit) * 100, 100) : 0;
      const color = spent > limit ? '#f43f5e' : spent / (limit || 1) > .85 ? '#f59e0b' : '#6366f1';
      return `<div>
          <div class="budget-meta"><span class="budget-nums">${cat}</span><span class="budget-nums ${spent > limit ? 'budget-over' : ''}">${money(spent)} / ${money(limit)}</span></div>
          <div class="bar"><i style="width:${pct}%;background:${color}"></i></div>
        </div>`;
    }).join('');
  }

  const initials = s => s.slice(0, 2).toUpperCase();
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------------------------------------------------------
     transactions
  --------------------------------------------------------- */
  const txState = { search: '', type: 'all', cat: 'all', sort: 'date-desc', page: 1 };

  function filteredTx() {
    const q = txState.search.trim().toLowerCase();
    let list = state.transactions.filter(t => {
      const okQ = !q || t.desc.toLowerCase().includes(q) || t.cat.toLowerCase().includes(q) || String(t.amount).includes(q);
      const okT = txState.type === 'all' || t.type === txState.type;
      const okC = txState.cat === 'all' || t.cat === txState.cat;
      return okQ && okT && okC;
    });

    list.sort((a, b) => {
      switch (txState.sort) {
        case 'date-asc':    return a.date < b.date ? -1 : 1;
        case 'amount-desc': return b.amount - a.amount;
        case 'amount-asc':  return a.amount - b.amount;
        default:            return a.date < b.date ? 1 : -1;
      }
    });
    return list;
  }

  function renderTransactions() {
    const list = filteredTx();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (txState.page > pages) txState.page = pages;
    const start = (txState.page - 1) * PAGE_SIZE;
    const slice = list.slice(start, start + PAGE_SIZE);

    $('#txTableBody').innerHTML = slice.map(t => `
      <tr data-id="${t.id}">
        <td class="whitespace-nowrap text-slate-500 dark:text-slate-400">${fmtDate(t.date)}</td>
        <td class="tx-desc">${esc(t.desc)}</td>
        <td><span class="tx-cat"><i class="dot" style="background:${CAT_COLORS[t.cat] || '#94a3b8'}"></i>${t.cat}</span></td>
        <td class="text-right"><span class="tx-amount ${t.type}">${t.type === 'income' ? '+' : '−'}${money(t.amount)}</span></td>
        <td class="text-center"><span class="status status-${t.status}">${t.status}</span></td>
        <td>
          <div class="row-actions">
            ${can('edit') ? `
            <button class="act-btn" data-act="toggle" title="${t.status === 'completed' ? 'Mark pending' : 'Mark completed'}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><use href="#i-check"/></svg>
            </button>` : ''}
            ${can('remove') ? `
            <button class="act-btn danger" data-act="delete" title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><use href="#i-trash"/></svg>
            </button>` : ''}
            ${can('edit') || can('remove') ? '' : '<span class="text-xs text-slate-400">—</span>'}
          </div>
        </td>
      </tr>`).join('');

    const hasRows = slice.length > 0;
    $('#txEmpty').classList.toggle('hidden', hasRows || list.length > 0);
    $('#txTableBody').closest('.overflow-x-auto').classList.toggle('hidden', list.length === 0);

    $('#txShowing').textContent = hasRows
      ? `Showing ${start + 1}–${start + slice.length} of ${list.length}`
      : 'Showing 0 of 0';
    $('#txPageNum').textContent = txState.page;
    $('#txPrev').disabled = txState.page <= 1;
    $('#txNext').disabled = txState.page >= pages;
    $('#txPrev').style.opacity = txState.page <= 1 ? .45 : 1;
    $('#txNext').style.opacity = txState.page >= pages ? .45 : 1;
    $('#txSub').textContent = `${list.length} record${list.length === 1 ? '' : 's'} · ${money(list.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0))} in, ${money(list.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0))} out`;
    $('#txCount').textContent = state.transactions.length;
  }

  function populateCatFilters() {
    const used = Array.from(new Set(state.transactions.map(t => t.cat))).sort();
    const opts = '<option value="all">All categories</option>' + used.map(c => `<option value="${c}">${c}</option>`).join('');
    $('#txCatFilter').innerHTML = opts;
    $('#txCatFilter').value = txState.cat === 'all' ? 'all' : (used.includes(txState.cat) ? txState.cat : (txState.cat = 'all'));

    const catOpts = CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
    $('#tCat').innerHTML = catOpts;
  }

  /* filters wiring */
  $('#txSearch').addEventListener('input', e => { txState.search = e.target.value; txState.page = 1; renderTransactions(); });
  $('#txTypeFilter').addEventListener('change', e => { txState.type = e.target.value; txState.page = 1; renderTransactions(); });
  $('#txCatFilter').addEventListener('change', e => { txState.cat = e.target.value; txState.page = 1; renderTransactions(); });
  $('#txSort').addEventListener('change', e => { txState.sort = e.target.value; txState.page = 1; renderTransactions(); });
  $('#clearTxFilters').addEventListener('click', () => {
    txState.search = ''; txState.type = 'all'; txState.cat = 'all'; txState.sort = 'date-desc'; txState.page = 1;
    $('#txSearch').value = ''; $('#txTypeFilter').value = 'all'; $('#txCatFilter').value = 'all'; $('#txSort').value = 'date-desc';
    renderTransactions();
  });
  $('#txPrev').addEventListener('click', () => { if (txState.page > 1) { txState.page--; renderTransactions(); } });
  $('#txNext').addEventListener('click', () => { txState.page++; renderTransactions(); });

  /* row actions (event delegation) */
  $('#txTableBody').addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = btn.closest('tr').dataset.id;
    const idx = state.transactions.findIndex(t => t.id === id);
    if (idx < 0) return;

    if (btn.dataset.act === 'delete') {
      if (!can('remove')) { toast('Viewers cannot delete transactions.', 'error'); return; }
      const [removed] = state.transactions.splice(idx, 1);
      save(); renderAll();
      toast('Transaction deleted', 'info', {
        label: 'Undo',
        fn: () => { state.transactions.splice(idx, 0, removed); save(); renderAll(); toast('Transaction restored', 'success'); }
      });
    }

    if (btn.dataset.act === 'toggle') {
      if (!can('edit')) { toast('Your role has read-only access.', 'error'); return; }
      const t = state.transactions[idx];
      t.status = t.status === 'completed' ? 'pending' : 'completed';
      save(); renderAll();
      toast(`Marked as ${t.status}`, 'success');
    }
  });

  /* ---------------------------------------------------------
     invoices
  --------------------------------------------------------- */
  const invState = { status: 'all' };

  function renderInvoices() {
    const list = state.invoices.filter(i => invState.status === 'all' || i.status === invState.status);
    const sum = arr => arr.reduce((s, i) => s + Number(i.amount), 0);

    $('#invTotal').textContent = money(Math.round(sum(state.invoices)));
    $('#invPaid').textContent = money(Math.round(sum(state.invoices.filter(i => i.status === 'paid'))));
    $('#invOpen').textContent = money(Math.round(sum(state.invoices.filter(i => i.status === 'sent'))));
    $('#invOverdue').textContent = money(Math.round(sum(state.invoices.filter(i => i.status === 'overdue'))));

    $('#invTableBody').innerHTML = list.map(i => `
      <tr data-id="${i.id}">
        <td class="font-semibold text-ink-900 dark:text-white">${esc(i.no)}</td>
        <td class="tx-desc">${esc(i.client)}</td>
        <td class="whitespace-nowrap text-slate-500 dark:text-slate-400">${fmtDate(i.issued)}</td>
        <td class="whitespace-nowrap text-slate-500 dark:text-slate-400">${fmtDate(i.due)}</td>
        <td class="text-right"><span class="tx-amount">${money(i.amount)}</span></td>
        <td class="text-center">
          <select data-act="status" ${can('edit') ? '' : 'disabled'} class="input-field !w-32 !py-1 !text-center !text-xs font-semibold ${can('edit') ? '' : 'cursor-not-allowed opacity-60'}">
            ${['draft', 'sent', 'paid', 'overdue'].map(s => `<option value="${s}" ${s === i.status ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </td>
        <td>
          <div class="row-actions">
            ${can('edit') ? `
            <button class="act-btn" data-act="remind" title="Send reminder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><use href="#i-bell"/></svg>
            </button>` : ''}
            ${can('remove') ? `
            <button class="act-btn danger" data-act="delete" title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><use href="#i-trash"/></svg>
            </button>` : ''}
            ${can('edit') || can('remove') ? '' : '<span class="text-xs text-slate-400">—</span>'}
          </div>
        </td>
      </tr>`).join('');

    $('#invEmpty').classList.toggle('hidden', list.length > 0);
    $('#invTableBody').closest('.overflow-x-auto').classList.toggle('hidden', list.length === 0);
    $('#invSub').textContent = `${list.length} invoice${list.length === 1 ? '' : 's'} shown`;
    $('#invCount').textContent = state.invoices.filter(i => i.status !== 'paid').length;
  }

  $('#invStatusFilter').addEventListener('change', e => { invState.status = e.target.value; renderInvoices(); });

  $('#invTableBody').addEventListener('change', e => {
    const sel = e.target.closest('[data-act="status"]');
    if (!sel) return;
    if (!can('edit')) { sel.value = (state.invoices.find(i => i.id === sel.closest('tr').dataset.id) || {}).status; toast('Your role has read-only access.', 'error'); return; }
    const id = sel.closest('tr').dataset.id;
    const inv = state.invoices.find(i => i.id === id);
    if (!inv) return;
    inv.status = sel.value;
    save(); renderInvoices(); renderOverview();
    toast(`${inv.no} marked as ${inv.status}`, 'success');
  });

  $('#invTableBody').addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.closest('tr').dataset.id;
    const idx = state.invoices.findIndex(i => i.id === id);
    if (idx < 0) return;

    if (btn.dataset.act === 'delete') {
      if (!can('remove')) { toast('Your role cannot delete invoices.', 'error'); return; }
      const [removed] = state.invoices.splice(idx, 1);
      save(); renderAll();
      toast('Invoice deleted', 'info', {
        label: 'Undo',
        fn: () => { state.invoices.splice(idx, 0, removed); save(); renderAll(); toast('Invoice restored', 'success'); }
      });
    }
    if (btn.dataset.act === 'remind') {
      if (!can('edit')) { toast('Your role has read-only access.', 'error'); return; }
      const inv = state.invoices[idx];
      if (inv.status === 'paid') { toast(`${inv.no} is already paid`, 'info'); return; }
      toast(`Reminder sent to ${inv.client}`, 'success');
    }
  });

  /* ---------------------------------------------------------
     budget
  --------------------------------------------------------- */
  function renderBudget() {
    const thisMonth = monthKey(iso(new Date()));
    const spent = {};
    state.transactions.forEach(t => {
      if (t.type === 'expense' && monthKey(t.date) === thisMonth) spent[t.cat] = (spent[t.cat] || 0) + Number(t.amount);
    });

    const entries = Object.entries(state.budgets);
    const totalLimit = entries.reduce((s, e) => s + Number(e[1] || 0), 0);
    $('#budgetTotal').textContent = money(Math.round(totalLimit));

    $('#budgetList').innerHTML = entries.map(([cat, limit]) => {
      const s = spent[cat] || 0;
      const l = Number(limit) || 0;
      const pct = l ? Math.round((s / l) * 100) : 0;
      const color = s > l ? '#f43f5e' : pct > 85 ? '#f59e0b' : '#6366f1';
      return `
        <div class="budget-card">
          <div class="budget-card-head">
            <strong class="flex items-center gap-2"><i class="dot" style="background:${CAT_COLORS[cat] || '#94a3b8'}"></i>${cat}</strong>
            <input class="budget-limit" type="number" min="0" step="100" value="${l}" data-cat="${cat}" aria-label="${cat} monthly limit" ${can('edit') ? '' : 'disabled style="opacity:.55;cursor:not-allowed"'}>
          </div>
          <div class="budget-meta">
            <span>Spent <span class="budget-nums ${s > l ? 'budget-over' : ''}">${money(Math.round(s))}</span></span>
            <span>${pct}% used</span>
          </div>
          <div class="bar"><i style="width:${Math.min(pct, 100)}%;background:${color}"></i></div>
          <p class="mt-2 text-[.72rem] ${s > l ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}">
            ${s > l ? `${money(Math.round(s - l))} over the limit` : `${money(Math.round(l - s))} remaining`}
          </p>
        </div>`;
    }).join('');
  }

  $('#budgetList').addEventListener('input', e => {
    const input = e.target.closest('.budget-limit');
    if (!input) return;
    if (!can('edit')) { input.value = state.budgets[input.dataset.cat]; toast('Your role has read-only access.', 'error'); return; }
    state.budgets[input.dataset.cat] = Math.max(0, Number(input.value) || 0);
    save();
    const thisMonth = monthKey(iso(new Date()));
    const cat = input.dataset.cat;
    const spent = state.transactions
      .filter(t => t.type === 'expense' && t.cat === cat && monthKey(t.date) === thisMonth)
      .reduce((s, t) => s + Number(t.amount), 0);
    const pct = state.budgets[cat] ? Math.round(spent / state.budgets[cat] * 100) : 0;
    const card = input.closest('.budget-card');
    const bar = card.querySelector('.bar i');
    bar.style.width = Math.min(pct, 100) + '%';
    bar.style.background = spent > state.budgets[cat] ? '#f43f5e' : pct > 85 ? '#f59e0b' : '#6366f1';
    card.querySelector('.budget-meta span:last-child').textContent = pct + '% used';
    card.querySelector('p').textContent = spent > state.budgets[cat]
      ? `${money(Math.round(spent - state.budgets[cat]))} over the limit`
      : `${money(Math.round(state.budgets[cat] - spent))} remaining`;
    card.querySelector('p').className = `mt-2 text-[.72rem] ${spent > state.budgets[cat] ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`;
    $('#budgetTotal').textContent = money(Math.round(Object.values(state.budgets).reduce((s, v) => s + Number(v || 0), 0)));
    paintCharts();
    renderOverview();
  });

  /* ---------------------------------------------------------
     reports
  --------------------------------------------------------- */
  function renderReports() {
    if (!window.Chart) return;
    const keys = lastNMonths(6);
    const md = monthlyTotals(keys);

    const income = keys.map(k => Math.round(md[k].income));
    const expense = keys.map(k => Math.round(md[k].expense));
    const net = keys.map((k, i) => income[i] - expense[i]);

    if (charts.pl) {
      charts.pl.data.labels = keys.map(monthLabel);
      charts.pl.data.datasets = [
        { label: 'Income', data: income, backgroundColor: '#6366f1', borderRadius: 8, barPercentage: .65, categoryPercentage: .7 },
        { label: 'Expenses', data: expense, backgroundColor: '#f59e0b', borderRadius: 8, barPercentage: .65, categoryPercentage: .7 },
        { label: 'Net profit', data: net, type: 'line', borderColor: '#10b981', backgroundColor: '#10b981', borderWidth: 2.5, tension: .4, pointRadius: 4, pointBorderWidth: 0 }
      ];
      charts.pl.options.scales.x.ticks.color = axisColor();
      charts.pl.options.scales.y.ticks.color = axisColor();
      charts.pl.options.scales.y.grid.color = gridColor();
      charts.pl.options.plugins.legend.labels.color = axisColor();
      charts.pl.update();
    }

    const totIn = income.reduce((a, b) => a + b, 0);
    const totEx = expense.reduce((a, b) => a + b, 0);
    const totNet = totIn - totEx;
    const margin = totIn ? (totNet / totIn) * 100 : 0;

    const row = (label, value, cls = '') => `
      <tr>
        <td class="py-3 text-slate-500 dark:text-slate-400">${label}</td>
        <td class="py-3 text-right font-display font-bold ${cls || 'text-ink-900 dark:text-white'}">${value}</td>
      </tr>`;

    $('#plTable').innerHTML =
      row('Total revenue (6 mo)', money(totIn)) +
      row('Total expenses (6 mo)', '−' + money(totEx), 'text-rose-600 dark:text-rose-400') +
      row('Net profit', money(totNet), totNet >= 0 ? 'text-mint-600 dark:text-mint-400' : 'text-rose-600 dark:text-rose-400') +
      row('Best month', money(Math.max(...net)), 'text-brand-600 dark:text-brand-400') +
      row('Avg. monthly revenue', money(Math.round(totIn / 6))) +
      row('Avg. monthly spend', money(Math.round(totEx / 6)));

    const avgMonthlyBurn = totEx / 6;
    const profitMargin = margin;
    const expenseRatio = totIn ? (totEx / totIn) * 100 : 0;

    const ratio = (label, value, pct, color) => `
      <div>
        <div class="flex items-baseline justify-between text-sm">
          <span class="text-slate-500 dark:text-slate-400">${label}</span>
          <span class="font-display font-bold text-ink-900 dark:text-white">${value}</span>
        </div>
        <div class="bar mt-2"><i style="width:${Math.max(4, Math.min(pct, 100))}%;background:${color}"></i></div>
      </div>`;

    $('#ratioList').innerHTML =
      ratio('Profit margin', profitMargin.toFixed(1) + '%', profitMargin, '#10b981') +
      ratio('Expense ratio', expenseRatio.toFixed(1) + '%', expenseRatio, '#f59e0b') +
      ratio('Avg. monthly burn', money(Math.round(avgMonthlyBurn)), 65, '#6366f1') +
      ratio('Recurring revenue share', '72%', 72, '#8b5cf6');
  }

  /* ---------------------------------------------------------
     CSV export
  --------------------------------------------------------- */
  function downloadCSV(filename, rows) {
    const csv = rows.map(r => r.map(c => {
      const v = String(c ?? '');
      return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(',')).join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`${filename} exported`, 'success');
  }

  $('#exportTx').addEventListener('click', () => {
    if (!can('export')) { toast('Your role cannot export data.', 'error'); return; }
    const rows = [['Date', 'Description', 'Category', 'Type', 'Amount', 'Status']];
    filteredTx().forEach(t => rows.push([t.date, t.desc, t.cat, t.type, t.amount, t.status]));
    downloadCSV('stackly-transactions.csv', rows);
  });

  $('#exportInv').addEventListener('click', () => {
    if (!can('export')) { toast('Your role cannot export data.', 'error'); return; }
    const rows = [['Invoice', 'Client', 'Issued', 'Due', 'Amount', 'Status']];
    state.invoices.forEach(i => rows.push([i.no, i.client, i.issued, i.due, i.amount, i.status]));
    downloadCSV('stackly-invoices.csv', rows);
  });

  $('#exportReport').addEventListener('click', () => {
    if (!can('export')) { toast('Your role cannot export data.', 'error'); return; }
    const keys = lastNMonths(6);
    const md = monthlyTotals(keys);
    const rows = [['Month', 'Income', 'Expenses', 'Net profit']];
    keys.forEach(k => rows.push([k, Math.round(md[k].income), Math.round(md[k].expense), Math.round(md[k].income - md[k].expense)]));
    downloadCSV('stackly-profit-and-loss.csv', rows);
  });

  $('#printReport').addEventListener('click', () => {
    toast('Opening print dialog…', 'info');
    setTimeout(() => window.print(), 350);
  });

  /* ---------------------------------------------------------
     modals
  --------------------------------------------------------- */
  function openModal(id) {
    const m = document.getElementById(id);
    m.hidden = false;
    const first = m.querySelector('input, select');
    setTimeout(() => first && first.focus(), 60);
  }
  function closeModal(id) { document.getElementById(id).hidden = true; }

  document.addEventListener('click', e => {
    const closer = e.target.closest('[data-close]');
    if (closer) closeModal(closer.dataset.close);
    if (e.target.classList && e.target.classList.contains('modal-backdrop')) e.target.hidden = true;
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') $$('.modal-backdrop').forEach(m => m.hidden = true);
  });

  /* --- transaction modal --- */
  $('#openTxModal').addEventListener('click', () => {
    if (!can('create')) { toast('Your role cannot add transactions.', 'error'); return; }
    $('#txForm').reset();
    $('#tDate').value = iso(new Date());
    $('#tCat').value = 'Sales';
    clearErrors('#txForm');
    openModal('txModal');
  });

  $('#txForm').addEventListener('submit', e => {
    e.preventDefault();
    if (!can('create')) { closeModal('txModal'); toast('Your role cannot add transactions.', 'error'); return; }
    const desc = $('#tDesc').value.trim();
    const amount = parseFloat($('#tAmount').value);
    const date = $('#tDate').value;

    let ok = true;
    if (desc.length < 2) { setError('tDesc', 'Add a short description.'); ok = false; } else setError('tDesc', '');
    if (!(amount > 0)) { setError('tAmount', 'Enter an amount greater than 0.'); ok = false; } else setError('tAmount', '');
    if (!date) { setError('tDate', 'Pick a date.'); ok = false; } else setError('tDate', '');
    if (!ok) return;

    state.transactions.push({
      id: uid(),
      desc, amount,
      date,
      type: $('#tType').value,
      cat: $('#tCat').value,
      status: $('#tStatus').value
    });
    save();
    closeModal('txModal');
    populateCatFilters();
    renderAll();
    toast('Transaction added', 'success');
  });

  /* --- invoice modal --- */
  $('#openInvModal').addEventListener('click', () => {
    if (!can('create')) { toast('Your role cannot create invoices.', 'error'); return; }
    $('#invForm').reset();
    $('#iIssued').value = iso(new Date());
    $('#iDue').value = daysAhead(14);
    clearErrors('#invForm');
    openModal('invModal');
  });

  $('#invForm').addEventListener('submit', e => {
    e.preventDefault();
    if (!can('create')) { closeModal('invModal'); toast('Your role cannot create invoices.', 'error'); return; }
    const client = $('#iClient').value.trim();
    const amount = parseFloat($('#iAmount').value);
    const issued = $('#iIssued').value;
    const due = $('#iDue').value;

    let ok = true;
    if (client.length < 2) { setError('iClient', 'Client name is required.'); ok = false; } else setError('iClient', '');
    if (!(amount > 0)) { setError('iAmount', 'Enter an amount greater than 0.'); ok = false; } else setError('iAmount', '');
    if (!issued) { setError('iIssued', 'Pick an issue date.'); ok = false; } else setError('iIssued', '');
    if (!due) { setError('iDue', 'Pick a due date.'); ok = false; }
    else if (issued && due < issued) { setError('iDue', 'Due date must be after the issue date.'); ok = false; }
    else setError('iDue', '');
    if (!ok) return;

    const maxNo = state.invoices.reduce((m, i) => Math.max(m, parseInt(String(i.no).replace(/\D/g, ''), 10) || 0), 1000);
    state.invoices.unshift({
      id: uid(),
      no: 'ST-' + (maxNo + 1),
      client, amount, issued, due,
      status: $('#iStatus').value
    });
    save();
    closeModal('invModal');
    renderAll();
    toast('Invoice created', 'success');
  });

  /* --- validation helpers --- */
  function setError(id, msg) {
    const input = document.getElementById(id);
    if (!input) return;
    const field = input.closest('.field');
    const err = field && field.querySelector(`.err[data-for="${id}"]`);
    if (!field) return;
    field.classList.toggle('is-invalid', !!msg);
    if (err) err.textContent = msg || '';
  }
  function clearErrors(formSel) {
    $$(formSel + ' .field').forEach(f => { f.classList.remove('is-invalid'); const e = f.querySelector('.err'); if (e) e.textContent = ''; });
  }

  /* ---------------------------------------------------------
     settings
  --------------------------------------------------------- */
  function renderSettings() {
    const s = state.settings;
    $('#sBusiness').value = s.business || '';
    $('#sEmail').value = s.email || '';
    $('#sTax').value = s.tax || '';
    $('#sAddress').value = s.address || '';
    $('#sCurrency').value = s.currency || '$';
    $('#remindersToggle').setAttribute('aria-checked', String(!!s.reminders));
  }

  $('#settingsForm').addEventListener('submit', e => {
    e.preventDefault();
    state.settings.business = $('#sBusiness').value.trim() || 'Stackly Inc.';
    state.settings.email = $('#sEmail').value.trim();
    state.settings.tax = $('#sTax').value.trim();
    state.settings.address = $('#sAddress').value.trim();
    save();
    toast('Business profile saved', 'success');
  });

  $('#sCurrency').addEventListener('change', e => {
    state.settings.currency = e.target.value;
    save();
    renderAll();
    toast(`Currency set to ${e.target.value}`, 'success');
  });

  $('#remindersToggle').addEventListener('click', e => {
    const btn = e.currentTarget;
    const next = btn.getAttribute('aria-checked') !== 'true';
    btn.setAttribute('aria-checked', String(next));
    state.settings.reminders = next;
    save();
    toast(`Email reminders ${next ? 'enabled' : 'disabled'}`, 'info');
  });

  $('#settingsThemeToggle').addEventListener('click', toggleTheme);
  $('#themeToggle').addEventListener('click', toggleTheme);

  $('#resetData').addEventListener('click', () => {
    if (!can('remove')) { toast('Only admins can reset demo data.', 'error'); return; }
    if (!confirm('Reset all demo data back to the sample set? Your changes will be lost.')) return;
    state = seed();
    save();
    populateCatFilters();
    renderAll();
    renderSettings();
    toast('Demo data has been reset', 'success');
  });

  $('#logoutBtn').addEventListener('click', () => Auth.logout('index.html'));

  /* ---------------------------------------------------------
     notifications
  --------------------------------------------------------- */
  function renderNotifications() {
    const overdue = state.invoices.filter(i => i.status === 'overdue');
    const pending = state.transactions.filter(t => t.status === 'pending');
    const thisMonth = monthKey(iso(new Date()));

    const spent = {};
    state.transactions.forEach(t => {
      if (t.type === 'expense' && monthKey(t.date) === thisMonth) spent[t.cat] = (spent[t.cat] || 0) + Number(t.amount);
    });
    const over = Object.entries(state.budgets).filter(([c, l]) => (spent[c] || 0) > Number(l));

    const items = [];
    overdue.forEach(i => items.push({ icon: 'i-alert', color: 'text-rose-500', text: `${i.no} · ${i.client} is overdue by ${money(i.amount)}`, when: fmtDate(i.due) }));
    if (pending.length) items.push({ icon: 'i-clock', color: 'text-brand-500', text: `${pending.length} transaction${pending.length === 1 ? '' : 's'} awaiting reconciliation`, when: 'Now' });
    over.forEach(([c]) => items.push({ icon: 'i-wallet', color: 'text-amber-500', text: `${c} is over its monthly budget`, when: 'This month' }));
    items.push({ icon: 'i-shield', color: 'text-mint-500', text: 'Nightly backup completed successfully', when: '2h ago' });

    $('#bellList').innerHTML = items.map(n => `
      <li class="flex gap-3 px-4 py-3">
        <span class="mt-.5 shrink-0 ${n.color}"><svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><use href="#${n.icon}"/></svg></span>
        <div class="min-w-0">
          <p class="text-xs font-medium leading-snug text-ink-900 dark:text-white">${esc(n.text)}</p>
          <p class="mt-.5 text-[.7rem] text-slate-400">${n.when}</p>
        </div>
      </li>`).join('');
  }

  $('#bellBtn').addEventListener('click', e => {
    e.stopPropagation();
    $('#bellPanel').classList.toggle('hidden');
  });
  document.addEventListener('click', e => {
    const p = $('#bellPanel');
    if (!p.classList.contains('hidden') && !p.contains(e.target) && !e.target.closest('#bellBtn')) p.classList.add('hidden');
  });

  /* ---------------------------------------------------------
     global search
  --------------------------------------------------------- */
  $('#globalSearch').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    txState.search = e.target.value;
    txState.page = 1;
    $('#txSearch').value = e.target.value;
    goto('transactions');
    renderTransactions();
  });
  $('#globalSearch').addEventListener('input', e => {
    if (currentView === 'transactions') {
      txState.search = e.target.value;
      txState.page = 1;
      $('#txSearch').value = e.target.value;
      renderTransactions();
    }
  });

  /* ---------------------------------------------------------
     CSV is done, now wire everything up
  --------------------------------------------------------- */
  function renderAll() {
    renderOverview();
    populateCatFilters();
    renderTransactions();
    renderInvoices();
    renderBudget();
    renderNotifications();
    paintCharts();
    if (currentView === 'reports') renderReports();
    $('#txCount').textContent = state.transactions.length;
    $('#invCount').textContent = state.invoices.filter(i => i.status !== 'paid').length;
  }

  /* ---------------------------------------------------------
     identity + role-based UI
  --------------------------------------------------------- */
  function applyRoleUI() {
    const id = Auth.identity();
    if (id) {
      $('#sideUserName').textContent = id.name;
      $('#sideUserRole').textContent = id.roleInfo.label + ' · ' + id.company;
      if ($('#sideAvatar')) $('#sideAvatar').textContent = id.initials;
      $('#topUserName').textContent = id.name;
      if ($('#topAvatar')) $('#topAvatar').textContent = id.initials;
      const badge = $('#topRoleBadge');
      if (badge) {
        badge.textContent = id.roleInfo.label;
        badge.className = 'role-badge on-light ' + id.role;
      }
    }

    /* hide what this role is not allowed to use */
    const hide = sel => { const el = $(sel); if (el) el.style.display = 'none'; };
    if (!can('viewSettings')) hide('.side-link[data-view="settings"]');
    if (!can('create')) { hide('#openTxModal'); hide('#openInvModal'); }
    if (!can('export')) { hide('#exportTx'); hide('#exportInv'); hide('#exportReport'); }
    if (!can('remove')) hide('#resetData');

    if (id) toast(`Signed in as ${id.roleInfo.label} — ${id.name}`, 'success');
  }

  /* boot */
  applyRoleUI();
  applyTheme(state.settings.theme === 'dark' ? 'dark' : 'light');
  buildCharts();
  renderSettings();
  renderAll();
  renderReports();

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1024) closeSidebar();
  });
})();

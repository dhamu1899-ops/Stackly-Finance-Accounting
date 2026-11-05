/* =========================================================
   Stackly — shared marketing site script
   js/main.js   (multi-page: home, features, pricing, about, contact)
   ========================================================= */
(function () {
  'use strict';

  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* ---------- footer year ---------- */
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- active nav link for current page ---------- */
  const currentFile = (location.pathname.split('/').pop() || 'index.html').split('?')[0];
  $$('.nav-link, .mobile-panel a').forEach(a => {
    const href = (a.getAttribute('href') || '').split('?')[0];
    if (href === currentFile) a.classList.add('is-active');
  });

  /* ---------- signed-in state: swap "Log in" for the dashboard username ---------- */
  if (window.StacklyAuth && typeof StacklyAuth.identity === 'function') {
    const who = StacklyAuth.identity();
    if (who) {
      const navActions = $('.nav-actions');
      if (navActions) {
        const loginLink = navActions.querySelector('.nav-ghost');
        if (loginLink) loginLink.remove();
        if (!navActions.querySelector('.nav-user')) {
          const chip = document.createElement('a');
          chip.className = 'nav-user';
          chip.href = 'dashboard.html';
          chip.title = 'Open dashboard';
          chip.setAttribute('aria-label', 'Open dashboard as ' + who.name);
          chip.innerHTML = '<span class="nav-user-av" aria-hidden="true"></span><span class="nav-user-name"></span>';
          chip.querySelector('.nav-user-av').textContent = who.initials;
          chip.querySelector('.nav-user-name').textContent = who.name;
          navActions.insertBefore(chip, navActions.firstChild);
        }
      }
      const panel = document.getElementById('mobilePanel');
      if (panel) {
        const mLogin = panel.querySelector('a[href="login.html"]');
        if (mLogin) { mLogin.setAttribute('href', 'dashboard.html'); mLogin.textContent = who.name; }
      }
      // coming back via bfcache after a logout? reload so the chip state is fresh
      window.addEventListener('pageshow', e => { if (e.persisted) location.reload(); });
    }
  }

  /* ---------- header: glass over hero → solid when scrolled past ---------- */
  const header = $('#siteHeader');
  const hero   = $('.hero');
  const progress = $('#scrollProgress');
  const toTop  = $('#toTop');

  const onScroll = () => {
    const y = window.scrollY;
    if (header) {
      const threshold = hero ? Math.max(hero.offsetHeight - 110, 60) : 40;
      header.classList.toggle('is-stuck', y > threshold);
    }
    if (progress) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
    }
    if (toTop) toTop.classList.toggle('is-visible', y > 700);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  toTop && toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  /* ---------- mobile menu ---------- */
  const menuBtn = $('#menuBtn');
  const panel   = $('#mobilePanel');
  if (menuBtn && panel) {
    menuBtn.addEventListener('click', e => {
      e.stopPropagation();
      panel.classList.toggle('is-open');
      menuBtn.setAttribute('aria-expanded', String(panel.classList.contains('is-open')));
    });
    $$('a', panel).forEach(a => a.addEventListener('click', () => panel.classList.remove('is-open')));
    document.addEventListener('click', e => {
      if (!panel.contains(e.target) && !menuBtn.contains(e.target)) panel.classList.remove('is-open');
    });
  }

  /* ---------- scroll reveal ---------- */
  const revealEls = $$('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const idx = Number(e.target.dataset.revealIndex || 0);
          setTimeout(() => e.target.classList.add('in'), Math.min(idx, 6) * 80);
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.01, rootMargin: '0px' });

    // stagger index per section
    const groups = new Map();
    revealEls.forEach(el => {
      const parent = el.parentElement;
      const i = groups.get(parent) || 0;
      el.dataset.revealIndex = i;
      groups.set(parent, i + 1);
      io.observe(el);
    });

    const revealVisible = () => revealEls.forEach(el => {
      if (el.classList.contains('in')) return;
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('in');
    });
    window.addEventListener('load', revealVisible);
    window.addEventListener('resize', revealVisible);
    revealVisible();
  } else {
    revealEls.forEach(el => el.classList.add('in'));
  }

  /* ---------- animated counters ---------- */
  const fmt = (n, d) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

  const runCounter = el => {
    const target = parseFloat(el.dataset.count);
    if (isNaN(target)) return;
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const dur = 1700;
    const start = performance.now();
    const step = now => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + fmt(target * eased, decimals) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const counters = $$('[data-count]');
  if ('IntersectionObserver' in window && counters.length) {
    const co = new IntersectionObserver((entries, obs) => {
      entries.forEach(e => { if (e.isIntersecting) { runCounter(e.target); obs.unobserve(e.target); } });
    }, { threshold: 0.4 });
    counters.forEach(el => co.observe(el));
  } else counters.forEach(runCounter);

  /* ---------- charts (hero + reporting demo) ---------- */
  const chartFont = { family: 'Inter, sans-serif' };

  function gradient(ctx, rgb, a1, a2) {
    const g = ctx.createLinearGradient(0, 0, 0, 240);
    g.addColorStop(0, `rgba(${rgb},${a1})`);
    g.addColorStop(1, `rgba(${rgb},${a2})`);
    return g;
  }

  const heroCanvas = $('#heroChart');
  if (heroCanvas && window.Chart) {
    const ctx = heroCanvas.getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        datasets: [{
          data: [210, 268, 245, 312, 348, 336, 421],
          borderColor: '#34d399',
          backgroundColor: gradient(ctx, '52,211,153', .45, 0),
          fill: true, tension: .4, borderWidth: 2.5, pointRadius: 0,
          pointHoverRadius: 5, pointHoverBackgroundColor: '#34d399'
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { displayColors: false, callbacks: { label: c => '$' + c.parsed.y + 'k' } } },
        scales: { x: { display: false }, y: { display: false, beginAtZero: true } },
        interaction: { intersect: false, mode: 'index' }
      }
    });
  }

  const reportCanvas = $('#reportChart');
  if (reportCanvas && window.Chart) {
    new Chart(reportCanvas, {
      type: 'bar',
      data: {
        labels: ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        datasets: [
          { label: 'Revenue', data: [182, 205, 198, 244, 268, 301], backgroundColor: '#6366f1', borderRadius: 8, barPercentage: .6, categoryPercentage: .72 },
          { label: 'Expenses', data: [121, 134, 128, 152, 166, 178], backgroundColor: '#e2e8f0', borderRadius: 8, barPercentage: .6, categoryPercentage: .72 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, font: { size: 11, ...chartFont } } },
          tooltip: { callbacks: { label: c => `${c.dataset.label}: $${c.parsed.y}k` } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11, ...chartFont }, color: '#94a3b8' } },
          y: { grid: { color: 'rgba(148,163,184,.18)' }, border: { display: false }, ticks: { font: { size: 11, ...chartFont }, color: '#94a3b8', callback: v => '$' + v + 'k' } }
        }
      }
    });
  }

  /* ---------- tab groups ---------- */
  $$('[data-tabs]').forEach(group => {
    const btns = $$('[data-tab]', group);
    btns.forEach(btn => btn.addEventListener('click', () => {
      btns.forEach(b => { b.classList.remove('is-active', 'is-active'); b.setAttribute('aria-selected', 'false'); });
      btn.classList.add('is-active');
      btn.setAttribute('aria-selected', 'true');
      const scope = group.dataset.tabs;
      $$(`[data-panel-scope="${scope}"]`).forEach(p => p.classList.toggle('is-active', p.dataset.panel === btn.dataset.tab));
    }));
  });

  /* ---------- pricing billing toggle ---------- */
  const billMonthly = $('#billMonthly');
  const billYearly  = $('#billYearly');
  if (billMonthly && billYearly) {
    const setBilling = mode => {
      const yearly = mode === 'yearly';
      billMonthly.classList.toggle('is-active', !yearly);
      billYearly.classList.toggle('is-active', yearly);
      $$('.price').forEach(el => {
        const from = parseFloat(el.textContent);
        const to = parseFloat(yearly ? el.dataset.yearly : el.dataset.monthly);
        if (isNaN(from) || isNaN(to) || from === to) { el.textContent = to; return; }
        const start = performance.now(), dur = 420;
        const step = now => {
          const p = Math.min((now - start) / dur, 1);
          el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      $$('.price-note').forEach(el => { el.textContent = yearly ? (el.dataset.noteYearly || '') : (el.dataset.noteMonthly || ''); });
      $$('[data-billing-note]').forEach(el => { el.textContent = yearly ? el.dataset.yearlyNote : el.dataset.monthlyNote; });
    };
    billMonthly.addEventListener('click', () => setBilling('monthly'));
    billYearly.addEventListener('click', () => setBilling('yearly'));
  }

  /* ---------- carousels ---------- */
  $$('[data-carousel]').forEach(root => {
    const track = $('[data-carousel-track]', root);
    const prev  = $('[data-carousel-prev]', root);
    const next  = $('[data-carousel-next]', root);
    if (!track) return;
    const step = () => {
      const card = track.firstElementChild;
      return card ? card.getBoundingClientRect().width + 24 : 340;
    };
    prev && prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
    next && next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
  });

  /* ---------- single-open accordions ---------- */
  $$('details.faq-card, details.faq-item').forEach(item => {
    item.addEventListener('toggle', () => {
      if (!item.open) return;
      const list = item.parentElement;
      $$('details', list).forEach(other => { if (other !== item) other.open = false; });
    });
  });

  /* ---------- form helpers ---------- */
  const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

  function setError(id, msg) {
    const input = document.getElementById(id);
    if (!input) return;
    const field = input.closest('.field');
    if (!field) return;
    const err = field.querySelector(`.err[data-for="${id}"]`);
    field.classList.toggle('is-invalid', !!msg);
    if (err) err.textContent = msg || '';
  }

  function toast(msg, type = 'info') {
    let host = document.getElementById('toastHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toastHost';
      host.className = 'toast-host';
      document.body.appendChild(host);
    }
    const icons = {
      success: '<polyline points="20 6 9 17 4 12"/>',
      error: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
      info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'
    };
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML =
      `<span class="t-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${icons[type] || icons.info}</svg></span><span>${msg}</span>`;
    host.appendChild(el);
    setTimeout(() => { el.classList.add('hide'); setTimeout(() => el.remove(), 320); }, 3400);
  }
  window.stacklyToast = toast;

  /* contact / demo form */
  const contactForm = $('#contactForm');
  if (contactForm) {
    const rules = {
      cName:    v => (v.trim().length >= 2 ? '' : 'Please enter your full name.'),
      cEmail:   v => (emailOk(v.trim()) ? '' : 'Enter a valid work email address.'),
      cCompany: v => (v.trim().length >= 2 ? '' : 'Company name is required.'),
      cTeam:    v => (v ? '' : 'Select a team size.'),
      cMsg:     v => (v.trim().length >= 10 ? '' : 'Tell us a little more (10+ characters).')
    };
    Object.keys(rules).forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const revalidate = () => {
        if (el.closest('.field').classList.contains('is-invalid')) setError(id, rules[id](el.value));
      };
      el.addEventListener('blur', () => setError(id, rules[id](el.value)));
      el.addEventListener('input', revalidate);
      el.addEventListener('change', () => setError(id, rules[id](el.value)));
    });

    contactForm.addEventListener('submit', e => {
      e.preventDefault();
      let valid = true;
      Object.keys(rules).forEach(id => {
        const msg = rules[id](document.getElementById(id).value);
        setError(id, msg);
        if (msg) valid = false;
      });
      const status = $('#formStatus');
      if (!valid) {
        if (status) status.classList.add('hidden');
        const firstBad = contactForm.querySelector('.is-invalid input, .is-invalid select, .is-invalid textarea');
        firstBad && firstBad.focus();
        toast('Please fix the highlighted fields.', 'error');
        return;
      }
      const btn = contactForm.querySelector('button[type="submit"]');
      const original = btn ? btn.innerHTML : '';
      if (btn) { btn.disabled = true; btn.innerHTML = 'Sending…'; }
      setTimeout(() => {
        if (btn) { btn.disabled = false; btn.innerHTML = original; }
        const name = (document.getElementById('cName').value || '').trim().split(' ')[0];
        if (status) {
          status.textContent = `Thanks ${name}! Our team will email you within one business day to schedule your walkthrough.`;
          status.classList.remove('hidden');
        }
        contactForm.reset();
        toast('Request received — we\'ll be in touch.', 'success');
      }, 900);
    });
  }

  /* newsletter */
  const nlForm = $('#newsletterForm');
  if (nlForm) {
    nlForm.addEventListener('submit', e => {
      e.preventDefault();
      const input = $('#nlEmail');
      const status = $('#nlStatus');
      if (!input || !emailOk(input.value.trim())) {
        if (status) { status.textContent = 'Please enter a valid email address.'; status.className = 'mt-2 text-sm font-medium text-rose-400'; }
        input && input.focus();
        return;
      }
      if (status) { status.textContent = 'Subscribed — welcome aboard.'; status.className = 'mt-2 text-sm font-medium text-mint-400'; }
      input.value = '';
      toast('Subscribed to the Stackly ledger.', 'success');
    });
  }

  /* ---------- smooth in-page anchors ---------- */
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (!id || id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top, behavior: 'smooth' });
      history.replaceState(null, '', id);
    });
  });

  /* ---------- broken photo → drop image so CSS art shows through ---------- */
  $$('img[data-fallback]').forEach(img => {
    img.addEventListener('error', () => img.remove());
  });
})();

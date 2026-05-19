// Jorczak.com — Circumnavigation Budget App
// Single-page renderer for months.json. No build tools, no dependencies.

const STATE = {
  data: null,
  currentYear: 1,
  currentMonth: { 1: 'm01', 2: 'm13', 3: 'm25' }
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const fmt = (n) => '$' + Math.round(n).toLocaleString();
const fmtK = (n) => n >= 1000 ? '$' + (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'K' : '$' + Math.round(n);
const round25 = (n) => Math.round(n / 25) * 25;

// ============================================================
// DATA HELPERS
// ============================================================

// Combine recurring items into every month's lines for rendering
function getMonthLines(month) {
  return [
    ...STATE.data.recurring.map(r => ({ ...r, recurring: true })),
    ...month.lines
  ];
}

// Derive lo/hi from mid using per-category multipliers
function loHi(line) {
  const range = STATE.data.loHiRanges[line.cat] || [0.85, 1.25];
  return {
    lo: round25(line.mid * range[0]),
    hi: round25(line.mid * range[1])
  };
}

// Sum month total at lo, mid, hi
function monthTotals(month) {
  const lines = getMonthLines(month);
  let lo = 0, mid = 0, hi = 0;
  for (const line of lines) {
    const r = loHi(line);
    lo += r.lo;
    mid += line.mid;
    hi += r.hi;
  }
  return { lo, mid, hi };
}

// Group lines by category, return ordered array per categories config
function groupByCat(lines) {
  const order = Object.keys(STATE.data.categories);
  const groups = new Map();
  for (const line of lines) {
    if (!groups.has(line.cat)) groups.set(line.cat, []);
    groups.get(line.cat).push(line);
  }
  return order
    .filter(key => groups.has(key))
    .map(key => ({
      key,
      meta: STATE.data.categories[key],
      items: groups.get(key),
      subtotal: groups.get(key).reduce((s, l) => s + l.mid, 0)
    }));
}

// Tier classification for color coding
function totalTier(mid) {
  if (mid < 8500) return 'lo';
  if (mid < 11000) return 'md';
  if (mid < 13000) return 'hi';
  return 'vh';
}

function barColor(mid) {
  if (mid < 8500) return 'var(--forest)';
  if (mid < 11000) return 'var(--gold)';
  if (mid < 13000) return 'var(--coral)';
  return 'var(--coral-deep)';
}

// ============================================================
// RENDERING
// ============================================================

function renderTiles() {
  let totalLo = 0, totalMid = 0, totalHi = 0;
  for (const m of STATE.data.months) {
    const t = monthTotals(m);
    totalLo += t.lo; totalMid += t.mid; totalHi += t.hi;
  }
  const months = STATE.data.months.length;
  const yearAvg = totalMid / 3;
  const monthAvg = totalMid / months;

  // monthly min/max
  let minMid = Infinity, maxMid = -Infinity;
  for (const m of STATE.data.months) {
    const t = monthTotals(m);
    if (t.mid < minMid) minMid = t.mid;
    if (t.mid > maxMid) maxMid = t.mid;
  }

  // health insurance total (sum recurring health lines × 12)
  const healthMonthly = STATE.data.recurring
    .filter(r => r.cat === 'health')
    .reduce((s, r) => s + r.mid, 0);

  $('#t-total').textContent = fmt(totalMid);
  $('#t-total-range').textContent = `low ${fmtK(totalLo)} · high ${fmtK(totalHi)}`;
  $('#t-year').textContent = fmt(yearAvg);
  $('#t-month').textContent = fmt(monthAvg);
  $('#t-month-range').textContent = `range ${fmtK(minMid)} – ${fmtK(maxMid)}`;
  $('#t-health').textContent = fmt(healthMonthly) + '/mo';

  // year totals
  for (const yr of [1, 2, 3]) {
    let l = 0, m = 0, h = 0;
    for (const mo of STATE.data.months.filter(x => x.year === yr)) {
      const t = monthTotals(mo);
      l += t.lo; m += t.mid; h += t.hi;
    }
    const host = $(`#y${yr}-total`);
    host.innerHTML = `<span class="yt-big">${fmt(m)}</span>low ${fmtK(l)} · high ${fmtK(h)}`;
  }
  // rollup total
  $('#yr-total').innerHTML = `<span class="yt-big">${fmt(totalMid)}</span>low ${fmtK(totalLo)} · high ${fmtK(totalHi)}`;
}

function renderMonthSubtabs(year) {
  const host = $(`[data-subtabs-for="${year}"]`);
  host.innerHTML = '';
  const months = STATE.data.months.filter(m => m.year === year);
  for (const m of months) {
    const btn = document.createElement('button');
    btn.className = 'mtab';
    btn.dataset.monthId = m.id;
    // tag with badge classes for visual cue
    for (const b of (m.badges || [])) {
      btn.classList.add('tab-' + b);
    }
    if (m.id === STATE.currentMonth[year]) btn.classList.add('active');
    btn.innerHTML = `<span class="mtab-flag">${m.flag}</span><span class="mtab-num">${m.num}</span> <span>${m.label}</span>`;
    btn.addEventListener('click', () => {
      STATE.currentMonth[year] = m.id;
      renderMonthSubtabs(year);
      renderMonthPanel(year);
    });
    host.appendChild(btn);
  }
}

function renderMonthPanel(year) {
  const host = $(`[data-host-for="${year}"]`);
  const monthId = STATE.currentMonth[year];
  const month = STATE.data.months.find(m => m.id === monthId);
  if (!month) { host.innerHTML = ''; return; }

  const totals = monthTotals(month);
  const perDay = totals.mid / 30;
  const tier = totalTier(totals.mid);
  const lines = getMonthLines(month);
  const groups = groupByCat(lines);

  const badgesHtml = (month.badges || []).map(b => {
    const labels = {
      home: '✈ home trip',
      haul: '🏗 haul-out',
      passage: '🌊 ocean passage',
      quarantine: '🐕 dog quarantine',
      celebration: '🎉 circumnavigation complete'
    };
    return `<span class="badge badge-${b}">${labels[b] || b}</span>`;
  }).join('');

  const catsHtml = groups.map(g => {
    const itemsHtml = g.items.map(item => {
      const r = loHi(item);
      const recurringCls = item.recurring ? 'recurring-row' : '';
      const noteHtml = item.note ? `<span class="item-note">${item.note}</span>` : '';
      return `<tr class="${recurringCls}">
        <td><span class="item-name">${item.name}</span>${noteHtml}</td>
        <td class="col-lo">${fmt(r.lo)}</td>
        <td class="col-mid">${fmt(item.mid)}</td>
        <td class="col-hi">${fmt(r.hi)}</td>
      </tr>`;
    }).join('');

    return `
      <div class="cat" data-cat="${g.key}">
        <div class="cat-head">
          <div class="cat-icon ic-${g.meta.color}">${g.meta.icon}</div>
          <div class="cat-name">${g.meta.name}<span class="cat-count">${g.items.length} ${g.items.length === 1 ? 'item' : 'items'}</span></div>
          <div class="cat-subtotal ct-${g.meta.color}">${fmt(g.subtotal)}</div>
          <div class="cat-chev">▶</div>
        </div>
        <div class="cat-body">
          <table class="items">
            <thead><tr><th>Line item</th><th>Low</th><th>Mid</th><th>High</th></tr></thead>
            <tbody>${itemsHtml}</tbody>
          </table>
        </div>
      </div>`;
  }).join('');

  host.innerHTML = `
    <div class="month-panel">
      <div class="month-hero">
        <div class="month-hero-l">
          <div class="month-mark">${month.num} · ${month.calMonth} · ${month.yearLabel}</div>
          <div class="month-loc"><span class="month-flag">${month.flag}</span>${month.location}</div>
          <div class="month-region">${month.region}</div>
          ${month.summary ? `<div class="month-summary">${month.summary}</div>` : ''}
          ${badgesHtml ? `<div class="month-badges">${badgesHtml}</div>` : ''}
        </div>
        <div class="month-hero-r">
          <div class="month-total-lbl">Monthly Total</div>
          <div class="month-total tier-${tier}">${fmt(totals.mid)}</div>
          <div class="month-range">low ${fmt(totals.lo)} · high ${fmt(totals.hi)}</div>
        </div>
      </div>
      <div class="cats">${catsHtml}</div>
      <div class="month-foot">
        <div class="foot-l">
          <span class="foot-lbl">Per-day equivalent</span>
          <span class="foot-perday">${fmt(perDay)}/day · ~${Math.round(perDay / 24)}/hour</span>
        </div>
        <div class="foot-r">
          <div class="ft"><span class="ft-lbl">Low</span><span class="ft-val" style="color:var(--forest)">${fmt(totals.lo)}</span></div>
          <div class="ft"><span class="ft-lbl">Mid</span><span class="ft-val mid">${fmt(totals.mid)}</span></div>
          <div class="ft"><span class="ft-lbl">High</span><span class="ft-val" style="color:var(--coral)">${fmt(totals.hi)}</span></div>
        </div>
      </div>
    </div>`;

  // wire expand/collapse — open the first category by default
  const cats = $$('.cat', host);
  cats.forEach((c, i) => {
    if (i === 0) c.classList.add('open');
    c.querySelector('.cat-head').addEventListener('click', () => c.classList.toggle('open'));
  });
}

function renderCashFlow() {
  const months = STATE.data.months;
  const totals = months.map(m => ({ id: m.id, num: m.num, mid: monthTotals(m).mid }));
  const max = Math.max(...totals.map(t => t.mid));

  const bars = $('#cf-bars');
  const labels = $('#cf-labels');
  bars.innerHTML = '';
  labels.innerHTML = '';

  totals.forEach((t, i) => {
    const bar = document.createElement('div');
    bar.className = 'cf-bar';
    bar.style.height = Math.round((t.mid / max) * 100) + '%';
    bar.style.background = barColor(t.mid);
    bar.dataset.tip = `${t.num}: ${fmt(t.mid)}`;
    bars.appendChild(bar);

    const lbl = document.createElement('div');
    lbl.className = 'cf-lbl';
    lbl.textContent = (i % 3 === 0) ? t.num : '';
    labels.appendChild(lbl);
  });
}

function renderRollupCategories() {
  // For each category, sum across all three years
  const cats = STATE.data.categories;
  const order = Object.keys(cats);
  const byCat = {};
  for (const key of order) {
    byCat[key] = { 1: 0, 2: 0, 3: 0, total: 0 };
  }

  for (const m of STATE.data.months) {
    const lines = getMonthLines(m);
    for (const line of lines) {
      if (!byCat[line.cat]) continue;
      byCat[line.cat][m.year] += line.mid;
      byCat[line.cat].total += line.mid;
    }
  }

  const grandTotal = Object.values(byCat).reduce((s, v) => s + v.total, 0);

  // sort by total desc, but always last: buffer, celeb if present
  const rows = order
    .filter(k => byCat[k].total > 0)
    .sort((a, b) => byCat[b].total - byCat[a].total);

  const tbody = $('#rollup-cats tbody');
  const yearTotals = [1, 2, 3].map(y => rows.reduce((s, k) => s + byCat[k][y], 0));
  tbody.innerHTML = rows.map(key => {
    const v = byCat[key];
    const pct = ((v.total / grandTotal) * 100).toFixed(1);
    return `<tr>
      <td>${cats[key].icon} ${cats[key].name}</td>
      <td>${fmt(v[1])}</td>
      <td>${fmt(v[2])}</td>
      <td>${fmt(v[3])}</td>
      <td>${fmt(v.total)}</td>
      <td style="color:var(--ink-faded)">${pct}%</td>
    </tr>`;
  }).join('') + `
    <tr class="ttr">
      <td>3-Year Total</td>
      <td>${fmt(yearTotals[0])}</td>
      <td>${fmt(yearTotals[1])}</td>
      <td>${fmt(yearTotals[2])}</td>
      <td>${fmt(grandTotal)}</td>
      <td>100%</td>
    </tr>`;
}

function renderRollupYears() {
  const yearStats = [1, 2, 3].map(y => {
    const ms = STATE.data.months.filter(m => m.year === y);
    const totals = ms.map(m => ({ m, t: monthTotals(m) }));
    let lo = 0, mid = 0, hi = 0;
    for (const t of totals) { lo += t.t.lo; mid += t.t.mid; hi += t.t.hi; }
    const cheap = totals.reduce((a, b) => (a.t.mid < b.t.mid ? a : b));
    const dear  = totals.reduce((a, b) => (a.t.mid > b.t.mid ? a : b));
    const homeMonths = ms.filter(m => (m.badges || []).includes('home')).length;
    const haulMonths = ms.filter(m => (m.badges || []).includes('haul')).length;
    const passageMonths = ms.filter(m => (m.badges || []).includes('passage')).length;
    return { y, lo, mid, hi, cheap, dear, homeMonths, haulMonths, passageMonths, avgMonth: mid / 12 };
  });

  const grand = {
    lo: yearStats.reduce((s, y) => s + y.lo, 0),
    mid: yearStats.reduce((s, y) => s + y.mid, 0),
    hi: yearStats.reduce((s, y) => s + y.hi, 0),
    homeMonths: yearStats.reduce((s, y) => s + y.homeMonths, 0),
    haulMonths: yearStats.reduce((s, y) => s + y.haulMonths, 0),
    passageMonths: yearStats.reduce((s, y) => s + y.passageMonths, 0)
  };
  grand.avgMonth = grand.mid / 36;

  const rows = [
    { label: 'Year total (mid)', vals: yearStats.map(y => fmt(y.mid)), total: fmt(grand.mid) },
    { label: 'Year low estimate', vals: yearStats.map(y => fmt(y.lo)), total: fmt(grand.lo), cls: 'clo' },
    { label: 'Year high estimate', vals: yearStats.map(y => fmt(y.hi)), total: fmt(grand.hi), cls: 'chi' },
    { label: 'Avg monthly spend', vals: yearStats.map(y => fmt(y.avgMonth)), total: fmt(grand.avgMonth) },
    { label: 'Cheapest month', vals: yearStats.map(y => `${y.cheap.m.num} · ${fmt(y.cheap.t.mid)}`), total: '—', cls: 'clo' },
    { label: 'Most expensive month', vals: yearStats.map(y => `${y.dear.m.num} · ${fmt(y.dear.t.mid)}`), total: '—', cls: 'chi' },
    { label: 'Home trips', vals: yearStats.map(y => `${y.homeMonths} trips`), total: `${grand.homeMonths} trips` },
    { label: 'Haul-outs', vals: yearStats.map(y => `${y.haulMonths}`), total: `${grand.haulMonths}` },
    { label: 'Ocean passages', vals: yearStats.map(y => `${y.passageMonths}`), total: `${grand.passageMonths}` }
  ];

  const tbody = $('#rollup-years tbody');
  tbody.innerHTML = rows.map(r => {
    const cls = r.cls ? ` class="${r.cls}"` : '';
    return `<tr>
      <td>${r.label}</td>
      <td${cls}>${r.vals[0]}</td>
      <td${cls}>${r.vals[1]}</td>
      <td${cls}>${r.vals[2]}</td>
      <td${cls}>${r.total}</td>
    </tr>`;
  }).join('');
}

function renderRollupNotes() {
  const host = $('#rollup-notes');
  host.innerHTML = STATE.data.notes.map(n =>
    `<div class="nc ${n.tone || ''}"><strong>${n.title}</strong>${n.body}</div>`
  ).join('');
}

// ============================================================
// NAVIGATION
// ============================================================

function showYear(yearOrRollup) {
  $$('.panel').forEach(p => p.classList.remove('active'));
  $$('.tab').forEach(t => t.classList.remove('active'));

  if (yearOrRollup === 'rollup') {
    $('#year-rollup').classList.add('active');
    $('.tab[data-year="rollup"]').classList.add('active');
  } else {
    const y = parseInt(yearOrRollup, 10);
    STATE.currentYear = y;
    $(`#year-${y}`).classList.add('active');
    $(`.tab[data-year="${y}"]`).classList.add('active');
    renderMonthSubtabs(y);
    renderMonthPanel(y);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// BOOT
// ============================================================

async function boot() {
  try {
    const res = await fetch('months.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    STATE.data = await res.json();
  } catch (err) {
    $('#loading').innerHTML = `
      <div style="color:#e88080;font-family:'DM Mono',monospace;font-size:13px;line-height:1.7;max-width:560px;margin:0 auto;text-align:left;padding:24px;background:rgba(201,68,68,0.08);border:1px solid rgba(201,68,68,0.3);border-radius:10px;">
        <strong style="color:#e88080;display:block;margin-bottom:8px;">Failed to load months.json</strong>
        ${err.message}<br><br>
        Browsers block <code>fetch()</code> on <code>file://</code>. Serve this folder over HTTP — from this directory run:<br>
        <code style="display:block;margin-top:8px;padding:6px 8px;background:rgba(0,0,0,0.3);border-radius:4px;">python -m http.server 8000</code>
        then open <code>http://localhost:8000/circumnavigation/</code>
      </div>`;
    return;
  }

  $('#loading').remove();

  renderTiles();
  renderMonthSubtabs(1);
  renderMonthPanel(1);
  renderMonthSubtabs(2);
  renderMonthPanel(2);
  renderMonthSubtabs(3);
  renderMonthPanel(3);
  renderCashFlow();
  renderRollupCategories();
  renderRollupYears();
  renderRollupNotes();

  // Year tab handlers
  $$('.tab').forEach(t => {
    t.addEventListener('click', () => showYear(t.dataset.year));
  });
}

boot();

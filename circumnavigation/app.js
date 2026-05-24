// Jorczak.com — Circumnavigation Budget App
// The budget is derived at boot from voyage.jsonc + rates.jsonc, so any
// itinerary change in voyage.jsonc flows straight through to these numbers.
// No build tools, no dependencies.

const STATE = {
  data: null,           // { meta, categories, loHiRanges, recurring, notes, months, years }
  currentYear: 1,
  currentMonth: {},     // { yearIdx: monthId, ... }
  yearCount: 0,
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const fmt = (n) => "$" + Math.round(n).toLocaleString();
const fmtK = (n) => (n >= 1000 ? "$" + (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "K" : "$" + Math.round(n));
const round25 = (n) => Math.round(n / 25) * 25;
const round50 = (n) => Math.round(n / 50) * 50;

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LONG = {
  Jan: "January", Feb: "February", Mar: "March", Apr: "April",
  May: "May", Jun: "June", Jul: "July", Aug: "August",
  Sep: "September", Oct: "October", Nov: "November", Dec: "December",
};

// ============================================================
// DATA LOADING — JSONC support (shared shape with voyage.js)
// ============================================================

function stripJsonComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/,\s*([}\]])/g, "$1");
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const text = await res.text();
  if (url.endsWith(".jsonc")) return JSON.parse(stripJsonComments(text));
  return JSON.parse(text);
}

// ============================================================
// MONTH PACKING — duplicate of voyage.js computeMonths so the
// budget page can stand on its own without loading voyage.js.
// ============================================================

function computeMonths(voyage) {
  const MONTH_CAP = 30;
  const HOME_DAYS = 14;
  const HAUL_DAYS = 7;

  const wps = voyage.waypoints || [];
  const routes = voyage.routes || [];
  const segmentsById = (voyage.segments || []).reduce((acc, s) => {
    acc[s.id] = s;
    return acc;
  }, {});
  const routeByTo = new Map(routes.map((r) => [r.to, r]));

  const months = [];
  let pendingHaul = false;

  const finalizeHaulSpill = (m) => {
    if (m.haul <= 0 || m.monthNum % 12 !== 0) return;
    if (m.sail + m.tour + m.home + m.haul <= MONTH_CAP) return;
    m.haul = 0;
    pendingHaul = true;
  };

  const startMonth = (idx) => {
    const monthNum = idx + 1;
    const home = monthNum % 3 === 0 ? HOME_DAYS : 0;
    let haul = 0;
    if (pendingHaul) {
      haul = HAUL_DAYS;
      pendingHaul = false;
    } else if (monthNum % 12 === 0) {
      haul = HAUL_DAYS;
    }
    const m = { monthNum, sail: 0, tour: 0, home, haul, wps: [], segDays: {} };
    months.push(m);
    return m;
  };

  let cur = startMonth(0);
  for (let i = 0; i < wps.length; i++) {
    const w = wps[i];
    const r = i === 0 ? null : routeByTo.get(w.id);
    const sail = r ? r.days || 0 : 0;
    const tour = w.tourStayDays || 0;
    const cost = sail + tour;

    const available = MONTH_CAP - cur.home - cur.haul;
    if (cur.wps.length > 0 && cur.sail + cur.tour + cost > available) {
      finalizeHaulSpill(cur);
      cur = startMonth(months.length);
    }

    cur.sail += sail;
    cur.tour += tour;
    cur.wps.push(w);
    if (w.segment) cur.segDays[w.segment] = (cur.segDays[w.segment] || 0) + sail + tour;
  }

  finalizeHaulSpill(cur);
  if (pendingHaul) {
    const spill = startMonth(months.length);
    spill.haul = HAUL_DAYS;
    pendingHaul = false;
  }

  return months.map((m, idx) => {
    const num = idx + 1;
    const id = `m${String(num).padStart(2, "0")}`;
    let dominantSegment = null;
    let max = -1;
    for (const [seg, days] of Object.entries(m.segDays)) {
      if (days > max) {
        max = days;
        dominantSegment = seg;
      }
    }
    const segName = dominantSegment ? (segmentsById[dominantSegment] || {}).name || "" : "";
    const annots = [];
    if (m.home > 0) annots.push("home");
    if (m.haul > 0) annots.push("haul-out");
    let label = `Month ${num} - ${segName}`;
    if (annots.length) label += ` [${annots.join(" | ")}]`;

    for (const w of m.wps) w.month = id;

    return {
      id,
      label,
      dominantSegment,
      plannedSailDays: m.sail,
      plannedTourDays: m.tour,
      plannedHomeDays: m.home,
      plannedHaulDays: m.haul,
      plannedTotalDays: m.sail + m.tour + m.home + m.haul,
      _wps: m.wps,
    };
  });
}

// ============================================================
// BUDGET COMPUTE — voyage months + rate sheet → app.js month objects
// ============================================================

function startMonthIndex(voyage) {
  const m = (voyage && voyage.voyage && voyage.voyage.startMonth) || "Jan";
  const i = MONTH_NAMES.indexOf(m);
  return i < 0 ? 0 : i;
}

function computeBudget(voyage, rates) {
  const months = voyage.months || [];
  const segmentsById = new Map((voyage.segments || []).map((s) => [s.id, s]));
  const segRates = rates.segmentRates || {};
  const fallback = segRates.midAtlantic || { marinaDay: 70, provDay: 50, personalDay: 30, fuelSailDay: 50, customsBase: 300, maintBase: 800 };
  const startYear = (voyage.voyage && voyage.voyage.startYear) || 2034;
  const startIdx = startMonthIndex(voyage);

  // Locate the month with the most antarctica days for the Drake buffer.
  let antarcticaMonthId = null;
  let antarcticaMax = 0;
  for (const m of months) {
    if (m.dominantSegment === "antarctica") {
      const d = (m.plannedSailDays || 0) + (m.plannedTourDays || 0);
      if (d > antarcticaMax) {
        antarcticaMax = d;
        antarcticaMonthId = m.id;
      }
    }
  }
  const celebrationMonthId = months.length ? months[months.length - 1].id : null;

  // Segments that count as "ocean passage" for badge purposes.
  const passageSegments = new Set(
    (voyage.segments || []).filter((s) => s.type === "crossing").map((s) => s.id),
  );

  // The voyage.js cyclone-risk table isn't loaded here; we approximate by
  // checking for passage segments + heavy sail-day count.
  return months.map((m, idx) => {
    const monthNum = idx + 1;
    const calIdx = (startIdx + idx) % 12;
    const calMonthShort = MONTH_NAMES[calIdx];
    const calMonthLong = MONTH_LONG[calMonthShort];
    const calYear = startYear + Math.floor((startIdx + idx) / 12);
    const year = Math.floor(idx / 12) + 1;

    const segId = m.dominantSegment;
    const segMeta = segmentsById.get(segId) || { name: "Open ocean" };
    const r = segRates[segId] || fallback;

    const wps = m._wps || [];
    const portWps = wps.filter((w) => w.kind === "port");
    const portLabels = wps.map((w) => w.label);
    const region = portLabels.slice(0, 5).join(" · ") || segMeta.name;

    const tour = m.plannedTourDays || 0;
    const sail = m.plannedSailDays || 0;

    // Badges
    const badges = [];
    if (m.plannedHomeDays > 0) badges.push("home");
    if (m.plannedHaulDays > 0) badges.push("haul");
    if (passageSegments.has(segId) && sail >= 14) badges.push("passage");
    if (m.id === celebrationMonthId) badges.push("celebration");

    // Lines
    const lines = [];

    if (tour > 0) {
      const marinaMid = Math.max(200, round50(tour * r.marinaDay));
      lines.push({ cat: "marina", name: rates.templates.marina.name, note: rates.templates.marina.note, mid: marinaMid });
    } else if (sail > 0) {
      // Passage month — a small mooring/transit fee at endpoints
      lines.push({ cat: "marina", name: "Transit & arrival mooring", note: "passage month", mid: 250 });
    }

    // Provisioning — full crew eats every day (sail + tour)
    const provMid = Math.max(400, round25((sail + tour) * r.provDay * 0.85));
    lines.push({ cat: "prov", name: rates.templates.prov.name, note: rates.templates.prov.note, mid: provMid });

    // Fuel — primarily a function of sail days; small shore-power baseline ashore
    const fuelMid = Math.max(150, round25(sail * r.fuelSailDay + tour * 8));
    lines.push({ cat: "fuel", name: rates.templates.fuel.name, note: "", mid: fuelMid });

    // Customs — base per month, scaled mildly by number of ports cleared
    const customsMul = portWps.length <= 1 ? 1 : portWps.length <= 3 ? 1.4 : 1.8;
    const customsMid = round25(r.customsBase * customsMul);
    lines.push({
      cat: "customs",
      name: rates.templates.customs.name,
      note: portWps.length > 1 ? `${portWps.length} port clearances` : "",
      mid: customsMid,
    });

    // Maintenance
    lines.push({ cat: "maint", name: rates.templates.maint.name, note: "", mid: r.maintBase });

    // Personal
    const personalMid = Math.max(150, round25(tour * r.personalDay));
    lines.push({ cat: "personal", name: rates.templates.personal.name, note: "", mid: personalMid });

    // Dog (food/vet/grooming baseline)
    lines.push({ cat: "dog", name: rates.templates.dog.name, note: "", mid: rates.baseMonthly.dog });

    // Admin
    lines.push({ cat: "admin", name: rates.templates.admin.name, note: "", mid: rates.baseMonthly.admin });

    // Home-trip event
    if (m.plannedHomeDays > 0) {
      for (const item of rates.homeTrip) lines.push({ ...item });
    }

    // Haul-out event
    if (m.plannedHaulDays > 0) {
      for (const item of rates.haulOut) lines.push({ ...item });
    }

    // Antarctica weather buffer (single month)
    if (m.id === antarcticaMonthId && rates.antarcticaBuffer) {
      lines.push({ ...rates.antarcticaBuffer });
    }

    // Final-month celebration
    if (m.id === celebrationMonthId && rates.celebration) {
      for (const item of rates.celebration) lines.push({ ...item });
    }

    // Auto-generated summary
    const portCount = portWps.length;
    const sideTripCount = wps.length - portCount;
    const parts = [];
    if (portCount) parts.push(`${portCount} port${portCount === 1 ? "" : "s"}`);
    if (sideTripCount) parts.push(`${sideTripCount} inland trip${sideTripCount === 1 ? "" : "s"}`);
    if (sail) parts.push(`${sail} day${sail === 1 ? "" : "s"} at sea`);
    if (tour) parts.push(`${tour} day${tour === 1 ? "" : "s"} ashore`);
    if (m.plannedHomeDays > 0) parts.push("home trip");
    if (m.plannedHaulDays > 0) parts.push("haul-out");
    const summary = parts.join(" · ");

    return {
      id: m.id,
      year,
      num: `M${String(monthNum).padStart(2, "0")}`,
      label: calMonthShort,
      calMonth: calMonthLong,
      yearLabel: `YR${year}`,
      flag: "",
      location: segMeta.name,
      region,
      badges,
      summary,
      lines,
      _plannedSailDays: sail,
      _plannedTourDays: tour,
      _calYear: calYear,
    };
  });
}

// ============================================================
// LINE & TOTAL HELPERS
// ============================================================

function getMonthLines(month) {
  return [
    ...STATE.data.recurring.map((r) => ({ ...r, recurring: true })),
    ...month.lines,
  ];
}

function loHi(line) {
  const range = STATE.data.loHiRanges[line.cat] || [0.85, 1.25];
  return {
    lo: round25(line.mid * range[0]),
    hi: round25(line.mid * range[1]),
  };
}

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

function groupByCat(lines) {
  const order = Object.keys(STATE.data.categories);
  const groups = new Map();
  for (const line of lines) {
    if (!groups.has(line.cat)) groups.set(line.cat, []);
    groups.get(line.cat).push(line);
  }
  return order
    .filter((key) => groups.has(key))
    .map((key) => ({
      key,
      meta: STATE.data.categories[key],
      items: groups.get(key),
      subtotal: groups.get(key).reduce((s, l) => s + l.mid, 0),
    }));
}

function totalTier(mid) {
  if (mid < 8500) return "lo";
  if (mid < 11000) return "md";
  if (mid < 13000) return "hi";
  return "vh";
}

function barColor(mid) {
  if (mid < 8500) return "var(--forest)";
  if (mid < 11000) return "var(--gold)";
  if (mid < 13000) return "var(--coral)";
  return "var(--coral-deep)";
}

function monthsInYear(year) {
  return STATE.data.months.filter((m) => m.year === year);
}

// ============================================================
// RENDERING
// ============================================================

function renderTiles() {
  let totalLo = 0, totalMid = 0, totalHi = 0;
  for (const m of STATE.data.months) {
    const t = monthTotals(m);
    totalLo += t.lo;
    totalMid += t.mid;
    totalHi += t.hi;
  }
  const months = STATE.data.months.length;
  const yearAvg = totalMid / STATE.yearCount;
  const monthAvg = totalMid / months;

  let minMid = Infinity, maxMid = -Infinity;
  for (const m of STATE.data.months) {
    const t = monthTotals(m);
    if (t.mid < minMid) minMid = t.mid;
    if (t.mid > maxMid) maxMid = t.mid;
  }

  const healthMonthly = STATE.data.recurring
    .filter((r) => r.cat === "health")
    .reduce((s, r) => s + r.mid, 0);

  $("#t-total").textContent = fmt(totalMid);
  $("#t-total-range").textContent = `low ${fmtK(totalLo)} · high ${fmtK(totalHi)}`;
  $("#t-year").textContent = fmt(yearAvg);
  $("#t-year-sub").textContent = `across ${months} months / ${STATE.yearCount} years`;
  $("#t-month").textContent = fmt(monthAvg);
  $("#t-month-range").textContent = `range ${fmtK(minMid)} – ${fmtK(maxMid)}`;
  $("#t-health").textContent = fmt(healthMonthly) + "/mo";

  // Year totals — written into per-year .year-total nodes built by renderYearPanels
  for (let yr = 1; yr <= STATE.yearCount; yr++) {
    let l = 0, m = 0, h = 0;
    for (const mo of monthsInYear(yr)) {
      const t = monthTotals(mo);
      l += t.lo;
      m += t.mid;
      h += t.hi;
    }
    const host = $(`#y${yr}-total`);
    if (host) host.innerHTML = `<span class="yt-big">${fmt(m)}</span>low ${fmtK(l)} · high ${fmtK(h)}`;
  }

  $("#yr-total").innerHTML = `<span class="yt-big">${fmt(totalMid)}</span>low ${fmtK(totalLo)} · high ${fmtK(totalHi)}`;
}

function renderTabs() {
  const host = $("#year-tabs");
  host.innerHTML =
    `<button class="tab active" data-year="rollup">${STATE.yearCount}-Year Rollup</button>` +
    Array.from({ length: STATE.yearCount }, (_, i) => i + 1)
      .map((yr) => {
        const meta = STATE.data.years[yr - 1];
        const short = meta ? meta.title.replace(/^Year \w+\s+—\s+/, "") : `Year ${yr}`;
        return `<button class="tab" data-year="${yr}">Year ${yr} · ${short}</button>`;
      })
      .join("");
}

function renderYearPanels() {
  const host = $("#year-panels");
  let html = "";
  for (let yr = 1; yr <= STATE.yearCount; yr++) {
    const meta = STATE.data.years[yr - 1] || { title: `Year ${yr}`, route: "" };
    html += `
      <div id="year-${yr}" class="panel">
        <div class="year-hdr">
          <div>
            <div class="year-title">${meta.title}</div>
            <div class="year-route">${meta.route}</div>
          </div>
          <div class="year-total" id="y${yr}-total"><span class="yt-big">—</span>low — · high —</div>
        </div>
        <div class="month-subtabs" data-subtabs-for="${yr}"></div>
        <div class="month-panel-host" data-host-for="${yr}"></div>
      </div>
    `;
  }
  host.innerHTML = html;
}

function renderMonthSubtabs(year) {
  const host = $(`[data-subtabs-for="${year}"]`);
  if (!host) return;
  host.innerHTML = "";
  const months = monthsInYear(year);
  for (const m of months) {
    const btn = document.createElement("button");
    btn.className = "mtab";
    btn.dataset.monthId = m.id;
    for (const b of m.badges || []) btn.classList.add("tab-" + b);
    if (m.id === STATE.currentMonth[year]) btn.classList.add("active");
    btn.innerHTML = `<span class="mtab-num">${m.num}</span> <span>${m.label}</span>`;
    btn.addEventListener("click", () => {
      STATE.currentMonth[year] = m.id;
      renderMonthSubtabs(year);
      renderMonthPanel(year);
    });
    host.appendChild(btn);
  }
}

function renderMonthPanel(year) {
  const host = $(`[data-host-for="${year}"]`);
  if (!host) return;
  const monthId = STATE.currentMonth[year];
  const month = STATE.data.months.find((m) => m.id === monthId);
  if (!month) {
    host.innerHTML = "";
    return;
  }

  const totals = monthTotals(month);
  const perDay = totals.mid / 30;
  const tier = totalTier(totals.mid);
  const lines = getMonthLines(month);
  const groups = groupByCat(lines);

  const badgesHtml = (month.badges || [])
    .map((b) => {
      const labels = {
        home: "✈ home trip",
        haul: "🏗 haul-out",
        passage: "🌊 ocean passage",
        quarantine: "🐕 dog quarantine",
        celebration: "🎉 circumnavigation complete",
      };
      return `<span class="badge badge-${b}">${labels[b] || b}</span>`;
    })
    .join("");

  const catsHtml = groups
    .map((g) => {
      const itemsHtml = g.items
        .map((item) => {
          const r = loHi(item);
          const recurringCls = item.recurring ? "recurring-row" : "";
          const noteHtml = item.note ? `<span class="item-note">${item.note}</span>` : "";
          return `<tr class="${recurringCls}">
            <td><span class="item-name">${item.name}</span>${noteHtml}</td>
            <td class="col-lo">${fmt(r.lo)}</td>
            <td class="col-mid">${fmt(item.mid)}</td>
            <td class="col-hi">${fmt(r.hi)}</td>
          </tr>`;
        })
        .join("");

      return `
        <div class="cat" data-cat="${g.key}">
          <div class="cat-head">
            <div class="cat-icon ic-${g.meta.color}">${g.meta.icon}</div>
            <div class="cat-name">${g.meta.name}<span class="cat-count">${g.items.length} ${g.items.length === 1 ? "item" : "items"}</span></div>
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
    })
    .join("");

  host.innerHTML = `
    <div class="month-panel">
      <div class="month-hero">
        <div class="month-hero-l">
          <div class="month-mark">${month.num} · ${month.calMonth} ${month._calYear} · ${month.yearLabel}</div>
          <div class="month-loc">${month.location}</div>
          <div class="month-region">${month.region}</div>
          ${month.summary ? `<div class="month-summary">${month.summary}</div>` : ""}
          ${badgesHtml ? `<div class="month-badges">${badgesHtml}</div>` : ""}
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

  const cats = $$(".cat", host);
  cats.forEach((c, i) => {
    if (i === 0) c.classList.add("open");
    c.querySelector(".cat-head").addEventListener("click", () => c.classList.toggle("open"));
  });
}

function renderCashFlow() {
  const months = STATE.data.months;
  const totals = months.map((m) => ({ id: m.id, num: m.num, mid: monthTotals(m).mid }));
  const max = Math.max(...totals.map((t) => t.mid));

  const bars = $("#cf-bars");
  const labels = $("#cf-labels");
  bars.innerHTML = "";
  labels.innerHTML = "";

  totals.forEach((t, i) => {
    const bar = document.createElement("div");
    bar.className = "cf-bar";
    bar.style.height = Math.round((t.mid / max) * 100) + "%";
    bar.style.background = barColor(t.mid);
    bar.dataset.tip = `${t.num}: ${fmt(t.mid)}`;
    bars.appendChild(bar);

    const lbl = document.createElement("div");
    lbl.className = "cf-lbl";
    lbl.textContent = i % 6 === 0 ? t.num : "";
    labels.appendChild(lbl);
  });
}

function renderRollupCategories() {
  const cats = STATE.data.categories;
  const order = Object.keys(cats);
  const byCat = {};
  for (const key of order) byCat[key] = { total: 0, years: {} };

  for (const m of STATE.data.months) {
    const lines = getMonthLines(m);
    for (const line of lines) {
      if (!byCat[line.cat]) continue;
      byCat[line.cat].years[m.year] = (byCat[line.cat].years[m.year] || 0) + line.mid;
      byCat[line.cat].total += line.mid;
    }
  }

  const grandTotal = Object.values(byCat).reduce((s, v) => s + v.total, 0);
  const rows = order.filter((k) => byCat[k].total > 0).sort((a, b) => byCat[b].total - byCat[a].total);
  const yearTotals = Array.from({ length: STATE.yearCount }, (_, i) =>
    rows.reduce((s, k) => s + (byCat[k].years[i + 1] || 0), 0),
  );

  // Rebuild table headers for the dynamic year count
  const thead = $("#rollup-cats thead");
  const yearHeads = Array.from({ length: STATE.yearCount }, (_, i) => `<th>Yr ${i + 1}</th>`).join("");
  thead.innerHTML = `<tr><th>Category</th>${yearHeads}<th>Total</th><th>%</th></tr>`;

  const tbody = $("#rollup-cats tbody");
  tbody.innerHTML =
    rows
      .map((key) => {
        const v = byCat[key];
        const pct = ((v.total / grandTotal) * 100).toFixed(1);
        const yearCells = Array.from({ length: STATE.yearCount }, (_, i) => `<td>${fmt(v.years[i + 1] || 0)}</td>`).join("");
        return `<tr>
          <td>${cats[key].icon} ${cats[key].name}</td>
          ${yearCells}
          <td>${fmt(v.total)}</td>
          <td style="color:var(--ink-faded)">${pct}%</td>
        </tr>`;
      })
      .join("") +
    `<tr class="ttr">
      <td>${STATE.yearCount}-Year Total</td>
      ${yearTotals.map((t) => `<td>${fmt(t)}</td>`).join("")}
      <td>${fmt(grandTotal)}</td>
      <td>100%</td>
    </tr>`;
}

function renderRollupYears() {
  const yearStats = Array.from({ length: STATE.yearCount }, (_, i) => i + 1).map((y) => {
    const ms = monthsInYear(y);
    const totals = ms.map((m) => ({ m, t: monthTotals(m) }));
    let lo = 0, mid = 0, hi = 0;
    for (const t of totals) {
      lo += t.t.lo;
      mid += t.t.mid;
      hi += t.t.hi;
    }
    const cheap = totals.reduce((a, b) => (a.t.mid < b.t.mid ? a : b));
    const dear = totals.reduce((a, b) => (a.t.mid > b.t.mid ? a : b));
    const homeMonths = ms.filter((m) => (m.badges || []).includes("home")).length;
    const haulMonths = ms.filter((m) => (m.badges || []).includes("haul")).length;
    const passageMonths = ms.filter((m) => (m.badges || []).includes("passage")).length;
    return { y, lo, mid, hi, cheap, dear, homeMonths, haulMonths, passageMonths, monthsCount: ms.length, avgMonth: mid / ms.length };
  });

  const grand = {
    lo: yearStats.reduce((s, y) => s + y.lo, 0),
    mid: yearStats.reduce((s, y) => s + y.mid, 0),
    hi: yearStats.reduce((s, y) => s + y.hi, 0),
    homeMonths: yearStats.reduce((s, y) => s + y.homeMonths, 0),
    haulMonths: yearStats.reduce((s, y) => s + y.haulMonths, 0),
    passageMonths: yearStats.reduce((s, y) => s + y.passageMonths, 0),
  };
  grand.avgMonth = grand.mid / STATE.data.months.length;

  // Rebuild headers
  const thead = $("#rollup-years thead");
  const yearHeads = yearStats.map((y) => `<th>Year ${y.y}</th>`).join("");
  thead.innerHTML = `<tr><th>Metric</th>${yearHeads}<th>${STATE.yearCount}-Year</th></tr>`;

  const rows = [
    { label: "Year total (mid)", vals: yearStats.map((y) => fmt(y.mid)), total: fmt(grand.mid) },
    { label: "Year low estimate", vals: yearStats.map((y) => fmt(y.lo)), total: fmt(grand.lo), cls: "clo" },
    { label: "Year high estimate", vals: yearStats.map((y) => fmt(y.hi)), total: fmt(grand.hi), cls: "chi" },
    { label: "Avg monthly spend", vals: yearStats.map((y) => fmt(y.avgMonth)), total: fmt(grand.avgMonth) },
    { label: "Months in year", vals: yearStats.map((y) => `${y.monthsCount}`), total: `${STATE.data.months.length}` },
    { label: "Cheapest month", vals: yearStats.map((y) => `${y.cheap.m.num} · ${fmt(y.cheap.t.mid)}`), total: "—", cls: "clo" },
    { label: "Most expensive month", vals: yearStats.map((y) => `${y.dear.m.num} · ${fmt(y.dear.t.mid)}`), total: "—", cls: "chi" },
    { label: "Home trips", vals: yearStats.map((y) => `${y.homeMonths}`), total: `${grand.homeMonths}` },
    { label: "Haul-outs", vals: yearStats.map((y) => `${y.haulMonths}`), total: `${grand.haulMonths}` },
    { label: "Ocean-passage months", vals: yearStats.map((y) => `${y.passageMonths}`), total: `${grand.passageMonths}` },
  ];

  const tbody = $("#rollup-years tbody");
  tbody.innerHTML = rows
    .map((r) => {
      const cls = r.cls ? ` class="${r.cls}"` : "";
      const cells = r.vals.map((v) => `<td${cls}>${v}</td>`).join("");
      return `<tr><td>${r.label}</td>${cells}<td${cls}>${r.total}</td></tr>`;
    })
    .join("");
}

function renderRollupNotes() {
  const host = $("#rollup-notes");
  host.innerHTML = STATE.data.notes
    .map((n) => `<div class="nc ${n.tone || ""}"><strong>${n.title}</strong>${n.body}</div>`)
    .join("");
}

function renderHeaderChips() {
  // Spec chips below the page hero. Pull from voyage + budget data.
  const months = STATE.data.months;
  const homeCount = months.filter((m) => (m.badges || []).includes("home")).length;
  const haulCount = months.filter((m) => (m.badges || []).includes("haul")).length;
  const dogBoardingNights = homeCount * 8;

  const set = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  set("chip-flights", `${homeCount} flights home · ${dogBoardingNights} dog-boarding nights`);
  set("chip-hauls", `${haulCount} haul-outs over ${STATE.yearCount} years`);
  set("chip-duration", `${months.length} months · ${STATE.yearCount} years`);
}

// ============================================================
// NAVIGATION
// ============================================================

function showYear(yearOrRollup, opts = {}) {
  $$(".panel").forEach((p) => p.classList.remove("active"));
  $$(".tab").forEach((t) => t.classList.remove("active"));

  if (yearOrRollup === "rollup") {
    $("#year-rollup").classList.add("active");
    $(".tab[data-year=\"rollup\"]").classList.add("active");
  } else {
    const y = parseInt(yearOrRollup, 10);
    STATE.currentYear = y;
    $(`#year-${y}`).classList.add("active");
    $(`.tab[data-year="${y}"]`).classList.add("active");
    renderMonthSubtabs(y);
    renderMonthPanel(y);
  }
  if (!opts.noScroll) window.scrollTo({ top: 0, behavior: "smooth" });
}

function handleHash() {
  const hash = (window.location.hash || "").replace("#", "").toLowerCase();
  if (!hash) return;
  const month = STATE.data.months.find((m) => m.id === hash);
  if (!month) return;
  STATE.currentMonth[month.year] = month.id;
  showYear(String(month.year), { noScroll: true });
  setTimeout(() => {
    const host = $(`[data-host-for="${month.year}"]`);
    if (host) host.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 60);
}

// ============================================================
// BOOT
// ============================================================

async function boot() {
  let voyage, rates;
  try {
    [voyage, rates] = await Promise.all([fetchJson("voyage.jsonc"), fetchJson("rates.jsonc")]);
    voyage.months = computeMonths(voyage);
  } catch (err) {
    $("#loading").innerHTML = `
      <div style="color:#e88080;font-family:'DM Mono',monospace;font-size:13px;line-height:1.7;max-width:560px;margin:0 auto;text-align:left;padding:24px;background:rgba(201,68,68,0.08);border:1px solid rgba(201,68,68,0.3);border-radius:10px;">
        <strong style="color:#e88080;display:block;margin-bottom:8px;">Failed to load budget data</strong>
        ${err.message}<br><br>
        Browsers block <code>fetch()</code> on <code>file://</code>. Serve this folder over HTTP — from this directory run:<br>
        <code style="display:block;margin-top:8px;padding:6px 8px;background:rgba(0,0,0,0.3);border-radius:4px;">python -m http.server 8000</code>
        then open <code>http://localhost:8000/circumnavigation/budget.html</code>
      </div>`;
    return;
  }

  const budgetMonths = computeBudget(voyage, rates);
  const yearCount = budgetMonths.length ? budgetMonths[budgetMonths.length - 1].year : 0;

  STATE.data = {
    meta: rates.meta,
    categories: rates.categories,
    loHiRanges: rates.loHiRanges,
    recurring: rates.recurring,
    notes: rates.notes,
    years: rates.years || [],
    months: budgetMonths,
  };
  STATE.yearCount = yearCount;

  // Default selected month per year = first month of that year
  for (let y = 1; y <= yearCount; y++) {
    const first = budgetMonths.find((m) => m.year === y);
    if (first) STATE.currentMonth[y] = first.id;
  }

  $("#loading").remove();

  renderTabs();
  renderYearPanels();
  renderTiles();
  renderHeaderChips();
  for (let y = 1; y <= yearCount; y++) {
    renderMonthSubtabs(y);
    renderMonthPanel(y);
  }
  renderCashFlow();
  renderRollupCategories();
  renderRollupYears();
  renderRollupNotes();

  $$(".tab").forEach((t) => {
    t.addEventListener("click", () => showYear(t.dataset.year));
  });

  handleHash();
  window.addEventListener("hashchange", handleHash);
}

boot();

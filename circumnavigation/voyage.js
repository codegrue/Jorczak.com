// Jorczak.com — Circumnavigation Voyage Page
// World-map route plot + destination-by-destination timeline.
//
// Data source (fetched at boot):
//   voyage.jsonc — waypoints, routes, segments, map labels, cartouche text
//   continents.js — Natural Earth 110m land polygons (loaded as <script>)

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const MAP_W = 1000;
const MAP_H = 500;

function project(lat, lng) {
  return {
    x: ((lng + 180) * MAP_W) / 360,
    y: ((90 - lat) * MAP_H) / 180,
  };
}

// CONTINENTS is provided by continents.js (loaded before this script).

let VOYAGE = null; // voyage.jsonc

// Alternating earthy tones per month — even months antique gold, odd months
// rust — so adjacent month borders contrast strongly while still feeling part
// of the aged-atlas palette. Values match --gold / --coral in styles.css.
function monthColor(mi) {
  return mi % 2 ? "#a04a30" : "#b8932e";
}

// ============================================================
// MAP RENDERING
// ============================================================

// ============================================================
// ROUTE MODE — flat KML-ordered route preview
// ============================================================

function buildPathDWithWrap(pts) {
  let d = "";
  for (let i = 0; i < pts.length; i++) {
    if (i === 0) {
      d = `M ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
      continue;
    }
    const dx = pts[i].x - pts[i - 1].x;
    if (Math.abs(dx) > 500) {
      const goesLeft = dx > 0;
      const exitX = goesLeft ? -15 : MAP_W + 15;
      const entryX = goesLeft ? MAP_W + 15 : -15;
      const midY = (pts[i - 1].y + pts[i].y) / 2;
      d += ` L ${exitX.toFixed(1)} ${midY.toFixed(1)}`;
      d += ` M ${entryX.toFixed(1)} ${midY.toFixed(1)}`;
      d += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
    } else {
      d += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
    }
  }
  return d;
}

// AbortController for the previous attachZoomPan's window listeners. Each new
// renderRouteMap aborts the previous one so window-level handlers don't accumulate.
let zoomPanAbort = null;

// Attach wheel-zoom + drag-pan + double-click-reset to a rendered map SVG.
// Returns a reset function. Suppresses click events that came from a drag.
function attachZoomPan(svg) {
  if (zoomPanAbort) zoomPanAbort.abort();
  zoomPanAbort = new AbortController();
  const signal = zoomPanAbort.signal;

  const initial = { x: 0, y: 0, w: MAP_W, h: MAP_H };
  const minW = 25;
  const maxZoom = initial.w / minW;
  let vb = { ...initial };
  let dragging = false;
  let dragStart = null;
  let dragMoved = false;
  const zoomListeners = new Set();

  function setViewBox() {
    svg.setAttribute("viewBox", `${vb.x.toFixed(2)} ${vb.y.toFixed(2)} ${vb.w.toFixed(2)} ${vb.h.toFixed(2)}`);
  }
  function getZoom() {
    return initial.w / vb.w;
  }
  function notifyZoom() {
    const z = getZoom();
    zoomListeners.forEach((fn) => fn(z));
  }
  function setZoom(zoom, anchorX = 0.5, anchorY = 0.5) {
    const clamped = Math.min(Math.max(zoom, 1), maxZoom);
    const newW = initial.w / clamped;
    const newH = initial.h / clamped;
    const px = vb.x + anchorX * vb.w;
    const py = vb.y + anchorY * vb.h;
    vb.x = px - anchorX * newW;
    vb.y = py - anchorY * newH;
    vb.w = newW;
    vb.h = newH;
    clamp();
    setViewBox();
    notifyZoom();
  }
  function clamp() {
    if (vb.w > initial.w) {
      vb.w = initial.w;
      vb.h = initial.h;
    }
    if (vb.x < 0) vb.x = 0;
    if (vb.y < 0) vb.y = 0;
    if (vb.x + vb.w > initial.w) vb.x = initial.w - vb.w;
    if (vb.y + vb.h > initial.h) vb.y = initial.h - vb.h;
  }
  function reset() {
    vb = { ...initial };
    setViewBox();
    notifyZoom();
  }

  svg.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width;
      const my = (e.clientY - rect.top) / rect.height;
      const factor = e.deltaY < 0 ? 0.8 : 1.25;
      const targetZoom = (initial.w / vb.w) * (factor < 1 ? 1.25 : 0.8);
      // Anchor zoom around cursor position so wheel interaction feels precise.
      setZoom(targetZoom, mx, my);
    },
    { passive: false, signal },
  );

  svg.addEventListener(
    "mousedown",
    (e) => {
      if (e.button !== 0) return;
      dragging = true;
      dragMoved = false;
      dragStart = { x: e.clientX, y: e.clientY, vbx: vb.x, vby: vb.y };
      svg.style.cursor = "grabbing";
    },
    { signal },
  );

  window.addEventListener(
    "mousemove",
    (e) => {
      if (!dragging) return;
      const dxClient = e.clientX - dragStart.x;
      const dyClient = e.clientY - dragStart.y;
      if (Math.abs(dxClient) > 3 || Math.abs(dyClient) > 3) dragMoved = true;
      const rect = svg.getBoundingClientRect();
      vb.x = dragStart.vbx - (dxClient / rect.width) * vb.w;
      vb.y = dragStart.vby - (dyClient / rect.height) * vb.h;
      clamp();
      setViewBox();
    },
    { signal },
  );

  window.addEventListener(
    "mouseup",
    () => {
      if (dragging) {
        dragging = false;
        svg.style.cursor = "grab";
      }
    },
    { signal },
  );

  // Suppress clicks that arrived from a drag
  svg.addEventListener(
    "click",
    (e) => {
      if (dragMoved) {
        e.stopPropagation();
        e.preventDefault();
        dragMoved = false;
      }
    },
    { capture: true, signal },
  );

  // Double-click on empty map area resets zoom
  svg.addEventListener(
    "dblclick",
    (e) => {
      // Only reset if not on a clickable element
      const tag = e.target.tagName;
      if (tag === "path" || tag === "rect" || tag === "g" || tag === "svg") reset();
    },
    { signal },
  );

  svg.style.cursor = "grab";
  reset.setZoom = (zoom) => setZoom(zoom);
  reset.getZoom = () => getZoom();
  reset.onZoom = (fn) => {
    zoomListeners.add(fn);
    fn(getZoom());
    return () => zoomListeners.delete(fn);
  };
  return reset;
}

function mountZoomControls(mapEl, zoomCtl) {
  let controls = $(".map-zoom-controls", mapEl);
  if (!controls) {
    controls = document.createElement("div");
    controls.className = "map-zoom-controls";
    mapEl.appendChild(controls);
  }

  let resetBtn = $(".map-zoom-reset", controls);
  if (!resetBtn) {
    resetBtn = document.createElement("button");
    resetBtn.className = "map-zoom-reset";
    resetBtn.textContent = "⟲ reset zoom";
    resetBtn.title = "Reset map zoom (or double-click the map)";
    controls.appendChild(resetBtn);
  }
  resetBtn.onclick = zoomCtl;

  let slider = $(".map-zoom-slider", controls);
  if (!slider) {
    const plusLabel = document.createElement("span");
    plusLabel.className = "map-zoom-label map-zoom-label-plus";
    plusLabel.textContent = "+";
    controls.appendChild(plusLabel);

    slider = document.createElement("input");
    slider.className = "map-zoom-slider";
    slider.type = "range";
    slider.min = "1";
    slider.max = "40";
    slider.step = "0.1";
    slider.title = "Map zoom";
    controls.appendChild(slider);

    const minusLabel = document.createElement("span");
    minusLabel.className = "map-zoom-label map-zoom-label-minus";
    minusLabel.textContent = "−";
    controls.appendChild(minusLabel);
  }

  slider.addEventListener("input", () => {
    zoomCtl.setZoom(Number(slider.value));
  });
  zoomCtl.onZoom((z) => {
    slider.value = z.toFixed(1);
  });
}

// Group the flat ordered waypoint list by the active groupBy key ('month' or 'segment').
// Returns groups in route order; each group has its key, ordered waypoints, and metadata.
const STATE = { groupBy: "month" };

function buildGroups(groupBy) {
  const wps = VOYAGE.waypoints || [];
  const meta = (groupBy === "segment" ? VOYAGE.segments : VOYAGE.months) || [];
  const metaById = new Map(meta.map((m) => [m.id, m]));
  const groups = [];
  let cur = null;
  for (let i = 0; i < wps.length; i++) {
    const wp = wps[i];
    const k = wp[groupBy];
    if (!cur || cur.key !== k) {
      const m = metaById.get(k);
      cur = {
        key: k,
        label: m ? m.label || m.name || k : k,
        nm: m && m.nm ? m.nm : 0,
        waypoints: [],
        firstIdx: i,
      };
      groups.push(cur);
    }
    cur.waypoints.push(wp);
  }
  return groups;
}

// Type-based segment color — blue for ocean crossings, green for coastal/land,
// brown for inland waterways. Falls back to green if type is missing.
const SEGMENT_TYPE_COLOR = {
  crossing: "#3b6f93", // sea blue
  coastal: "#7a9c3a", // grass green
  inland: "#7a4f24", // warm walnut brown
};

function segmentTypeColor(seg) {
  return (seg && SEGMENT_TYPE_COLOR[seg.type]) || SEGMENT_TYPE_COLOR.coastal;
}

function isNextCalendarMonth(prev, next) {
  const a = MONTH_NAMES.indexOf(prev);
  const b = MONTH_NAMES.indexOf(next);
  if (a < 0 || b < 0) return false;
  return (a + 1) % 12 === b;
}

function monthListToSeasonText(months) {
  if (!months || !months.length) return "";
  const ranges = [];
  let start = months[0];
  let prev = months[0];

  for (let i = 1; i < months.length; i++) {
    const cur = months[i];
    if (isNextCalendarMonth(prev, cur)) {
      prev = cur;
      continue;
    }
    ranges.push(start === prev ? start : `${start}–${prev}`);
    start = cur;
    prev = cur;
  }
  ranges.push(start === prev ? start : `${start}–${prev}`);
  return ranges.join(" & ");
}

function hurricaneSeasonTagHtml(seg) {
  if (!seg) return "";
  const fallbackMonths = SEGMENT_RISK_MONTHS[seg.id] || [];
  const seasonText = seg.hurricaneSeason || monthListToSeasonText(fallbackMonths) || "n/a";
  return (
    '<div class="tl3-course-tags">' +
    '<span class="tl3-tag tl3-tag-hurricane" title="Cyclone / hurricane season window for this segment">' +
    "🌀 " +
    seasonText +
    "</span></div>"
  );
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function startMonthIndex() {
  const m = (VOYAGE && VOYAGE.voyage && VOYAGE.voyage.startMonth) || "Jan";
  const i = MONTH_NAMES.indexOf(m);
  return i < 0 ? 0 : i;
}

function calendarMonthFor(monthNum) {
  return MONTH_NAMES[(startMonthIndex() + monthNum - 1) % 12];
}

// Countries in the Schengen Area (as of 2024 — Croatia 2023, Bulgaria + Romania 2024).
const SCHENGEN_COUNTRIES = new Set([
  "Austria", "Belgium", "Bulgaria", "Croatia", "Czech Republic", "Denmark",
  "Estonia", "Finland", "France", "Germany", "Greece", "Hungary", "Iceland",
  "Italy", "Latvia", "Liechtenstein", "Lithuania", "Luxembourg", "Malta",
  "Netherlands", "Norway", "Poland", "Portugal", "Romania", "Slovakia",
  "Slovenia", "Spain", "Sweden", "Switzerland",
]);

// Islands / autonomous regions that belong to a Schengen country but don't carry
// `mainland-country-share:` in their tourStayRule.
const SCHENGEN_TERRITORY_LABELS = new Set([
  "Azores — Horta",
  "Madeira — Funchal",
  "Canary Islands — Tenerife",
  "Crete — Heraklion",
]);

function isSchengenWaypoint(w) {
  if (!w) return false;
  const rule = w.tourStayRule || "";
  const m = rule.match(/^mainland-country-share:(.+)$/);
  if (m) return SCHENGEN_COUNTRIES.has(m[1].trim());
  return SCHENGEN_TERRITORY_LABELS.has(w.label);
}

// Schengen 90/180 stay rule. For each labeled destination, count how many of the
// previous 180 days (ending at the end of that destination's tour) were spent in
// Schengen territory. Sail days count as Schengen only when both endpoints are.
// Home trips are inserted at month-end: only exit + re-entry transit days count
// as Schengen (2 days total), while the rest of the home-trip days are outside.
function computeSchengenWindow(destinations, routeIntoWp, voyageMonths) {
  const activities = []; // { startDay, days, schengen }
  const monthMetaById = new Map((voyageMonths || []).map((m) => [m.id, m]));

  function appendMonthEndHomeTrip(monthId, dayRef) {
    const vm = monthMetaById.get(monthId);
    const homeDays = vm && vm.plannedHomeDays ? vm.plannedHomeDays : 0;
    if (!homeDays) return dayRef;

    // For Schengen accounting, home trips contribute only two transit days total.
    // The full home-trip duration is still shown in UI events, but does not advance
    // the Schengen rolling-day timeline beyond exit + re-entry.
    const transitDays = Math.min(homeDays, 2);
    if (transitDays >= 1) activities.push({ startDay: dayRef, days: 1, schengen: true });
    if (transitDays >= 2) activities.push({ startDay: dayRef + 1, days: 1, schengen: true });
    return dayRef + transitDays;
  }

  let day = 0;
  let prevMonth = null;
  destinations.forEach((w, i) => {
    if (prevMonth !== null && w.month !== prevMonth) {
      day = appendMonthEndHomeTrip(prevMonth, day);
    }

    // Snapshot at route-arrival (before local tour/stay begins for this destination).
    w._dayAtRouteArrival = day;

    if (i > 0) {
      const r = routeIntoWp.get(w.id);
      if (r) {
        const inSchengenSail = isSchengenWaypoint(destinations[i - 1]) && isSchengenWaypoint(w);
        activities.push({ startDay: day, days: r.days, schengen: inSchengenSail });
        day += r.days;
        w._dayAtRouteArrival = day;
      }
    }
    const tour = w.tourStayDays || 0;
    activities.push({ startDay: day, days: tour, schengen: isSchengenWaypoint(w) });
    w._dayAtTourEnd = day + tour;
    day += tour;
    prevMonth = w.month;
  });

  if (prevMonth !== null) {
    day = appendMonthEndHomeTrip(prevMonth, day);
  }

  function countAt(endDay) {
    const windowStart = endDay - 180;
    let sum = 0;
    for (const a of activities) {
      if (!a.schengen) continue;
      const aEnd = a.startDay + a.days;
      const overlap = Math.min(aEnd, endDay) - Math.max(a.startDay, windowStart);
      if (overlap > 0) sum += overlap;
    }
    return sum;
  }

  const tourEndCounts = new Map();
  const routeArrivalCounts = new Map();
  destinations.forEach((w) => {
    tourEndCounts.set(w.id, countAt(w._dayAtTourEnd));
    routeArrivalCounts.set(w.id, countAt(w._dayAtRouteArrival));
  });
  return { tourEndCounts, routeArrivalCounts };
}

function computeHomeTripSchengenImpactByMonth(destinations, voyageMonths) {
  const months = voyageMonths || [];
  const lastByMonth = new Map();

  for (const w of destinations || []) {
    if (!w || !w.month) continue;
    lastByMonth.set(w.month, w);
  }

  const impactByMonth = new Map();
  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    const homeDays = m && m.plannedHomeDays ? m.plannedHomeDays : 0;
    if (!homeDays) continue;

    const transitDays = Math.min(homeDays, 2);
    if (!transitDays) continue;

    let impact = 0;
    const lastInMonth = lastByMonth.get(m.id);
    if (lastInMonth && isSchengenWaypoint(lastInMonth)) impact = transitDays;

    if (impact > 0) impactByMonth.set(m.id, impact);
  }

  return impactByMonth;
}

function calendarYearFor(monthNum, startYear) {
  return startYear + Math.floor((startMonthIndex() + monthNum - 1) / 12);
}

function formatMonthMapTitle(monthId) {
  if (!monthId) return "Unknown month";
  const monthNum = Number(String(monthId).replace(/^m/i, ""));
  if (!monthNum) return monthId;
  const startYear = (VOYAGE && VOYAGE.voyage && VOYAGE.voyage.startYear) || 2034;
  const cal = calendarMonthFor(monthNum);
  const calYear = calendarYearFor(monthNum, startYear);
  const voyageYr = Math.ceil(monthNum / 12);
  return `Month ${monthNum} · ${cal} ${calYear} · Yr ${voyageYr}`;
}

function segmentModeColor(seg) {
  // `seg` may be a synthetic group (built in buildGroups) that lacks `type`.
  // Resolve to the canonical segment so the type lookup always works.
  if (seg && seg.type) return segmentTypeColor(seg);
  const full = seg && VOYAGE && (VOYAGE.segments || []).find((s) => s.id === seg.id);
  return segmentTypeColor(full || seg || {});
}

function dominantSegmentId(waypoints) {
  const counts = new Map();
  for (const w of waypoints) {
    counts.set(w.segment, (counts.get(w.segment) || 0) + 1);
  }
  let best = null;
  let bestCount = -1;
  for (const [id, c] of counts.entries()) {
    if (c > bestCount) {
      best = id;
      bestCount = c;
    }
  }
  return best;
}

// Tropical cyclone season per segment. Derived from real-world basin climatology;
// keyed off the calendar month (Jan-Dec), so it auto-updates when voyage.startMonth changes.
const SEGMENT_RISK_MONTHS = {
  midAtlantic: ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"],
  nAtlantic: ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"],
  caribbean: ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"],
  sAmericaNE: ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"],
  sAtlantic: [],
  sAmericaSE: ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"],
  sAmericaSW: [],
  antarctica: [],
  sPacific: ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"],
  oceanic: ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"],
  asia: ["May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"],
  indian: ["Apr", "May", "Jun", "Oct", "Nov", "Dec"],
  africaSouth: ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"],
  baltic: [],
  rhineDanube: [],
  mediterranean: [],
};

function normalizeMonthToken(token) {
  if (!token) return null;
  const t = token.trim();
  if (!t) return null;
  const short = t.slice(0, 3).toLowerCase();
  const map = {
    jan: "Jan",
    feb: "Feb",
    mar: "Mar",
    apr: "Apr",
    may: "May",
    jun: "Jun",
    jul: "Jul",
    aug: "Aug",
    sep: "Sep",
    oct: "Oct",
    nov: "Nov",
    dec: "Dec",
  };
  return map[short] || null;
}

function expandMonthRange(startMonth, endMonth) {
  const a = MONTH_NAMES.indexOf(startMonth);
  const b = MONTH_NAMES.indexOf(endMonth);
  if (a < 0 || b < 0) return [];
  const out = [];
  let i = a;
  while (true) {
    out.push(MONTH_NAMES[i]);
    if (i === b) break;
    i = (i + 1) % 12;
  }
  return out;
}

function parseSeasonMonths(seasonText) {
  if (!seasonText || typeof seasonText !== "string") return [];
  const months = new Set();
  const parts = seasonText
    .replace(/\u2013|\u2014/g, "-")
    .split(/&|,/)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const p of parts) {
    const m = p.match(/^([A-Za-z]+)\s*-\s*([A-Za-z]+)$/);
    if (m) {
      const start = normalizeMonthToken(m[1]);
      const end = normalizeMonthToken(m[2]);
      expandMonthRange(start, end).forEach((mo) => months.add(mo));
      continue;
    }
    const single = normalizeMonthToken(p);
    if (single) months.add(single);
  }

  return Array.from(months);
}

// Fallback hemisphere when a month has no waypoints to derive from.
const SEGMENT_HEMI = {
  midAtlantic: "N", baltic: "N", rhineDanube: "N", mediterranean: "N", nAtlantic: "N",
  sAmericaSE: "S", antarctica: "S", sAmericaSW: "S", sPacific: "S", oceanic: "S",
  asia: "N", indian: "S", africaSouth: "S", sAtlantic: "S", sAmericaNE: "N", caribbean: "N",
};

function hemisphereForMonth(monthMeta) {
  if (!monthMeta) return "N";
  const wps = (VOYAGE.waypoints || []).filter((w) => w.month === monthMeta.id);
  if (wps.length) {
    const avg = wps.reduce((s, w) => s + w.lat, 0) / wps.length;
    return avg >= 0 ? "N" : "S";
  }
  return SEGMENT_HEMI[monthMeta.dominantSegment] || "N";
}

function seasonForMonth(monthMeta) {
  if (!monthMeta) return "";
  const monthNum = Number(String(monthMeta.id).replace(/^m/i, ""));
  const cal = calendarMonthFor(monthNum);
  const i = MONTH_NAMES.indexOf(cal);
  const nh = i === 11 || i === 0 || i === 1 ? "Winter" : i >= 2 && i <= 4 ? "Spring" : i >= 5 && i <= 7 ? "Summer" : "Autumn";
  if (hemisphereForMonth(monthMeta) === "N") return nh;
  return { Winter: "Summer", Spring: "Autumn", Summer: "Winter", Autumn: "Spring" }[nh];
}

function isCycloneRiskMonth(monthMeta, segId) {
  if (!monthMeta) return false;
  const seg = segId || monthMeta.dominantSegment;
  if (!seg) return false;
  const monthNum = Number(String(monthMeta.id).replace(/^m/i, ""));
  const cal = calendarMonthFor(monthNum);
  const segMeta = (VOYAGE && VOYAGE.segments ? VOYAGE.segments : []).find((s) => s.id === seg);
  if (segMeta && segMeta.hurricaneSeason) {
    return parseSeasonMonths(segMeta.hurricaneSeason).includes(cal);
  }
  return (SEGMENT_RISK_MONTHS[seg] || []).includes(cal);
}

function renderRouteMap() {
  const groups = buildGroups(STATE.groupBy);
  const N = groups.length;
  const monthById = new Map((VOYAGE.months || []).map((m) => [m.id, m]));
  const segmentById = new Map((VOYAGE.segments || []).map((s) => [s.id, s]));
  // Backward-compat shim so existing template code keeps working
  const segments = groups.map((g) => ({
    id: g.key,
    name: g.label,
    nm: g.nm,
    waypoints: g.waypoints,
  }));

  // Route lookup: route ending at waypoint id → the route record (with via points).
  const routeIntoWp = new Map((VOYAGE.routes || []).map((r) => [r.to, r]));

  let routePaths = "";
  let routeTags = "";
  let waypointDots = "";
  let startMarker = "";

  // Build polylines per group. Each group's line continues from the previous group's
  // last waypoint so the colored segments connect (no visible gaps at month boundaries).
  // Via points from routes are inserted between consecutive waypoints to follow the
  // actual sea route around land masses.
  let prevWp = null;
  segments.forEach((seg, si) => {
    // In "By Month" mode the line color matches the month's accent (alternating
    // light/dark gray). In "By Segment" mode the line keeps the segment type color
    // (sea blue / forest green / walnut brown).
    const domSegId = STATE.groupBy === "segment" ? seg.id : dominantSegmentId(seg.waypoints);
    const segMeta = (VOYAGE.segments || []).find((s) => s.id === domSegId);
    const color = STATE.groupBy === "month" ? monthColor(si) : segmentTypeColor(segMeta);
    const ownPts = seg.waypoints.map((w) => project(w.lat, w.lng));
    const linePts = [];
    if (prevWp) {
      linePts.push(project(prevWp.lat, prevWp.lng));
      const r = routeIntoWp.get(seg.waypoints[0].id);
      if (r && r.via) r.via.forEach((v) => linePts.push(project(v.lat, v.lng)));
    }
    seg.waypoints.forEach((w, wi) => {
      if (wi > 0) {
        const r = routeIntoWp.get(w.id);
        if (r && r.via) r.via.forEach((v) => linePts.push(project(v.lat, v.lng)));
      }
      linePts.push(ownPts[wi]);
    });
    const destCount = seg.waypoints.length;
    const nmText = seg.nm ? `${seg.nm.toLocaleString()} nm · ` : "";
    routePaths += `<path d="${buildPathDWithWrap(linePts)}" stroke="${color}" class="route-seg" data-seg-id="${seg.id}"><title>${seg.name} · ${nmText}${destCount} destinations</title></path>`;

    if (STATE.groupBy === "month" && linePts.length > 1) {
      const monthMeta = monthById.get(seg.id) || null;
      const isRisk = isCycloneRiskMonth(monthMeta, domSegId);
      let longest = { d: -1, mx: linePts[0].x, my: linePts[0].y };
      for (let i = 1; i < linePts.length; i++) {
        const a = linePts[i - 1];
        const b = linePts[i];
        let dx = b.x - a.x;
        if (Math.abs(dx) > MAP_W / 2) {
          dx = dx > 0 ? dx - MAP_W : dx + MAP_W;
        }
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > longest.d) {
          let mx = a.x + dx / 2;
          if (mx < 0) mx += MAP_W;
          if (mx > MAP_W) mx -= MAP_W;
          longest = { d: d2, mx, my: a.y + dy / 2 };
        }
      }
      const monthNum = Number((seg.id || "").replace(/^m/i, "")) || si + 1;
      const startYear = (VOYAGE && VOYAGE.voyage && VOYAGE.voyage.startYear) || 2034;
      const calendarYear = calendarYearFor(monthNum, startYear);
      const monthTag = `${calendarMonthFor(monthNum)}${String(calendarYear).slice(-2)}`;
      const monthYearTitle = formatMonthMapTitle(seg.id);
      const tagClass = isRisk ? "route-tag route-tag-hazard" : "route-tag";
      const tagText = isRisk ? `⚠ ${monthTag}` : monthTag;
      routeTags += `<text x="${longest.mx.toFixed(1)}" y="${(longest.my - 6).toFixed(1)}" class="${tagClass}" text-anchor="middle">${tagText}<title>${monthYearTitle}</title></text>`;
    }

    seg.waypoints.forEach((w, wi) => {
      const p = ownPts[wi];
      const wpClass = w.kind === "side-trip" ? "route-wp route-wp-side-trip" : "route-wp";
      const monthLabel = formatMonthMapTitle(w.month);
      const courseLabel = (segmentById.get(w.segment) && segmentById.get(w.segment).name) || seg.name || "Unknown course";
      const stayDays = formatDays(w.tourStayDays);
      const titleLine1 = `${w.label}${stayDays ? ` (${stayDays})` : ""}`;
      const titleLine2 = monthLabel;
      const titleLine3 = courseLabel;
      waypointDots += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="1.8" class="${wpClass}" data-seg-id="${seg.id}"><title>${titleLine1}&#10;${titleLine2}&#10;${titleLine3}</title></circle>`;
    });
    prevWp = seg.waypoints[seg.waypoints.length - 1];
  });

  // Start marker
  const start = segments[0].waypoints[0];
  const sp = project(start.lat, start.lng);
  startMarker = `
    <circle cx="${sp.x.toFixed(1)}" cy="${sp.y.toFixed(1)}" r="11" fill="none" stroke="#b8932e" stroke-width="1.2" opacity="0.7"/>
    <circle cx="${sp.x.toFixed(1)}" cy="${sp.y.toFixed(1)}" r="6" fill="#b8932e" stroke="#2e1d0a" stroke-width="1.4"/>
    <text x="${sp.x.toFixed(1)}" y="${(sp.y - 13).toFixed(1)}" class="wp-label" text-anchor="middle">⚓ Start</text>
  `;

  // Continents, graticule, region labels — reused from month mode
  const continentsHtml = CONTINENTS.map((d) => `<path d="${d}" class="continent"/>`).join("");

  let graticule = "";
  for (let lng = -180; lng <= 180; lng += 30) {
    const x = (((lng + 180) * MAP_W) / 360).toFixed(1);
    graticule += `<line x1="${x}" y1="0" x2="${x}" y2="${MAP_H}" class="grid-line"/>`;
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = (((90 - lat) * MAP_H) / 180).toFixed(1);
    graticule += `<line x1="0" y1="${y}" x2="${MAP_W}" y2="${y}" class="grid-line"/>`;
  }
  const eqY = (MAP_H / 2).toFixed(1);
  graticule += `<line x1="0" y1="${eqY}" x2="${MAP_W}" y2="${eqY}" class="grid-equator"/>`;

  const regionLabels = (VOYAGE.mapLabels || [])
    .map((l) => {
      const cls =
        l.type === "continent"
          ? "region-label"
          : l.type === "ocean-major"
            ? "region-label ocean major"
            : l.type === "ocean"
              ? "region-label ocean"
              : "region-label";
      return `<text x="${l.x}" y="${l.y}" class="${cls}" text-anchor="middle">${l.text}</text>`;
    })
    .join("");

  // Cartouche — totals come from the canonical voyage data so they don't depend on grouping mode
  const totalNm = (VOYAGE.segments || []).reduce((s, x) => s + (x.nm || 0), 0);
  const totalDest = segments.reduce((s, x) => s + x.waypoints.filter((w) => w.label).length, 0);
  const cartouche = `
    <g transform="translate(820 415)" class="map-cartouche">
      <rect x="0" y="0" width="170" height="68" rx="2" fill="#f1e4be" stroke="#4a3217" stroke-width="0.8"/>
      <rect x="3" y="3" width="164" height="62" rx="1" fill="none" stroke="#b8932e" stroke-width="0.5"/>
      <text x="85" y="22" text-anchor="middle" class="cartouche-title">Route Preview</text>
      <text x="85" y="36" text-anchor="middle" class="cartouche-sub">${totalNm.toLocaleString()} nm · ${totalDest} destinations</text>
      <text x="85" y="54" text-anchor="middle" class="cartouche-sub">${N} ${STATE.groupBy === "month" ? "months" : "segments"} · start: Annapolis, MD</text>
    </g>
  `;

  const svg = `
    <svg viewBox="0 0 ${MAP_W} ${MAP_H}" xmlns="http://www.w3.org/2000/svg" class="world-map-svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <pattern id="ocean-grain" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.4" fill="rgba(74,50,23,0.10)"/>
        </pattern>
      </defs>
      <rect width="${MAP_W}" height="${MAP_H}" fill="#ecdcb0"/>
      <rect width="${MAP_W}" height="${MAP_H}" fill="url(#ocean-grain)"/>
      <g class="graticule">${graticule}</g>
      <g class="continents">${continentsHtml}</g>
      <g class="regions">${regionLabels}</g>
      <g class="route" style="overflow:visible">${routePaths}</g>
      <g class="route-tags">${routeTags}</g>
      <g class="route-wps">${waypointDots}</g>
      <g class="start-marker">${startMarker}</g>
      ${cartouche}
    </svg>
  `;

  $("#world-map").innerHTML = svg;

  // Wire wheel-zoom + drag-pan + reset button
  const svgEl = $("#world-map svg");
  const reset = attachZoomPan(svgEl);
  // Expose current zoom as a CSS variable so map elements (route stroke, dots, labels)
  // can scale inversely and stay visually constant at any zoom level.
  reset.onZoom((z) => svgEl.style.setProperty("--zoom", z));

  // Group-by toggle (By Month / By Segment) — overlay top-left of map
  const toggle = document.createElement("div");
  toggle.className = "map-toggle";
  toggle.innerHTML =
    `<button data-mode="month"${STATE.groupBy === "month" ? ' class="active"' : ""}>By Month</button>` +
    `<button data-mode="segment"${STATE.groupBy === "segment" ? ' class="active"' : ""}>By Segment</button>`;
  toggle.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-mode]");
    if (!btn || btn.dataset.mode === STATE.groupBy) return;
    STATE.groupBy = btn.dataset.mode;
    renderMap();
    renderTimeline();
  });
  $("#world-map").appendChild(toggle);

  // Reset-zoom button + zoom slider (top-right)
  mountZoomControls($("#world-map"), reset);

  // Wire segment dots → scroll to segment block in timeline
  $$(".route-seg, .route-wp").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset.segId;
      const block = document.querySelector(`.route-block[data-seg-id="${id}"]`);
      if (block) {
        block.scrollIntoView({ behavior: "smooth", block: "start" });
        block.classList.add("pulse");
        setTimeout(() => block.classList.remove("pulse"), 1500);
      }
    });
  });
}

function formatNm(nm) {
  return Math.round(nm).toLocaleString() + " nm";
}

function formatDays(d) {
  if (d == null || d <= 0) return "";
  return (d % 1 === 0 ? String(d) : d.toFixed(1)) + "d";
}

// Home / haul destination rows at the end of each voyage month (after that month's ports).
function appendMonthEndEvents(rows, monthId, lastWp, monthMetaById) {
  const vm = monthMetaById.get(monthId);
  if (!vm) return;
  const seg = lastWp ? lastWp.segment : null;
  if (vm.plannedHomeDays > 0) {
    rows.push({
      type: "event",
      kind: "home",
      month: monthId,
      segment: seg,
      days: vm.plannedHomeDays,
    });
  }
  if (vm.plannedHaulDays > 0) {
    rows.push({
      type: "event",
      kind: "haul",
      month: monthId,
      segment: seg,
      days: vm.plannedHaulDays,
    });
  }
}

function buildTimelineRows(destinations, voyageMonths) {
  const monthMetaById = new Map((voyageMonths || []).map((m) => [m.id, m]));
  const rows = [];
  let prevMonth = null;
  let lastWpInMonth = null;

  for (let i = 0; i < destinations.length; i++) {
    const w = destinations[i];
    if (w.month !== prevMonth) {
      if (prevMonth !== null) {
        appendMonthEndEvents(rows, prevMonth, lastWpInMonth, monthMetaById);
      }
      prevMonth = w.month;
    }
    lastWpInMonth = w;
    rows.push({ type: "waypoint", w, destIndex: i });
  }
  if (prevMonth !== null) {
    appendMonthEndEvents(rows, prevMonth, lastWpInMonth, monthMetaById);
  }

  // Haul-out can spill into a month with no ports (events-only month).
  const monthsInRows = new Set();
  for (const row of rows) {
    monthsInRows.add(row.type === "waypoint" ? row.w.month : row.month);
  }
  for (const vm of voyageMonths || []) {
    if (monthsInRows.has(vm.id)) continue;
    if (!(vm.plannedHomeDays || vm.plannedHaulDays)) continue;
    appendMonthEndEvents(rows, vm.id, null, monthMetaById);
  }

  return rows;
}

function renderRouteTimeline() {
  const host = $("#voyage-timeline");
  const destinations = VOYAGE.waypoints || [];
  const routeIntoWp = new Map((VOYAGE.routes || []).map((r) => [r.to, r]));
  const schengenSnapshots = computeSchengenWindow(destinations, routeIntoWp, VOYAGE.months || []);
  const schengenCount = schengenSnapshots.tourEndCounts;
  const schengenRouteCount = schengenSnapshots.routeArrivalCounts;
  const homeTripSchengenImpact = computeHomeTripSchengenImpactByMonth(destinations, VOYAGE.months || []);
  const monthById = new Map((VOYAGE.months || []).map((m) => [m.id, m]));
  const segmentById = new Map((VOYAGE.segments || []).map((s) => [s.id, s]));
  const monthIndexById = new Map((VOYAGE.months || []).map((m, i) => [m.id, i]));
  const segmentIndexById = new Map((VOYAGE.segments || []).map((s, i) => [s.id, i]));
  const mediterraneanIndex = segmentIndexById.has("mediterranean") ? segmentIndexById.get("mediterranean") : Infinity;
  const showSchengenForSegment = (segId) => {
    if (mediterraneanIndex === Infinity) return true;
    if (!segmentIndexById.has(segId)) return false;
    return segmentIndexById.get(segId) <= mediterraneanIndex;
  };
  const rows = buildTimelineRows(destinations, VOYAGE.months);

  const startYear = (VOYAGE && VOYAGE.voyage && VOYAGE.voyage.startYear) || 2034;

  // Contiguous runs for month / course side cards (includes home & haul rows).
  const monthRuns = [];
  const segmentRuns = [];
  rows.forEach((row, i) => {
    const monthId = row.type === "waypoint" ? row.w.month : row.month;
    const segId = row.type === "waypoint" ? row.w.segment : row.segment;
    const lm = monthRuns[monthRuns.length - 1];
    if (lm && lm.id === monthId) lm.end = i;
    else monthRuns.push({ id: monthId, start: i, end: i });
    if (segId) {
      const ls = segmentRuns[segmentRuns.length - 1];
      if (ls && ls.id === segId) ls.end = i;
      else segmentRuns.push({ id: segId, start: i, end: i });
    }
  });

  const N = rows.length;
  const totalNm = (VOYAGE.segments || []).reduce((s, x) => s + (x.nm || 0), 0);

  let html = "";
  html +=
    '<div class="route-mode-banner">' +
    '<div class="route-mode-title"><em>The Voyage</em> · destination by destination</div>' +
    '<div class="route-mode-sub">' +
    destinations.length +
    " destinations · " +
    totalNm.toLocaleString() +
    " nm across " +
    monthRuns.length +
    " months and " +
    segmentRuns.length +
    " courses. Months at left, courses at right; each card spans every stop it covers." +
    "</div>" +
    "</div>";

  html += '<div class="tl3-grid" style="--rows: ' + N + '">';
  html += '<div class="tl3-head tl3-head-month">Month</div>';
  html += '<div class="tl3-head tl3-head-stops">Destinations</div>';
  html += '<div class="tl3-head tl3-head-course">Course</div>';

  html += '<div class="tl3-spine" style="grid-row: 2 / span ' + N + '"></div>';

  monthRuns.forEach((run) => {
    const meta = monthById.get(run.id) || {};
    const mi = monthIndexById.has(run.id) ? monthIndexById.get(run.id) : 0;
    const monthNum = Number(String(run.id).replace(/^m/i, "")) || mi + 1;
    const calendarYear = calendarYearFor(monthNum, startYear);
    const yearNum = Math.ceil(monthNum / 12);
    const span = run.end - run.start + 1;
    const startRow = run.start + 2;
    const hasHome = (meta.plannedHomeDays || 0) > 0;
    const hasHaul = (meta.plannedHaulDays || 0) > 0;
    const hasRisk = isCycloneRiskMonth(meta, meta.dominantSegment);
    const badges = [];
    if (hasHome) badges.push('<span class="tl3-badge tl3-badge-home">⌂ Home trip</span>');
    if (hasHaul) badges.push('<span class="tl3-badge tl3-badge-haul">⚓ Haul Out</span>');
    if (hasRisk) badges.push('<span class="tl3-badge tl3-badge-risk" title="Cyclone / hurricane risk month">🌀 Risk</span>');
    const color = monthColor(mi);
    html +=
      '<div class="tl3-month" style="grid-row: ' +
      startRow +
      " / span " +
      span +
      "; --accent: " +
      color +
      '">' +
      '<div class="tl3-month-num">Month ' +
      monthNum +
      " · Yr " +
      yearNum +
      "</div>" +
      '<div class="tl3-month-cal">' +
      calendarMonthFor(monthNum) +
      " " +
      calendarYear +
      "</div>" +
      ((function () { const s = seasonForMonth(meta); return s ? '<div class="tl3-month-season">' + s + "</div>" : ""; })()) +
      (badges.length ? '<div class="tl3-month-badges">' + badges.join("") + "</div>" : "") +
      "</div>";
  });

  rows.forEach((row, i) => {
    const gridRow = i + 2;
    const mi = monthIndexById.has(row.type === "waypoint" ? row.w.month : row.month)
      ? monthIndexById.get(row.type === "waypoint" ? row.w.month : row.month)
      : 0;
    const mColor = monthColor(mi);

    if (row.type === "event") {
      const isHome = row.kind === "home";
      const stopClass = isHome ? "tl3-stop tl3-stop-home" : "tl3-stop tl3-stop-haul";
      const flagClass = isHome ? "tl3-stop-flag-home" : "tl3-stop-flag-haul";
      const flagIcon = isHome ? "⌂" : "⚓";
      const kindLabel = isHome ? "Home trip" : "Haul Out";
      const monthMeta = monthById.get(row.month) || {};
      const monthSegId = monthMeta.dominantSegment || row.segment;
      const showSchengen = showSchengenForSegment(monthSegId);
      const homeSchengenImpact = isHome && showSchengen ? homeTripSchengenImpact.get(row.month) || 0 : 0;
      const homeSchengenHtml = homeSchengenImpact
        ? '<span class="tl3-stop-eu tl3-stop-eu-left tl3-stop-eu-delta" title="Schengen impact from home-trip transit days">+' +
          homeSchengenImpact +
          "</span>"
        : "";
      const daysTitle = isHome ? "Days away — home visit" : "Days in haul-out";
      const daysText = formatDays(row.days);
      const daysHtml = daysText ? '<span class="tl3-stop-days" title="' + daysTitle + '">' + daysText + "</span>" : "";
      const flagHtml = isHome
        ? ""
        : '<span class="tl3-stop-flag ' + flagClass + '" title="' + kindLabel + '">' + flagIcon + "</span>";
      html +=
        '<div class="' +
        stopClass +
        '" style="grid-row: ' +
        gridRow +
        '">' +
        homeSchengenHtml +
        flagHtml +
        '<span class="tl3-stop-label">' +
        '<span class="tl3-stop-kind">' +
        kindLabel +
        "</span>" +
        "</span>" +
        daysHtml +
        "</div>";
      return;
    }

    const w = row.w;
    const segMeta = segmentById.get(w.segment) || {};
    const typeColor = segmentTypeColor(segMeta);
    const showSchengen = showSchengenForSegment(w.segment);
    const daysHtml = formatDays(w.tourStayDays)
      ? '<span class="tl3-stop-days" title="Days ashore">' + formatDays(w.tourStayDays) + "</span>"
      : "";
    const route = routeIntoWp.get(w.id);
    const prevW = row.destIndex > 0 ? destinations[row.destIndex - 1] : null;
    const routeSchengenImpact =
      showSchengen && route && prevW && isSchengenWaypoint(prevW) && isSchengenWaypoint(w) ? route.days || 0 : 0;
    const routeSchengenCount = schengenRouteCount.get(w.id) || 0;
    const routeSchengenCls =
      "tl3-stop-eu" + (routeSchengenCount >= 90 ? " tl3-stop-eu-over" : routeSchengenCount >= 75 ? " tl3-stop-eu-warn" : "");
    const routeSchengenHtml =
      routeSchengenImpact > 0
        ? '<span class="tl3-leg-schengen ' + routeSchengenCls + '" title="Schengen count at this inbound route point">' +
          routeSchengenCount +
          "/90</span>"
        : "";
    const legHtml = route
      ? '<span class="tl3-leg-dist" title="Distance from previous">' +
        formatNm(route.distanceNm) +
        '</span><span class="tl3-leg-time" title="Travel time at sea">' +
        route.days +
        "d</span>" +
        routeSchengenHtml
      : "";
    const schengenHtml = (function () {
      if (!showSchengen) return "";
      const here = isSchengenWaypoint(w);
      if (!here) return "";
      const count = schengenCount.get(w.id) || 0;
      const cls = "tl3-stop-eu" + (count >= 90 ? " tl3-stop-eu-over" : count >= 75 ? " tl3-stop-eu-warn" : "");
      const star = here ? "★ " : "";
      const countChip = '<span class="' + cls + '" title="Days in Schengen (rolling 180-day window)">' + star + count + "/90</span>";
      return '<span class="tl3-stop-eu-stack">' + countChip + "</span>";
    })();
    html +=
      '<div class="tl3-stop" style="grid-row: ' +
      gridRow +
      "; --type: " +
      typeColor +
      "; --month: " +
      mColor +
      '">' +
      legHtml +
      schengenHtml +
      '<span class="tl3-stop-label">' +
      w.label +
      "</span>" +
      daysHtml +
      "</div>";
  });

  segmentRuns.forEach((run) => {
    const meta = segmentById.get(run.id) || {};
    const si = segmentIndexById.has(run.id) ? segmentIndexById.get(run.id) : 0;
    const color = segmentTypeColor(meta);
    const span = run.end - run.start + 1;
    const startRow = run.start + 2;
    html +=
      '<div class="tl3-course" style="grid-row: ' +
      startRow +
      " / span " +
      span +
      "; --accent: " +
      color +
      '" data-seg-id="' +
      run.id +
      '">' +
      '<div class="tl3-course-num">Course ' +
      String(si + 1).padStart(2, "0") +
      "</div>" +
      '<div class="tl3-course-name">' +
      (meta.name || run.id) +
      "</div>" +
      '<div class="tl3-course-meta">' +
      (meta.nm || 0).toLocaleString() +
      " nm · " +
      span +
      " destination" +
      (span !== 1 ? "s" : "") +
      "</div>" +
      hurricaneSeasonTagHtml(meta) +
      "</div>";
  });

  html += "</div>";

  host.innerHTML = html;
}

function renderMap() {
  // Always render from VOYAGE.waypoints (per-month structure).
  return renderRouteMap();
}

function renderTimeline() {
  return renderRouteTimeline();
}

// ============================================================
// BOOT
// ============================================================

function stripJsonComments(text) {
  return (
    text
      // Strip block comments first so inline parsing is simpler.
      .replace(/\/\*[\s\S]*?\*\//g, "")
      // Strip line comments that start a token line.
      .replace(/^\s*\/\/.*$/gm, "")
      // Allow JSONC-style trailing commas before object/array close.
      .replace(/,\s*([}\]])/g, "$1")
  );
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const text = await res.text();
  if (url.endsWith(".jsonc")) return JSON.parse(stripJsonComments(text));
  return JSON.parse(text);
}

// Pack waypoints into 30-day months by walking the route in order.
// Home trip: 14 days reserved at the end of every 3rd month (3, 6, 9, 12, …).
// Haul-out: 7 days at the end of every 12th month, immediately after that month's
// home trip when both fit; otherwise haul-out spills into the following month.
// Reserved days come out of the 30-day budget before sail+tour are packed.
// Side-effect: assigns `w.month = "mNN"` to every waypoint.
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

    const total = m.sail + m.tour + m.home + m.haul;
    const isLast = idx === months.length - 1;
    let cap = MONTH_CAP;
    if (total > MONTH_CAP) cap = total;
    else if (isLast) cap = total;

    for (const w of m.wps) w.month = id;

    return {
      id,
      label,
      dominantSegment,
      monthCapacityDays: cap,
      plannedSailDays: m.sail,
      plannedTourDays: m.tour,
      plannedHomeDays: m.home,
      plannedHaulDays: m.haul,
      plannedTotalDays: total,
    };
  });
}

const MONTH_LONG_NAMES = {
  Jan: "January", Feb: "February", Mar: "March", Apr: "April",
  May: "May", Jun: "June", Jul: "July", Aug: "August",
  Sep: "September", Oct: "October", Nov: "November", Dec: "December",
};

// Populate the header spec chips + cast-off date from the loaded voyage data
// so the displayed values stay in sync with the JSONC source.
function renderHeader() {
  const waypoints = VOYAGE.waypoints || [];
  const segments = VOYAGE.segments || [];
  const months = VOYAGE.months || [];
  const destinations = waypoints.length;
  const passages = segments.filter((s) => s.type === "crossing").length;
  const hauls = months.filter((m) => (m.plannedHaulDays || 0) > 0).length;
  const homes = months.filter((m) => (m.plannedHomeDays || 0) > 0).length;
  const totalNm = segments.reduce((s, x) => s + (x.nm || 0), 0);

  const set = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  set("chip-destinations", `${destinations} destinations · ${passages} ocean passages`);
  set("chip-events", `${hauls} haul-outs · ${homes} trips home`);
  set("chip-duration", `${months.length} months · ≈ ${totalNm.toLocaleString()} nm`);

  const startMonth = (VOYAGE.voyage && VOYAGE.voyage.startMonth) || "Jan";
  const startYear = (VOYAGE.voyage && VOYAGE.voyage.startYear) || new Date().getFullYear();
  set("cast-off-date", `${MONTH_LONG_NAMES[startMonth] || startMonth} ${startYear}`);
}

async function boot() {
  try {
    VOYAGE = await fetchJson("voyage.jsonc");
    VOYAGE.months = computeMonths(VOYAGE);
  } catch (err) {
    $("#loading").innerHTML = `
      <div style="color:#7a2f1d;font-family:'EB Garamond',serif;font-style:italic;font-size:14px;line-height:1.7;max-width:560px;margin:0 auto;text-align:left;padding:24px;background:rgba(160,74,48,0.08);border:1px solid rgba(160,74,48,0.3);border-radius:4px;">
        <strong style="display:block;margin-bottom:8px;">Failed to load voyage data</strong>
        ${err.message}<br><br>
        Serve this folder over HTTP — from this directory run:<br>
        <code style="display:block;margin-top:8px;padding:6px 8px;background:rgba(46,29,10,0.08);border-radius:2px;">python -m http.server 8000</code>
      </div>`;
    return;
  }

  $("#loading").remove();

  // Until the budget itinerary is locked in, hide the budget CTA
  document.body.classList.add("route-mode");

  renderHeader();
  renderMap();
  renderTimeline();
}

boot();

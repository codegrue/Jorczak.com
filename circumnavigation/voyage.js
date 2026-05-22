// Jorczak.com — Circumnavigation Voyage Page
// World-map route plot + month-by-month voyage timeline.
//
// Data sources (loaded in parallel at boot):
//   months.json — budget + month metadata (shared with budget.html)
//   voyage.jsonc — waypoints, year copy, map labels, cartouche text
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

let DATA = null; // months.json
let VOYAGE = null; // voyage.jsonc
const PASSAGE_MONTHS = new Set();
const HOME_MONTHS = new Set();
const HAUL_MONTHS = new Set();
const QUARANTINE_MONTHS = new Set();
const CELEBRATION_MONTHS = new Set();

function classifyMonths() {
  for (const m of DATA.months) {
    const b = m.badges || [];
    if (b.includes("passage")) PASSAGE_MONTHS.add(m.id);
    if (b.includes("home")) HOME_MONTHS.add(m.id);
    if (b.includes("haul")) HAUL_MONTHS.add(m.id);
    if (b.includes("quarantine")) QUARANTINE_MONTHS.add(m.id);
    if (b.includes("celebration")) CELEBRATION_MONTHS.add(m.id);
  }
}

// Distinct hue per month — slow rotation around the wheel so adjacent months differ
// but a year still feels like a color family. Shared by the route lines and the primary dots.
function monthColor(mi) {
  const hue = (mi * 10) % 360;
  return `hsl(${hue}, 55%, 38%)`;
}

function waypointStyle(monthId, mi) {
  const fill = monthColor(mi);
  // Size + ring indicate the type of month; fill color encodes the month identity.
  if (CELEBRATION_MONTHS.has(monthId)) return { fill, stroke: "#2e1d0a", r: 8, ring: true };
  if (HAUL_MONTHS.has(monthId)) return { fill, stroke: "#2e1d0a", r: 7 };
  if (PASSAGE_MONTHS.has(monthId)) return { fill, stroke: "#2e1d0a", r: 7 };
  if (HOME_MONTHS.has(monthId)) return { fill, stroke: "#2e1d0a", r: 5 };
  if (QUARANTINE_MONTHS.has(monthId)) return { fill, stroke: "#2e1d0a", r: 5 };
  return { fill, stroke: "#2e1d0a", r: 4 };
}

// Inline SVG icons sized to fit inside a primary dot of radius ~6–7.
function waypointIcon(monthId, p) {
  if (HAUL_MONTHS.has(monthId)) {
    // Anchor — vertical shaft, ring at top, crossbar, curved arms at bottom.
    return `<g transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})" pointer-events="none" class="wp-icon">
      <circle cx="0" cy="-3.2" r="0.9" fill="none" stroke-width="0.7"/>
      <line x1="0" y1="-2.3" x2="0" y2="3.2" stroke-width="0.8"/>
      <line x1="-2" y1="-1.2" x2="2" y2="-1.2" stroke-width="0.7"/>
      <path d="M -3 1.5 Q 0 4.2 3 1.5" fill="none" stroke-width="0.8" stroke-linecap="round"/>
    </g>`;
  }
  if (PASSAGE_MONTHS.has(monthId)) {
    // Two stylized waves stacked.
    return `<g transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})" pointer-events="none" class="wp-icon">
      <path d="M -3.5 -1.2 q 1.2 -1.6 2.4 0 t 2.4 0 t 2.4 0" fill="none" stroke-width="0.7" stroke-linecap="round"/>
      <path d="M -3.5 1.4  q 1.2 -1.6 2.4 0 t 2.4 0 t 2.4 0" fill="none" stroke-width="0.7" stroke-linecap="round"/>
    </g>`;
  }
  return "";
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

function segmentColor(si, total) {
  const hue = Math.round((si * 360) / total) % 360;
  return `hsl(${hue}, 55%, 38%)`;
}

// Attach wheel-zoom + drag-pan + double-click-reset to a rendered map SVG.
// Returns a reset function. Suppresses click events that came from a drag.
function attachZoomPan(svg) {
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
      const px = vb.x + mx * vb.w;
      const py = vb.y + my * vb.h;
      const factor = e.deltaY < 0 ? 0.8 : 1.25;
      const targetZoom = (initial.w / vb.w) * (factor < 1 ? 1.25 : 0.8);
      // Anchor zoom around cursor position so wheel interaction feels precise.
      setZoom(targetZoom, mx, my);
    },
    { passive: false },
  );

  svg.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    dragging = true;
    dragMoved = false;
    dragStart = { x: e.clientX, y: e.clientY, vbx: vb.x, vby: vb.y };
    svg.style.cursor = "default";
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const dxClient = e.clientX - dragStart.x;
    const dyClient = e.clientY - dragStart.y;
    if (Math.abs(dxClient) > 3 || Math.abs(dyClient) > 3) dragMoved = true;
    const rect = svg.getBoundingClientRect();
    vb.x = dragStart.vbx - (dxClient / rect.width) * vb.w;
    vb.y = dragStart.vby - (dyClient / rect.height) * vb.h;
    clamp();
    setViewBox();
  });

  window.addEventListener("mouseup", () => {
    if (dragging) {
      dragging = false;
      svg.style.cursor = "grab";
    }
  });

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
    true,
  );

  // Double-click on empty map area resets zoom
  svg.addEventListener("dblclick", (e) => {
    // Only reset if not on a clickable element
    const tag = e.target.tagName;
    if (tag === "path" || tag === "rect" || tag === "g" || tag === "svg") reset();
  });

  svg.style.cursor = "default";
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

function groupColor(gi, total) {
  const hue = Math.round((gi * 360) / Math.max(total, 1)) % 360;
  return `hsl(${hue}, 55%, 38%)`;
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

  let routePaths = "";
  let waypointDots = "";
  let startMarker = "";

  // Build polylines per group. Each group's line continues from the previous group's
  // last waypoint so the colored segments connect (no visible gaps at month boundaries).
  let prevLast = null;
  segments.forEach((seg, si) => {
    const color = groupColor(si, N);
    const ownPts = seg.waypoints.map((w) => project(w.lat, w.lng));
    const linePts = prevLast ? [prevLast, ...ownPts] : ownPts;
    const destCount = seg.waypoints.filter((w) => w.label).length;
    const nmText = seg.nm ? `${seg.nm.toLocaleString()} nm · ` : "";
    routePaths += `<path d="${buildPathDWithWrap(linePts)}" stroke="${color}" class="route-seg" data-seg-id="${seg.id}"><title>${seg.name} · ${nmText}${destCount} destinations</title></path>`;
    seg.waypoints.forEach((w, wi) => {
      if (!w.label) return;
      const p = ownPts[wi];
      const monthLabel = (monthById.get(w.month) && monthById.get(w.month).label) || w.month || "Unknown month";
      const courseLabel = (segmentById.get(w.segment) && segmentById.get(w.segment).name) || seg.name || "Unknown course";
      const titleLine1 = w.label;
      const titleLine2 = monthLabel;
      const titleLine3 = courseLabel;
      waypointDots += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="1.8" class="route-wp" data-seg-id="${seg.id}"><title>${titleLine1}&#10;${titleLine2}&#10;${titleLine3}</title></circle>`;
    });
    prevLast = ownPts[ownPts.length - 1];
  });

  // Annapolis start/end marker
  const start = segments[0].waypoints[0];
  const sp = project(start.lat, start.lng);
  startMarker = `
    <circle cx="${sp.x.toFixed(1)}" cy="${sp.y.toFixed(1)}" r="11" fill="none" stroke="#b8932e" stroke-width="1.2" opacity="0.7"/>
    <circle cx="${sp.x.toFixed(1)}" cy="${sp.y.toFixed(1)}" r="6" fill="#b8932e" stroke="#2e1d0a" stroke-width="1.4"/>
    <text x="${sp.x.toFixed(1)}" y="${(sp.y - 13).toFixed(1)}" class="wp-label" text-anchor="middle">⚓ Annapolis</text>
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

  // Cartouche — derive totals from current segments
  const totalNm = segments.reduce((s, x) => s + (x.nm || 0), 0);
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
      <g class="route-wps">${waypointDots}</g>
      <g class="start-marker">${startMarker}</g>
      ${cartouche}
    </svg>
  `;

  $("#world-map").innerHTML = svg;

  // Wire wheel-zoom + drag-pan + reset button
  const svgEl = $("#world-map svg");
  const reset = attachZoomPan(svgEl);

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

function renderRouteTimeline() {
  const host = $("#voyage-timeline");
  const groups = buildGroups(STATE.groupBy);
  const segs = groups.map((g) => ({ id: g.key, name: g.label, nm: g.nm, waypoints: g.waypoints }));
  const N = segs.length;

  const totalDest = segs.reduce((s, x) => s + x.waypoints.filter((w) => w.label).length, 0);
  const totalPivot = segs.reduce((s, x) => s + x.waypoints.filter((w) => !w.label).length, 0);
  const totalNm = segs.reduce((s, x) => s + (x.nm || 0), 0);
  let html =
    '<div class="route-mode-banner">' +
    '<div class="route-mode-title"><em>Route preview</em> · pre-segmentation</div>' +
    '<div class="route-mode-sub">' +
    totalDest +
    " destinations · " +
    totalNm.toLocaleString() +
    " nm across " +
    N +
    " route segments" +
    (totalPivot ? " (" + totalPivot + " course pivots curve the line around land — no dots there)" : "") +
    ". Month bucketing, haul-out port selection, and budget come next.</div>" +
    "</div>";

  segs.forEach((seg, si) => {
    const color = segmentColor(si, N);
    const destinations = seg.waypoints.filter((w) => w.label);
    const pivotCount = seg.waypoints.length - destinations.length;
    const wpItems = destinations.map((w) => `<span class="route-wp-chip" style="border-color:${color}">${w.label}</span>`).join("");
    const pivotNote = pivotCount > 0 ? ` · ${pivotCount} course pivot${pivotCount > 1 ? "s" : ""}` : "";
    html += `
      <div class="route-block" data-seg-id="${seg.id}">
        <div class="route-block-head" style="border-left-color:${color}">
          <div class="route-block-num">Segment ${String(si + 1).padStart(2, "0")}</div>
          <h3 class="route-block-title">${seg.name}</h3>
          <div class="route-block-meta">${seg.nm.toLocaleString()} nm · ${destinations.length} destination${destinations.length !== 1 ? "s" : ""}${pivotNote}</div>
        </div>
        <div class="route-block-wps">${wpItems}</div>
      </div>
    `;
  });

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
// MONTH MODE (preserved for re-use after segmentation)
// ============================================================

function renderMonthMap() {
  const waypoints = VOYAGE.waypoints;

  const projected = DATA.months.map((m) => {
    const w = waypoints[m.id];
    if (!w) return null;
    const p = project(w.lat, w.lng);
    return { m, p, label: w.label };
  });

  // Per-month route paths — each path visits prev-primary → this month's stops (JSON order) →
  // this month's primary, and gets a distinct stroke color so months are visually separable.
  function buildPathD(pts) {
    let d = "";
    for (let i = 0; i < pts.length; i++) {
      if (i === 0) {
        d = `M ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
        continue;
      }
      const dx = pts[i].x - pts[i - 1].x;
      if (Math.abs(dx) > 500) {
        // antimeridian wrap — exit one edge, re-enter the other
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

  // Primaries are dropped from the route polyline — they remain as labeled marker dots.
  // Each month's path = (previous month's last stop) → this month's stops in order.
  function lastStopPoint(monthIdx) {
    const w = waypoints[projected[monthIdx].m.id];
    if (w && w.stops && w.stops.length) {
      const last = w.stops[w.stops.length - 1];
      return project(last.lat, last.lng);
    }
    return projected[monthIdx].p; // fallback to primary if no stops
  }

  let routePaths = "";
  for (let mi = 0; mi < projected.length; mi++) {
    const item = projected[mi];
    if (!item) continue;
    const stops = (waypoints[item.m.id] && waypoints[item.m.id].stops) || [];
    if (stops.length === 0) continue;
    const pts = [];
    if (mi > 0 && projected[mi - 1]) pts.push(lastStopPoint(mi - 1));
    for (const s of stops) pts.push(project(s.lat, s.lng));
    if (pts.length < 2) continue;
    routePaths += `<path d="${buildPathD(pts)}" stroke="${monthColor(mi)}" class="route-path-month" data-month-id="${item.m.id}"/>`;
  }

  // Waypoint markers + labels
  let waypointMarkers = "";
  let waypointLabels = "";
  let stopMarkers = "";
  for (let mi = 0; mi < projected.length; mi++) {
    const item = projected[mi];
    if (!item) continue;
    const { m, p, label } = item;
    const style = waypointStyle(m.id, mi);
    const ringHtml = style.ring
      ? `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${style.r + 4}" fill="none" stroke="${style.fill}" stroke-width="1.2" opacity="0.55"/>`
      : "";
    waypointMarkers += `
      <g class="waypoint" data-month-id="${m.id}">
        ${ringHtml}
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${style.r}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="1"/>
        ${waypointIcon(m.id, p)}
        <title>${label || m.location}&#10;${m.calMonth}&#10;${m.region || "Course"}</title>
      </g>`;

    const lblOffsetY = m.year === 2 && p.y < 320 ? -10 : 13;
    waypointLabels += `<text x="${p.x.toFixed(1)}" y="${(p.y + lblOffsetY).toFixed(1)}" class="wp-label" text-anchor="middle">${m.num}</text>`;

    // Secondary stops (smaller dots, no labels; hover shows tooltip)
    const stops = waypoints[m.id] && waypoints[m.id].stops;
    if (stops) {
      for (const s of stops) {
        const sp = project(s.lat, s.lng);
        const cls = s.kind === "side-trip" ? "stop-dot stop-side-trip" : s.kind === "passage" ? "stop-dot stop-passage" : "stop-dot";
        stopMarkers += `<circle cx="${sp.x.toFixed(1)}" cy="${sp.y.toFixed(1)}" r="2.5" class="${cls}"><title>${m.num} stop · ${s.label}</title></circle>`;
      }
    }
  }

  // Continent silhouette paths (from continents.js)
  const continentsHtml = CONTINENTS.map((d) => `<path d="${d}" class="continent"/>`).join("");

  // Graticule (lat/long grid) — every 30°
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

  // Region labels — from voyage.jsonc
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

  // Decorative cartouche — text from voyage.jsonc
  const c = VOYAGE.cartouche || {};
  const cartouche = `
    <g transform="translate(820 415)" class="map-cartouche">
      <rect x="0" y="0" width="170" height="68" rx="2" fill="#f1e4be" stroke="#4a3217" stroke-width="0.8"/>
      <rect x="3" y="3" width="164" height="62" rx="1" fill="none" stroke="#b8932e" stroke-width="0.5"/>
      <text x="85" y="22" text-anchor="middle" class="cartouche-title">${c.title || ""}</text>
      <text x="85" y="36" text-anchor="middle" class="cartouche-sub">${c.sub1 || ""}</text>
      <text x="85" y="54" text-anchor="middle" class="cartouche-sub">${c.sub2 || ""}</text>
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
      <g class="stops">${stopMarkers}</g>
      <g class="waypoints">${waypointMarkers}</g>
      <g class="waypoint-labels">${waypointLabels}</g>
      ${cartouche}
    </svg>
  `;

  $("#world-map").innerHTML = svg;

  // Wire wheel-zoom + drag-pan + reset button
  const svgElM = $("#world-map svg");
  const resetM = attachZoomPan(svgElM);
  mountZoomControls($("#world-map"), resetM);

  // Wire waypoint clicks → scroll to that month's card in the timeline
  $$(".waypoint").forEach((g) => {
    g.addEventListener("click", () => {
      const id = g.dataset.monthId;
      const card = document.querySelector(`.voyage-card[data-month-id="${id}"]`);
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.classList.add("pulse");
        setTimeout(() => card.classList.remove("pulse"), 1500);
      }
    });
  });
}

// ============================================================
// TIMELINE RENDERING
// ============================================================

function badgeHtml(monthBadges) {
  const labels = {
    home: "✈ home trip",
    haul: "🏗 haul-out",
    passage: "🌊 ocean passage",
    quarantine: "🐕 dog quarantine",
    celebration: "🎉 circumnavigation complete",
  };
  return (monthBadges || []).map((b) => `<span class="badge badge-${b}">${labels[b] || b}</span>`).join("");
}

function renderMonthTimeline() {
  const host = $("#voyage-timeline");
  const years = VOYAGE.years || {};
  const waypoints = VOYAGE.waypoints || {};
  let html = "";

  for (const yr of [1, 2, 3]) {
    const meta = years[String(yr)] || { title: `Year ${yr}`, season: "", summary: "" };
    const months = DATA.months.filter((m) => m.year === yr);

    html += `
      <div class="year-block">
        <div class="year-block-head">
          <div class="year-block-mark">Year ${yr}</div>
          <h3 class="year-block-title">${meta.title}</h3>
          <div class="year-block-season">${meta.season}</div>
          <p class="year-block-summary">${meta.summary}</p>
        </div>
        <div class="voyage-grid">
    `;

    for (const m of months) {
      const badges = badgeHtml(m.badges);
      const badgeClasses = (m.badges || []).map((b) => `card-${b}`).join(" ");
      const wp = waypoints[m.id];
      const wpLabel = wp ? wp.label : "";
      const stops = wp && wp.stops;
      const stopsHtml =
        stops && stops.length
          ? `<div class="vc-stops"><strong>Stops</strong>${stops
              .map((s) => {
                const tag =
                  s.kind === "side-trip"
                    ? ' <em class="vc-stop-kind">(side trip)</em>'
                    : s.kind === "passage"
                      ? ' <em class="vc-stop-kind">(passage)</em>'
                      : "";
                return `<span class="vc-stop">${s.label}${tag}</span>`;
              })
              .join("")}</div>`
          : "";
      html += `
        <article class="voyage-card ${badgeClasses}" data-month-id="${m.id}">
          <div class="vc-head">
            <div class="vc-mark">${m.num} · ${m.calMonth} · YR${yr}</div>
            ${badges ? `<div class="vc-badges">${badges}</div>` : ""}
          </div>
          <div class="vc-loc">
            <span class="vc-flag">${m.flag}</span>${m.location}
          </div>
          <div class="vc-region">${m.region}</div>
          ${m.summary ? `<p class="vc-summary">${m.summary}</p>` : ""}
          ${stopsHtml}
          <div class="vc-foot">
            ${wpLabel ? `<span class="vc-waypoint">anchorage: <em>${wpLabel}</em></span>` : "<span></span>"}
            <a href="budget.html#${m.id}" class="vc-budget-link">view budget →</a>
          </div>
        </article>
      `;
    }

    html += `
        </div>
      </div>
    `;
  }

  host.innerHTML = html;
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

async function boot() {
  try {
    [DATA, VOYAGE] = await Promise.all([fetchJson("months.json"), fetchJson("voyage.jsonc")]);
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

  classifyMonths();
  renderMap();
  renderTimeline();
}

boot();

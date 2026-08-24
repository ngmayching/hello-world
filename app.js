"use strict";

/* ==========================================================================
   Triathlon Time Predictor
   - Log past races (swim / bike / run splits + optional transitions)
   - Predict a target-distance finish time using Riegel's endurance formula,
     projected per discipline and combined with recency weighting.
   ========================================================================== */

/* Distance presets. Swim in metres, bike & run in kilometres. */
const PRESETS = {
  sprint:  { label: "Sprint",        swim: 750,  bike: 20,  run: 5 },
  olympic: { label: "Olympic",       swim: 1500, bike: 40,  run: 10 },
  half:    { label: "Half / 70.3",   swim: 1900, bike: 90,  run: 21.1 },
  full:    { label: "Full / Ironman",swim: 3800, bike: 180, run: 42.2 },
};

/* Riegel fatigue exponents per discipline (>1 = slows with distance). */
const EXPONENT = { swim: 1.02, bike: 1.04, run: 1.06 };

/* Recency weighting: how much a race counts halves every HALF_LIFE days. */
const HALF_LIFE_DAYS = 365;

const STORE_KEY = "tri-predictor-races";

/* ---------------------------- Time helpers ------------------------------ */

/** Parse "h:mm:ss", "mm:ss", or plain seconds -> seconds. Blank -> 0. */
function parseTime(str) {
  if (str == null) return 0;
  const s = String(str).trim();
  if (s === "") return 0;
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s)); // bare number = seconds
  const parts = s.split(":").map((p) => p.trim());
  if (parts.some((p) => p === "" || isNaN(Number(p)))) return NaN;
  let secs = 0;
  for (const p of parts) secs = secs * 60 + Number(p);
  return Math.round(secs);
}

/** Seconds -> "h:mm:ss" (or "mm:ss" when under an hour). */
function formatTime(totalSeconds) {
  const t = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/* --------------------------- State / storage ---------------------------- */

let races = load();

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(races));
  } catch (e) {
    /* storage may be unavailable (private mode) — app still works in-session */
  }
}

/* ------------------------------ Elements -------------------------------- */

const $ = (id) => document.getElementById(id);

const form = $("race-form");
const presetSel = $("preset");
const customDist = $("custom-dist");
const targetPresetSel = $("target-preset");
const targetCustom = $("target-custom");

/* --------------------------- Distance reading --------------------------- */

function readDistances(presetValue, swimId, bikeId, runId) {
  if (presetValue !== "custom") {
    const p = PRESETS[presetValue];
    return { swim: p.swim, bike: p.bike, run: p.run };
  }
  return {
    swim: parseFloat($(swimId).value) || 0,
    bike: parseFloat($(bikeId).value) || 0,
    run: parseFloat($(runId).value) || 0,
  };
}

function distanceLabel(d) {
  // find matching preset for a nice label, else show custom
  for (const key in PRESETS) {
    const p = PRESETS[key];
    if (p.swim === d.swim && p.bike === d.bike && p.run === d.run) return p.label;
  }
  return `${(d.swim / 1000).toFixed(2)} / ${d.bike} / ${d.run} km`;
}

/* ----------------------------- Add a race ------------------------------- */

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const err = $("form-error");
  err.textContent = "";

  const dist = readDistances(presetSel.value, "d-swim", "d-bike", "d-run");
  if (dist.swim <= 0 || dist.bike <= 0 || dist.run <= 0) {
    err.textContent = "Please provide swim, bike and run distances.";
    return;
  }

  const swim = parseTime($("t-swim").value);
  const bike = parseTime($("t-bike").value);
  const run = parseTime($("t-run").value);
  const t1 = parseTime($("t-t1").value);
  const t2 = parseTime($("t-t2").value);

  if ([swim, bike, run, t1, t2].some((v) => isNaN(v))) {
    err.textContent = "Times must look like h:mm:ss or mm:ss.";
    return;
  }
  if (swim <= 0 || bike <= 0 || run <= 0) {
    err.textContent = "Enter swim, bike and run times (transitions are optional).";
    return;
  }

  races.push({
    id: Date.now() + "-" + Math.random().toString(36).slice(2, 7),
    name: $("race-name").value.trim() || "Untitled race",
    date: $("race-date").value || "",
    dist,
    swim, bike, run, t1, t2,
  });

  save();
  render();
  form.reset();
  presetSel.value = "olympic";
  customDist.hidden = true;
  $("race-name").focus();
});

/* -------------------------- Custom toggles ------------------------------ */

presetSel.addEventListener("change", () => {
  customDist.hidden = presetSel.value !== "custom";
});
targetPresetSel.addEventListener("change", () => {
  targetCustom.hidden = targetPresetSel.value !== "custom";
});

/* --------------------------- Delete a race ------------------------------ */

function deleteRace(id) {
  races = races.filter((r) => r.id !== id);
  save();
  render();
}

/* ----------------------------- Render table ----------------------------- */

function render() {
  const table = $("race-table");
  const tbody = table.querySelector("tbody");
  const empty = $("empty-msg");
  tbody.innerHTML = "";

  if (races.length === 0) {
    table.hidden = true;
    empty.hidden = false;
    return;
  }
  table.hidden = false;
  empty.hidden = true;

  for (const r of races) {
    const total = r.swim + r.bike + r.run + r.t1 + r.t2;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(r.name)}${r.date ? `<br><small>${r.date}</small>` : ""}</td>
      <td>${escapeHtml(distanceLabel(r.dist))}</td>
      <td>${formatTime(r.swim)}</td>
      <td>${formatTime(r.bike)}</td>
      <td>${formatTime(r.run)}</td>
      <td><strong>${formatTime(total)}</strong></td>
      <td><button class="btn link" data-del="${r.id}">Remove</button></td>`;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", () => deleteRace(b.getAttribute("data-del")))
  );
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/* ------------------------------ Predict --------------------------------- */

function recencyWeight(dateStr) {
  if (!dateStr) return 1; // no date -> neutral weight
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return 1;
  const days = (Date.now() - then) / 86400000;
  if (days <= 0) return 1;
  return Math.pow(0.5, days / HALF_LIFE_DAYS);
}

/** Project one discipline of one race to a target distance via Riegel. */
function project(timeSec, fromDist, toDist, exponent) {
  if (fromDist <= 0 || timeSec <= 0) return null;
  return timeSec * Math.pow(toDist / fromDist, exponent);
}

function predict(target) {
  if (races.length === 0) return null;

  const disciplines = ["swim", "bike", "run"];
  const distKey = { swim: "swim", bike: "bike", run: "run" };
  const out = {};
  let spreadFactorSum = 0, spreadWeight = 0;

  for (const d of disciplines) {
    let weighted = 0, wsum = 0;
    const projections = [];
    for (const r of races) {
      const from = r.dist[distKey[d]];
      const to = target[distKey[d]];
      const p = project(r[d], from, to, EXPONENT[d]);
      if (p == null) continue;
      const w = recencyWeight(r.date);
      weighted += p * w;
      wsum += w;
      projections.push(p);
    }
    out[d] = wsum > 0 ? weighted / wsum : 0;

    // spread across races (coefficient of variation) -> confidence range
    if (projections.length > 1) {
      const mean = projections.reduce((a, b) => a + b, 0) / projections.length;
      const varc = projections.reduce((a, b) => a + (b - mean) ** 2, 0) / projections.length;
      const cv = mean > 0 ? Math.sqrt(varc) / mean : 0;
      spreadFactorSum += cv * out[d];
      spreadWeight += out[d];
    }
  }

  // transitions: recency-weighted average of past values
  const trans = {};
  for (const d of ["t1", "t2"]) {
    let weighted = 0, wsum = 0;
    for (const r of races) {
      const w = recencyWeight(r.date);
      weighted += r[d] * w;
      wsum += w;
    }
    trans[d] = wsum > 0 ? weighted / wsum : 0;
  }

  const total = out.swim + out.bike + out.run + trans.t1 + trans.t2;

  // Confidence band: base uncertainty shrinks with more races, plus data spread.
  const baseUncertainty = 0.05 + 0.05 / Math.max(1, races.length); // 5–10%
  const spread = spreadWeight > 0 ? spreadFactorSum / spreadWeight : 0;
  const band = Math.min(0.2, baseUncertainty + spread);

  return {
    swim: out.swim, bike: out.bike, run: out.run,
    t1: trans.t1, t2: trans.t2, total,
    low: total * (1 - band), high: total * (1 + band),
    band,
  };
}

/* Pace string per discipline. */
function paceString(discipline, timeSec, dist) {
  if (timeSec <= 0 || dist <= 0) return "";
  if (discipline === "swim") {
    const per100 = timeSec / (dist / 100); // dist in metres
    return `${formatTime(per100)} /100m`;
  }
  const perKm = timeSec / dist; // dist in km
  if (discipline === "bike") {
    const kmh = dist / (timeSec / 3600);
    return `${kmh.toFixed(1)} km/h`;
  }
  return `${formatTime(perKm)} /km`;
}

$("predict-btn").addEventListener("click", () => {
  const result = $("result");
  if (races.length === 0) {
    result.hidden = false;
    result.innerHTML = `<p class="error">Add at least one past race first.</p>`;
    return;
  }

  const target = readDistances(targetPresetSel.value, "td-swim", "td-bike", "td-run");
  if (target.swim <= 0 || target.bike <= 0 || target.run <= 0) {
    result.hidden = false;
    result.innerHTML = `<p class="error">Please provide target swim, bike and run distances.</p>`;
    return;
  }

  const p = predict(target);
  const bandPct = Math.round(p.band * 100);

  result.hidden = false;
  result.innerHTML = `
    <div class="headline">
      <div class="label">Predicted finish — ${escapeHtml(distanceLabel(target))}</div>
      <div class="total">${formatTime(p.total)}</div>
      <div class="range">Likely range: ${formatTime(p.low)} – ${formatTime(p.high)} (±${bandPct}%)</div>
    </div>
    <table class="breakdown">
      <thead><tr><th>Discipline</th><th>Distance</th><th style="text-align:right">Time</th><th style="text-align:right">Pace</th></tr></thead>
      <tbody>
        <tr><td class="disc">🏊 Swim</td><td>${target.swim} m</td><td class="time">${formatTime(p.swim)}</td><td class="pace">${paceString("swim", p.swim, target.swim)}</td></tr>
        <tr><td class="disc">🔁 T1</td><td>—</td><td class="time">${formatTime(p.t1)}</td><td class="pace"></td></tr>
        <tr><td class="disc">🚴 Bike</td><td>${target.bike} km</td><td class="time">${formatTime(p.bike)}</td><td class="pace">${paceString("bike", p.bike, target.bike)}</td></tr>
        <tr><td class="disc">🔁 T2</td><td>—</td><td class="time">${formatTime(p.t2)}</td><td class="pace"></td></tr>
        <tr><td class="disc">🏃 Run</td><td>${target.run} km</td><td class="time">${formatTime(p.run)}</td><td class="pace">${paceString("run", p.run, target.run)}</td></tr>
        <tr class="total-row"><td>Total</td><td></td><td class="time">${formatTime(p.total)}</td><td></td></tr>
      </tbody>
    </table>
    <p class="note">Based on ${races.length} past race${races.length > 1 ? "s" : ""}, projected per discipline with Riegel's formula and recency weighting.</p>
  `;
  result.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

/* --------------------------- Sample data -------------------------------- */

$("load-sample").addEventListener("click", () => {
  const sample = [
    { name: "Local Sprint", date: isoDaysAgo(400), preset: "sprint",
      swim: "13:20", t1: "1:40", bike: "36:10", t2: "1:05", run: "24:30" },
    { name: "City Olympic", date: isoDaysAgo(200), preset: "olympic",
      swim: "28:05", t1: "2:10", bike: "1:12:40", t2: "1:20", run: "52:15" },
    { name: "Regional Olympic", date: isoDaysAgo(60), preset: "olympic",
      swim: "26:40", t1: "1:55", bike: "1:09:30", t2: "1:10", run: "49:50" },
  ];
  for (const s of sample) {
    const d = PRESETS[s.preset];
    races.push({
      id: Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      name: s.name, date: s.date,
      dist: { swim: d.swim, bike: d.bike, run: d.run },
      swim: parseTime(s.swim), bike: parseTime(s.bike), run: parseTime(s.run),
      t1: parseTime(s.t1), t2: parseTime(s.t2),
    });
  }
  save();
  render();
});

function isoDaysAgo(n) {
  const d = new Date(Date.now() - n * 86400000);
  return d.toISOString().slice(0, 10);
}

/* ------------------------------- Init ----------------------------------- */

render();

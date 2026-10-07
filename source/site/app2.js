/* ===== state ===== */
var S = {
  tech: FWA.clone(FWA.TECH), opts: FWA.OPTS,
  lb: { tech: 'tarana_cbrs', cls: 21, depth: 0, ht: 60 },
  cl: { dist: 5000, metric: 'both' },
  map: { site: 'all', tech: 'tarana_cbrs', metric: 'dl', cpe: 'h6', base: 'nlcd' },
  ec: { mode: 'model' }
};
var CLASS_DEPTH = { 11: 0, 21: 0, 22: 0, 23: 0, 24: 0, 31: 0, 41: 150, 42: 400, 43: 150, 52: 40, 71: 0, 81: 0, 82: 0, 90: 400, 95: 0 };
var CLASS_ORDER = [11, 95, 71, 81, 82, 31, 21, 22, 23, 24, 52, 41, 43, 90, 42];
function T(id) { return S.tech[id]; }
function techColor(id) { return sc(FWA.TECH[id].color); }

/* ===== tabs ===== */
function initTabs() {
  var tabs = $$('.tab');
  function show(id, push) { tabs.forEach(function (b) { b.setAttribute('aria-selected', b.dataset.tab === id ? 'true' : 'false'); }); $$('section.panel').forEach(function (p) { p.classList.toggle('active', p.id === 'tab-' + id); }); if (push) { try { history.replaceState(null, '', '#' + id); } catch (e) { } } window.scrollTo({ top: 0 }); document.dispatchEvent(new CustomEvent('tabshown', { detail: id })); }
  tabs.forEach(function (b) { b.addEventListener('click', function () { show(b.dataset.tab, true); }); });
  var start = (location.hash || '#verdict').slice(1); if (!$('#tab-' + start)) start = 'verdict'; show(start, false);
  window.addEventListener('hashchange', function () { var id = location.hash.slice(1); if ($('#tab-' + id)) show(id, false); });
}

/* ===== segmented control helper ===== */
function seg(container, items, value, onChange) {
  container.innerHTML = '';
  items.forEach(function (it) {
    var b = h('button', { type: 'button', 'aria-pressed': String(it.v === value) }, (it.color ? '<i class="swatch" style="background:' + it.color + '"></i>' : '') + it.l);
    if (it.title) b.title = it.title;
    b.addEventListener('click', function () { $$('button', container).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); b.setAttribute('aria-pressed', 'true'); onChange(it.v); });
    container.appendChild(b);
  });
}
function bindRange(id, outId, fmt, onInput) { var r = $('#' + id), o = $('#' + outId); function upd() { o.textContent = fmt(+r.value); } r.addEventListener('input', function () { upd(); onInput(+r.value); }); upd(); return { set: function (v) { r.value = v; upd(); } }; }

/* ===== static sections ===== */
function buildMatrix() {
  var t = $('#matrix'); var thead = '<thead><tr><th>Capability</th>' + MATRIX_COLS.map(function (c) { return '<th><span class="swatch" style="background:' + sc(c[1]) + '"></span>' + c[0] + '</th>'; }).join('') + '</tr></thead>';
  var body = MATRIX.map(function (r) { return '<tr>' + r.map(function (c, i) { return i ? '<td>' + c + '</td>' : '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('');
  t.innerHTML = thead + '<tbody>' + body + '</tbody>';
  var sw = $('#swCards'); SW.forEach(function (s) { sw.appendChild(h('div', { 'class': 'card' }, '<h3><span class="swatch" style="background:' + sc(s.color) + '"></span> ' + s.name + '</h3><h4>Strengths</h4><p>' + s.s + '</p><h4>Weaknesses</h4><p style="margin:0">' + s.w + '</p>')); });
}
function buildOthers() { var t = $('#othersTbl'); t.innerHTML = '<thead><tr><th>Platform</th><th>Bands</th><th>LOS / NLOS</th><th>Sector capacity</th><th>Typical range</th><th>AP / CPE price</th><th>Fit vs Tarana</th></tr></thead><tbody>' + OTHERS.map(function (r) { return '<tr>' + r.map(function (c, i) { return '<td' + (i === 0 ? ' style="font-weight:600"' : '') + '>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody>'; }
function buildYard() {
  var t = $('#yardTbl'); t.innerHTML = '<thead><tr>' + YARD_COLS.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>' + YARD.map(function (r) { return '<tr>' + r.map(function (c, i) { return '<td' + (i === 0 ? ' style="font-weight:600;color:var(--ink2)"' : '') + '>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody>';
  hbars($('#chartYard1'), { title: 'Median download and upload, Mbps', labelW: 200, rowH: 16, rows: [
    { label: 'T-Mobile Home Internet', sub: 'Ookla Q2 2026', segs: [{ v: 222.7, color: sc(1), name: 'Download' }, { v: 18.1, color: 'var(--line2)', name: 'Upload' }] },
    { label: 'AT&T Internet Air', sub: 'Ookla Q2 2026', segs: [{ v: 161.3, color: sc(1), name: 'Download' }, { v: 10.1, color: 'var(--line2)', name: 'Upload' }] },
    { label: 'Verizon 5G Home', sub: 'Ookla Q2 2026', segs: [{ v: 126.4, color: sc(1), name: 'Download' }, { v: 12.2, color: 'var(--line2)', name: 'Upload' }] },
    { label: 'Starlink Residential', sub: 'Ookla Q1 2026', segs: [{ v: 128, color: sc(0), name: 'Download' }, { v: 20, color: 'var(--line2)', name: 'Upload (≈)' }] },
    { label: 'Tarana CBRS link rate', sub: 'Preseem fleet median', segs: [{ v: 434, color: sc(2), name: 'Download link rate' }, { v: 0, color: 'var(--line2)', name: 'Upload', text: 'n/p' }] },
    { label: 'Tarana 6 GHz ×4 link rate', sub: 'Preseem fleet median', segs: [{ v: 774, color: sc(2), name: 'Download link rate' }, { v: 0, color: 'var(--line2)', name: 'Upload', text: 'n/p' }] }
  ], legend: [{ color: sc(1), name: 'MNO FWA download' }, { color: sc(0), name: 'Starlink download' }, { color: sc(2), name: 'Tarana achievable link rate' }, { color: 'var(--line2)', name: 'Upload' }] });
  hbars($('#chartYard2'), { title: 'Monthly list price, entry → top residential tier ($)', labelW: 200, rowH: 16, tickFmt: function (v) { return '$' + v; }, valFmt: function (v) { return '$' + v; }, rows: [
    { label: 'T-Mobile', segs: [{ v: 50, color: sc(1), name: 'Entry (Rely)' }, { v: 70, color: 'var(--line2)', name: 'Top (All-In)' }] },
    { label: 'Verizon', segs: [{ v: 60, color: sc(1), name: 'Entry (5G Home)' }, { v: 80, color: 'var(--line2)', name: 'Top (5G Home Plus)' }] },
    { label: 'AT&T Internet Air', segs: [{ v: 35, color: sc(1), name: 'Bundled' }, { v: 60, color: 'var(--line2)', name: 'Standalone' }] },
    { label: 'WISP rate cards', segs: [{ v: 30, color: sc(3), name: 'Lowest entry (Nextlink, Rise)' }, { v: 140, color: 'var(--line2)', name: 'Highest tier (Wisper)' }] },
    { label: 'Starlink', segs: [{ v: 55, color: sc(0), name: 'Residential 100 Mbps' }, { v: 130, color: 'var(--line2)', name: 'Residential Max' }] },
    { label: 'HTC fiber (Georgetown Co.)', segs: [{ v: 49.95, color: 'var(--ink2)', name: 'Entry' }, { v: 0, color: 'var(--line2)', name: 'Top', text: '' }] }
  ], legend: [{ color: sc(1), name: 'MNO entry' }, { color: sc(3), name: 'WISP entry' }, { color: sc(0), name: 'Starlink entry' }, { color: 'var(--line2)', name: 'Top tier' }] });
}
function buildMissing() { var m = $('#missingCards'); MISSING.forEach(function (x) { m.appendChild(h('div', { 'class': 'card' }, '<h3>' + x[0] + '</h3><p>' + x[1] + '</p>')); }); }
function buildGloss() { var g = $('#gloss'); GLOSS.forEach(function (x) { g.appendChild(h('div', {}, '<b>' + x[0] + '</b> — ' + x[1])); }); var s = $('#sources'); SOURCES.forEach(function (x, i) { var parts = x.split(' — '); s.appendChild(h('div', {}, '<span class="n">' + (i + 1) + '.</span> ' + parts[0] + ' — ' + parts[1].split(' ; ').map(function (u) { return '<a href="' + u.trim() + '" target="_blank" rel="noopener">' + u.trim() + '</a>'; }).join(' ; '))); }); }
function buildParams() {
  var rows = [['Frequency (MHz)', 'fMHz'], ['Carriers × MHz', function (t) { return t.carriers + ' × ' + t.bw; }], ['DL share (TDD)', 'dlFrac'], ['Base EIRP per carrier (dBm)', 'eirp'], ['CPE gain + combining (dBi)', function (t) { return t.cpeGain + ' + ' + t.cpeComb; }], ['CPE height (m) / type', function (t) { return t.cpeH + ' / ' + t.cpe; }], ['Building penetration', 'o2i'], ['CPE noise figure (dB)', 'nfCpe'], ['Max layers / peak SE', function (t) { return t.maxLayers + ' / ' + t.seMax; }], ['Per-link cap DL / UL (Mbps)', function (t) { return t.capDl + ' / ' + t.capUl; }], ['CPE uplink EIRP (dBm)', 'ulEirp'], ['Base Rx gain (dBi) / NF', function (t) { return t.bsGain + ' / ' + t.nfBs; }], ['Interference margin DL / UL (dB)', function (t) { return t.interf + ' / ' + t.interfUl; }]];
  var html = '<thead><tr><th>Parameter</th>' + FWA.ORDER.map(function (id) { return '<th>' + FWA.TECH[id].short + '</th>'; }).join('') + '</tr></thead><tbody>';
  rows.forEach(function (r) { html += '<tr><td>' + r[0] + '</td>' + FWA.ORDER.map(function (id) { var t = FWA.TECH[id]; return '<td class="num">' + (typeof r[1] === 'function' ? r[1](t) : t[r[1]]) + '</td>'; }).join('') + '</tr>'; });
  html += '<tr><td>Fade margin / min SINR / NLOS penalties (panel, gateway, array)</td><td colspan="6" class="num">' + FWA.OPTS.fade + ' dB / ' + FWA.OPTS.minSnr + ' dB / ' + FWA.OPTS.nlosPanel + ', ' + FWA.OPTS.nlosGateway + ', ' + FWA.OPTS.nlosArray + ' dB</td></tr></tbody>';
  $('#paramTbl').innerHTML = html;
}

/* ===== spectrum chart ===== */
function buildSpectrum() {
  var W = 940, ml = 200, pw = 420, nx = ml + pw + 24, H = 350, top = 30;
  var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, 'class': 'chart', role: 'img' });
  var f0 = Math.log10(0.5), f1 = Math.log10(80); var x = function (f) { return ml + (Math.log10(f) - f0) / (f1 - f0) * pw; };
  var g = el('g', {}, svg);
  [0.6, 1, 2, 3, 5, 10, 20, 40, 60].forEach(function (f, k) { el('line', { x1: x(f), x2: x(f), y1: top, y2: H - 44, stroke: 'var(--grid)' }, g); el('text', { x: x(f), y: H - 30 + (k % 2 ? 13 : 0), 'text-anchor': 'middle', 'font-size': 11, text: f < 1 ? f * 1000 + ' MHz' : f + ' GHz' }, g); });
  el('text', { x: ml + pw / 2, y: H - 2, 'text-anchor': 'middle', text: 'Frequency (log scale)' }, g);
  el('text', { x: nx, y: top - 10, 'font-size': 11, 'class': 'lbl', text: 'Bandwidth and power rule' }, g);
  el('text', { x: ml - 8, y: top - 10, 'font-size': 11, 'text-anchor': 'end', 'class': 'lbl', text: 'Band' }, g);
  var rows = [
    ['600 MHz (n71)', 0.617, 0.698, 1, '2×35 MHz; MNO fallback, slow', 'MNO low-band fallback for coverage'],
    ['2.5 GHz BRS/EBS (n41)', 2.496, 2.690, 5, 'T-Mobile 100–200 MHz', 'Licensed; 33 dBW per 5.5 MHz plus sector allowance'],
    ['3.45 GHz', 3.45, 3.55, 1, 'AT&T 40–70 MHz; 1,640 W/MHz', 'Licensed (Dish holdings sold to AT&T)'],
    ['CBRS 3.55–3.70 (n48)', 3.55, 3.70, 3, 'Shared; Cat B 47 dBm/10 MHz', 'Tarana BN-3 / G2 and WISP 5G NR both live here; PAL + GAA under a SAS'],
    ['C-band 3.7–3.98 (n77)', 3.70, 3.98, 1, 'Verizon 161, AT&T 120 MHz; 1,640 W/MHz', 'Licensed; the main MNO FWA band'],
    ['5 GHz UNII-1/3', 5.15, 5.85, 7, 'Unlicensed; 36 dBm EIRP, shared with Wi-Fi', 'Tarana BN-5, Cambium ePMP, Ubiquiti LTU'],
    ['6 GHz UNII-5/7', 5.925, 6.875, 6, 'Unlicensed; 36 dBm via AFC', 'Tarana BN-6 / G2 (4×40 MHz), ePMP 4600'],
    ['24 / 28 GHz (n261)', 24.25, 29.5, 4, '400–800 MHz carriers; 75 dBm/100 MHz', 'Licensed mmWave; Verizon 5G Home 2018'],
    ['39 GHz (n260)', 37, 40, 4, 'Same rules; rain and foliage limited', 'Licensed mmWave'],
    ['60 GHz V-band', 57, 71, 4, 'Unlicensed; line-of-sight mesh', 'cnWave, Ubiquiti Wave, MultiHaul TG']
  ];
  var rh = 26;
  rows.forEach(function (r, i) { var y = top + 6 + i * rh; var xa = x(r[1]), xb = Math.max(x(r[2]), xa + 5); var rect = el('rect', { x: xa, y: y, width: xb - xa, height: rh - 10, fill: sc(r[3]), rx: 2 }, g); bindTip(rect, function () { return '<b>' + r[0] + '</b><br>' + r[1] + '–' + r[2] + ' GHz<br>' + r[4] + '<br>' + r[5]; }); el('text', { x: ml - 8, y: y + rh / 2 - 1, 'text-anchor': 'end', 'class': 'lbl', text: r[0] }, g); el('text', { x: nx, y: y + rh / 2 - 1, 'font-size': 11.5, text: r[4] }, g); });
  var c = $('#chartSpectrum'); c.innerHTML = ''; c.appendChild(svg);
  c.appendChild(legend([{ color: sc(1), name: 'MNO macro FWA, licensed' }, { color: sc(5), name: 'MNO 2.5 GHz (T-Mobile)' }, { color: sc(3), name: 'CBRS, shared: Tarana and 5G NR' }, { color: sc(7), name: 'Unlicensed 5 GHz (Tarana BN-5, ePMP, LTU)' }, { color: sc(6), name: '6 GHz under AFC (Tarana, ePMP 4600)' }, { color: sc(4), name: 'mmWave and V-band' }]));
}

/* ===== architecture diagrams ===== */
function diagram(kind) {
  var W = 520, H = 230; var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, 'class': 'diag', role: 'img' });
  el('rect', { x: 0, y: 180, width: W, height: 50, 'class': 'ground' }, svg);
  function tower(x, hgt, label) { el('path', { d: 'M' + (x - 10) + ',180 L' + (x - 3) + ',' + (180 - hgt) + ' L' + (x + 3) + ',' + (180 - hgt) + ' L' + (x + 10) + ',180 Z', fill: 'none', stroke: 'var(--ink2)', 'stroke-width': 1.5 }, svg); for (var yy = 180 - hgt + 15; yy < 180; yy += 15) el('line', { x1: x - 8 + 5 * (180 - yy) / hgt, x2: x + 8 - 5 * (180 - yy) / hgt, y1: yy, y2: yy, stroke: 'var(--ink2)', 'stroke-width': .8 }, svg); el('text', { x: x + 14, y: 180 - hgt + 10, text: label }, svg); }
  function trees(x0, x1, hgt) { for (var x = x0; x < x1; x += 14) { var hh = hgt * (0.8 + 0.4 * Math.sin(x)); el('path', { d: 'M' + x + ',180 L' + (x + 6) + ',' + (180 - hh) + ' L' + (x + 12) + ',180 Z', 'class': 'tree' }, svg); } }
  function house(x, label) { el('path', { d: 'M' + x + ',180 L' + x + ',160 L' + (x + 14) + ',148 L' + (x + 28) + ',160 L' + (x + 28) + ',180 Z', 'class': 'house' }, svg); el('rect', { x: x + 8, y: 164, width: 8, height: 8, fill: 'var(--surface)', stroke: 'var(--ink2)', 'stroke-width': .8 }, svg); if (label) el('text', { x: x + 14, y: 198, 'text-anchor': 'middle', text: label }, svg); }
  function ray(d, color, dash) { var p = el('path', { d: d, 'class': 'ray', stroke: color }, svg); if (dash) p.setAttribute('stroke-dasharray', '4 3'); }
  function arr(x, y, n, color) { for (var i = 0; i < n; i++) el('rect', { x: x + i * 4, y: y, width: 3, height: 8, fill: color }, svg); }
  if (kind === 'mno') {
    tower(70, 110, '64T64R, ≈24 dBi, 79 dBm/100 MHz'); trees(200, 330, 34); house(360, 'indoor gateway 2 m, 0–5 dBi, behind glass'); house(440, '');
    ray('M70,72 Q230,90 372,166', sc(1)); ray('M70,72 Q260,96 450,166', sc(1));
    el('path', { d: 'M70,72 L372,166 L450,166 Z', fill: sc(1), opacity: .08 }, svg);
    el('text', { x: 230, y: 40, 'class': 't', text: 'Macro site beam → window' }, svg); el('text', { x: 230, y: 56, text: 'Uplink: 23–26 dBm from a plastic box; sold only where mobile capacity is fallow' }, svg);
  } else if (kind === 'cbrs') {
    tower(70, 100, 'Cat B gNB, 47 dBm/10 MHz, 14–17 dBi'); trees(190, 330, 34); house(370, 'outdoor 17 dBi panel at 6 m, pro-install');
    el('rect', { x: 384, y: 136, width: 6, height: 10, fill: sc(3) }, svg); el('line', { x1: 387, x2: 387, y1: 146, y2: 160, stroke: 'var(--ink2)' }, svg);
    ray('M70,82 L386,140', sc(3)); ray('M70,82 Q240,110 300,146', sc(3), true);
    el('text', { x: 200, y: 40, 'class': 't', text: 'Leased tower, shared GAA channel, SAS-coordinated' }, svg); el('text', { x: 200, y: 56, text: 'Boresight link; multipath (dashed) is largely lost by a fixed panel' }, svg);
  } else if (kind === 'mmw') {
    el('line', { x1: 60, x2: 60, y1: 180, y2: 120, stroke: 'var(--ink2)', 'stroke-width': 3 }, svg); el('rect', { x: 54, y: 112, width: 12, height: 12, fill: sc(4) }, svg); el('text', { x: 72, y: 118, text: '28 GHz node, 8–10 m pole' }, svg);
    house(150, 'clear path: 300–800 m'); trees(230, 300, 36); house(330, 'one tree: −10 to −30 dB');
    ray('M66,118 L162,166', sc(4)); ray('M66,118 L343,164', sc(4), true); el('text', { x: 262, y: 150, 'class': 't', fill: 'var(--critical)', text: '✕' }, svg);
    el('text', { x: 200, y: 40, 'class': 't', text: 'Line of sight or nothing' }, svg); el('text', { x: 200, y: 56, text: 'FSPL 111 dB at 300 m; low-E glass 28 dB; rain 4.6 dB/km at 25 mm/h' }, svg);
  } else {
    tower(70, 100, 'BN: 16 chains, 48.5 dBm CBRS / 36 dBm 6 GHz'); arr(44, 70, 6, sc(2)); trees(190, 320, 34); house(360, 'RN: 8 chains, 14.5 dBi each, 6–10 m');
    arr(368, 128, 4, sc(2)); el('line', { x1: 375, x2: 375, y1: 136, y2: 160, stroke: 'var(--ink2)' }, svg);
    ray('M70,82 L372,132', sc(2)); ray('M70,82 Q200,20 372,132', sc(2)); ray('M70,82 Q260,120 372,132', sc(2)); ray('M70,82 Q150,150 250,150 T372,132', sc(2));
    el('text', { x: 200, y: 40, 'class': 't', text: 'Distributed massive MIMO: every path is a signal path' }, svg); el('text', { x: 200, y: 56, text: 'Weights recomputed ~5,000×/s; nulls own sectors (k=1 reuse) and bursty outsiders' }, svg);
  }
  return svg;
}
function buildDiagrams() { $('#diagMno').appendChild(diagram('mno')); $('#diagCbrs').appendChild(diagram('cbrs')); $('#diagMmw').appendChild(diagram('mmw')); $('#diagTarana').appendChild(diagram('tarana')); }

/* ===== link budget table (Fig 2) ===== */
function buildWaterfall() {
  var ids = FWA.ORDER, cols = ids.map(function (id) { var t = T(id); var env = FWA.analyticEnv(t, 5000, 42, 400, 60); if (t.layerF < 0) env.los = false;
    var fs = FWA.fspl(5000, t.fMHz) + (t.layerF < 0 ? (t.gas || 0) * 5 + (t.rain || 0) : 0);
    var fol = (t.layerF < 0 && !env.los) ? FWA.foliageLoss(400, t.fMHz, 42, S.opts) : FWA.foliageLoss(400, t.fMHz, 42, S.opts);
    var bld = FWA.bldgLoss(42, t.fMHz, t.cpeH, S.opts), o2 = FWA.o2iLoss(t.o2i, t.fMHz), r = FWA.evalLink(t, env, S.opts), mar = S.opts.fade + t.interf;
    var rx = t.eirp + t.cpeGain + t.cpeComb - fs - fol - bld - o2 - r.pen - mar, n = FWA.noiseDbm(t.bw, t.nfCpe);
    return { t: t, fs: fs, fol: fol, bld: bld, o2: o2, pen: r.pen, mar: mar, rx: rx, n: n, r: r }; });
  function row(label, fn, cls) { return '<tr><td' + (cls ? ' style="font-weight:600"' : '') + '>' + label + '</td>' + cols.map(function (c) { return '<td class="num"' + (cls ? ' style="font-weight:600"' : '') + '>' + fn(c) + '</td>'; }).join('') + '</tr>'; }
  var f1 = function (v) { return (v > 0 ? '+' : '') + v.toFixed(1); };
  var html = '<thead><tr><th>Downlink, 5 km, inside pine canopy</th>' + cols.map(function (c) { return '<th class="num"><span class="swatch" style="background:' + techColor(c.t.id) + '"></span> ' + c.t.short + '</th>'; }).join('') + '</tr></thead><tbody>';
  html += row('Tower radiates (EIRP, dBm, per carrier)', function (c) { return c.t.eirp.toFixed(1); });
  html += row('Customer antenna gain incl. combining (dBi)', function (c) { return '+' + (c.t.cpeGain + c.t.cpeComb).toFixed(1); });
  html += row('Free-space loss' + ' (dB)', function (c) { return '−' + c.fs.toFixed(1); });
  html += row('Foliage, 400 m of pine (dB)', function (c) { return '−' + c.fol.toFixed(1); });
  html += row('Window / wall penetration (dB)', function (c) { return c.o2 ? '−' + c.o2.toFixed(1) : '0'; });
  html += row('Fixed-antenna loss in NLOS (dB)', function (c) { return c.pen ? '−' + c.pen.toFixed(1) : '0'; });
  html += row('Fade + interference margin (dB)', function (c) { return '−' + c.mar.toFixed(1); });
  html += row('= Signal at receiver (dBm)', function (c) { return c.rx.toFixed(1); }, true);
  html += row('Receiver noise floor (dBm, ' + 'channel width × noise figure)', function (c) { return c.n.toFixed(1) + '<br><span class="muted">' + c.t.bw + ' MHz, NF ' + c.t.nfCpe + '</span>'; });
  html += row('Downlink SINR (dB)', function (c) { return f1(c.rx - c.n); }, true);
  html += row('Downlink rate (Mbps, all carriers)', function (c) { return c.r.dl >= 1 ? fmtN(c.r.dl) : 'no link'; }, true);
  html += row('Uplink SINR (dB, best sub-band)', function (c) { return f1(c.r.snrUl); });
  html += row('Uplink rate (Mbps)', function (c) { return c.r.ul >= 1 ? fmtN(c.r.ul) : 'no link'; }, true);
  $('#budgetTbl').innerHTML = html + '</tbody>';
  // SINR dot chart
  var W = 760, lw = 130, pw = W - lw - 40, xmin = -40, xmax = 50, rh = 26, H = ids.length * rh + 70;
  var x = function (v) { return lw + (Math.max(xmin, Math.min(xmax, v)) - xmin) / (xmax - xmin) * pw; };
  var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, 'class': 'chart', role: 'img' });
  el('text', { x: 0, y: 14, 'class': 'ttl', text: 'Resulting SINR at 5 km in pine forest: ● downlink, ○ uplink' }, svg);
  var g = el('g', { transform: 'translate(0,26)' }, svg);
  niceTicks(xmin, xmax, 9).forEach(function (t) { el('line', { x1: x(t), x2: x(t), y1: 0, y2: ids.length * rh, stroke: 'var(--grid)' }, g); el('text', { x: x(t), y: ids.length * rh + 16, 'text-anchor': 'middle', text: t }, g); });
  [[-5, 'min MCS'], [10, '16QAM'], [22, '256QAM']].forEach(function (gd) { el('line', { x1: x(gd[0]), x2: x(gd[0]), y1: -4, y2: ids.length * rh, stroke: 'var(--ink2)' }, g); el('text', { x: x(gd[0]) + 4, y: -6, 'font-size': 11, text: gd[1] }, g); });
  cols.forEach(function (c, i) { var y = i * rh + rh / 2; el('text', { x: lw - 8, y: y + 4, 'text-anchor': 'end', 'class': 'lbl', text: c.t.short }, g); var dl = c.rx - c.n, ul = c.r.snrUl; el('line', { x1: x(Math.min(dl, ul)), x2: x(Math.max(dl, ul)), y1: y, y2: y, stroke: techColor(c.t.id), 'stroke-width': 2 }, g); if (dl >= xmin) el('circle', { cx: x(dl), cy: y, r: 6, fill: techColor(c.t.id), stroke: 'var(--surface)', 'stroke-width': 2 }, g); if (ul >= xmin) el('circle', { cx: x(ul), cy: y, r: 6, fill: 'var(--surface)', stroke: techColor(c.t.id), 'stroke-width': 2.5 }, g); if (dl < xmin || ul < xmin) el('text', { x: x(xmin) + 10, y: y + 4, 'font-size': 11, text: '◀ DL ' + dl.toFixed(0) + ' / UL ' + ul.toFixed(0) + ' dB, off scale' }, g); });
  el('text', { x: lw + pw / 2, y: ids.length * rh + 34, 'text-anchor': 'middle', text: 'SINR, dB (values below −40 are clipped)' }, g);
  var c = $('#chartSnr'); c.innerHTML = ''; c.appendChild(svg);
}

/* ===== link budget tab ===== */
var LBC = {};
function initLinkBudget() {
  var sel = $('#lbTech'); FWA.ORDER.forEach(function (id) { sel.appendChild(h('option', { value: id }, FWA.TECH[id].name)); }); sel.value = S.lb.tech;
  var cs = $('#lbCls'); CLASS_ORDER.forEach(function (c) { cs.appendChild(h('option', { value: c }, FWA.NLCD[c].n)); }); cs.value = S.lb.cls;
  sel.addEventListener('change', function () { S.lb.tech = sel.value; syncLb(); renderLb(); });
  cs.addEventListener('change', function () { S.lb.cls = +cs.value; $('#lbDepth').value = CLASS_DEPTH[S.lb.cls]; S.lb.depth = CLASS_DEPTH[S.lb.cls]; LBC.depth.set(S.lb.depth); renderLb(); });
  LBC.depth = bindRange('lbDepth', 'lbDepthO', function (v) { return v + ' m'; }, function (v) { S.lb.depth = v; renderLb(); });
  LBC.ht = bindRange('lbHt', 'lbHtO', function (v) { return v + ' m'; }, function (v) { S.lb.ht = v; renderLb(); });
  LBC.eirp = bindRange('lbEirp', 'lbEirpO', function (v) { return v.toFixed(1) + ' dBm'; }, function (v) { T(S.lb.tech).eirp = v; renderLb(); invalidateMap(); });
  LBC.bw = bindRange('lbBw', 'lbBwO', function (v) { return v + ' MHz'; }, function (v) { T(S.lb.tech).bw = v; renderLb(); invalidateMap(); });
  LBC.cpeG = bindRange('lbCpeG', 'lbCpeGO', function (v) { return v.toFixed(1) + ' dBi'; }, function (v) { var t = T(S.lb.tech); t.cpeGain = v - t.cpeComb; renderLb(); invalidateMap(); });
  LBC.ul = bindRange('lbUl', 'lbUlO', function (v) { return v.toFixed(1) + ' dBm'; }, function (v) { T(S.lb.tech).ulEirp = v; renderLb(); invalidateMap(); });
  LBC.bsG = bindRange('lbBsG', 'lbBsGO', function (v) { return v.toFixed(1) + ' dBi'; }, function (v) { T(S.lb.tech).bsGain = v; renderLb(); invalidateMap(); });
  LBC.fade = bindRange('lbFade', 'lbFadeO', function (v) { return v + ' dB'; }, function (v) { S.opts.fade = v; $('#mpFade').value = v; $('#mpFadeO').textContent = v + ' dB'; renderLb(); invalidateMap(); });
  LBC.int = bindRange('lbInt', 'lbIntO', function (v) { return v.toFixed(1) + ' dB'; }, function (v) { var t = T(S.lb.tech); t.interf = v; t.interfUl = v; renderLb(); invalidateMap(); });
  LBC.nlos = bindRange('lbNlos', 'lbNlosO', function (v) { return v.toFixed(1) + ' dB'; }, function (v) { S.opts.nlosPanel = v; renderLb(); invalidateMap(); });
  $('#lbO2i').addEventListener('change', function () { T(S.lb.tech).o2i = $('#lbO2i').value; renderLb(); invalidateMap(); });
  $('#lbReset').addEventListener('click', function () { S.tech[S.lb.tech] = FWA.clone(FWA.TECH[S.lb.tech]); syncLb(); renderLb(); invalidateMap(); });
  syncLb(); renderLb();
}
function syncLb() {
  var t = T(S.lb.tech); LBC.eirp.set(t.eirp); LBC.bw.set(t.bw); LBC.cpeG.set(t.cpeGain + t.cpeComb); LBC.ul.set(t.ulEirp); LBC.bsG.set(t.bsGain); LBC.fade.set(S.opts.fade); LBC.int.set(t.interf); LBC.nlos.set(S.opts.nlosPanel); $('#lbO2i').value = t.o2i;
  seg($('#lbCpeH'), [{ v: 2, l: '2 m (indoor)' }, { v: 6, l: '6 m (eave)' }, { v: 10, l: '10 m (pole)' }], t.cpeH, function (v) { T(S.lb.tech).cpeH = v; renderLb(); invalidateMap(); });
  LBC.depth.set(S.lb.depth); LBC.ht.set(S.lb.ht);
}
function rateCurve(t, cls, depth, ht) { var dl = [], ul = [], sd = [], su = []; for (var d = 250; d <= 25000; d += 250) { var r = FWA.evalLink(t, FWA.analyticEnv(t, d, cls, depth, ht), S.opts); dl.push([d / 1000, r.dl]); ul.push([d / 1000, r.ul]); sd.push([d / 1000, Math.max(-20, r.snrDl)]); su.push([d / 1000, Math.max(-20, r.snrUl)]); } return { dl: dl, ul: ul, sd: sd, su: su }; }
function renderLb() {
  var t = T(S.lb.tech), c = rateCurve(t, S.lb.cls, S.lb.depth, S.lb.ht);
  lines($('#chartLb'), { title: t.name + ' · ' + FWA.NLCD[S.lb.cls].n + ' · ' + S.lb.depth + ' m foliage · Tx ' + S.lb.ht + ' m', xmax: 25, xlabel: 'Distance from tower (km)', ylabel: 'Mbps', guides: [{ y: 100, label: '100 down' }, { y: 25, label: '25 down' }], series: [{ name: 'Downlink', color: techColor(S.lb.tech), pts: c.dl }, { name: 'Uplink', color: techColor(S.lb.tech), pts: c.ul, dash: true }], legend: [{ color: techColor(S.lb.tech), name: 'Downlink (solid) / uplink (dashed)' }], xfmt: function (v) { return v.toFixed(1) + ' km'; }, yfmt: function (v) { return fmtN(v) + ' Mbps'; } });
  lines($('#chartLbSnr'), { title: 'SINR versus distance', xmax: 25, ymin: -20, ymax: 50, xlabel: 'Distance from tower (km)', ylabel: 'dB', guides: [{ y: 22, label: '256QAM' }, { y: 10, label: '16QAM' }, { y: -5, label: 'min MCS' }], series: [{ name: 'Downlink SINR', color: techColor(S.lb.tech), pts: c.sd }, { name: 'Uplink SINR', color: techColor(S.lb.tech), pts: c.su, dash: true }], xfmt: function (v) { return v.toFixed(1) + ' km'; }, yfmt: function (v) { return v.toFixed(1) + ' dB'; } });
  // range table
  var envs = [[95, 'Open (marsh, field, water)'], [21, 'Developed, open space'], [22, 'Developed, low intensity'], [52, 'Shrub / scrub'], [41, 'Deciduous forest'], [90, 'Swamp forest'], [42, 'Pine forest']];
  var html = '<thead><tr><th>Environment at the customer</th>' + FWA.ORDER.map(function (id) { return '<th class="num"><span class="swatch" style="background:' + techColor(id) + '"></span> ' + FWA.TECH[id].short + '</th>'; }).join('') + '</tr></thead><tbody>';
  envs.forEach(function (e) { html += '<tr><td>' + e[1] + '</td>' + FWA.ORDER.map(function (id) { var tt = T(id); var best = 0; for (var d = 250; d <= 30000; d += 250) { var r = FWA.evalLink(tt, FWA.analyticEnv(tt, d, e[0], CLASS_DEPTH[e[0]], S.lb.ht), S.opts); if (r.dl >= 100 && r.ul >= 20) best = d; } return '<td class="num">' + (best >= 30000 ? '30+ km' : best ? (best / 1000).toFixed(2) + ' km' : '—') + '</td>'; }).join('') + '</tr>'; });
  $('#rangeTbl').innerHTML = html + '</tbody>';
}

/* ===== clutter tab ===== */
function initClutter() {
  seg($('#clDist'), [{ v: 2000, l: '2 km' }, { v: 5000, l: '5 km' }, { v: 10000, l: '10 km' }, { v: 15000, l: '15 km' }], S.cl.dist, function (v) { S.cl.dist = v; renderClutter(); });
  seg($('#clSeason'), [{ v: 'leafon', l: 'Leaf-on' }, { v: 'leafoff', l: 'Leaf-off' }], S.opts.season, function (v) { S.opts.season = v; renderClutter(); invalidateMap(); syncSeasonUI(); });
  seg($('#clMetric'), [{ v: 'both', l: 'Downlink, dimmed if the uplink fails 20 Mbps' }, { v: 'dl', l: 'Downlink only' }, { v: 'ul', l: 'Uplink only' }], S.cl.metric, function (v) { S.cl.metric = v; renderClutter(); });
  bindRange('clScale', 'clScaleO', function (v) { return Math.round(v * 100) + '%'; }, function (v) { S.opts.clutterScale = v; $('#mpScale').value = v; $('#mpScaleO').textContent = Math.round(v * 100) + '%'; renderClutter(); invalidateMap(); });
  renderClutter(); buildClutterTable();
}
function syncSeasonUI() { $$('#clSeason button, #mpSeason button').forEach(function (b) { b.setAttribute('aria-pressed', String((b.textContent.indexOf('Leaf-on') >= 0 ? 'leafon' : 'leafoff') === S.opts.season)); }); }
function renderClutter() {
  var m = S.cl.metric;
  var rows = CLASS_ORDER.map(function (c) { return { label: FWA.NLCD[c].n.replace(' (swamp forest)', '').replace('Emergent herbaceous wetlands (marsh)', 'Marsh'), sub: CLASS_DEPTH[c] ? CLASS_DEPTH[c] + ' m foliage' : '', segs: FWA.ORDER.map(function (id) { var t = T(id); var r = FWA.evalLink(t, FWA.analyticEnv(t, S.cl.dist, c, CLASS_DEPTH[c], 60), S.opts); var v = m === 'ul' ? r.ul : r.dl; var pass = r.dl >= 100 && r.ul >= 20; var col = techColor(id); if (m === 'both' && !pass) col = 'color-mix(in srgb, ' + col + ' 30%, transparent)'; var txt = m === 'both' ? (v >= 1 ? 'DL ' + fmtN(r.dl) + ' · UL ' + fmtN(r.ul) + (pass ? '' : ' · fails 100/20') : 'no link') : (v >= 1 ? fmtN(v) : '—'); return { v: v, color: col, name: t.short, text: txt }; }) }; });
  var title = (m === 'ul' ? 'Uplink Mbps' : 'Downlink Mbps') + ' at ' + (S.cl.dist / 1000) + ' km, tower antenna 60 m, ' + (S.opts.season === 'leafon' ? 'leaf-on' : 'leaf-off') + (m === 'both' ? ' · solid bar = passes 100/20, faint bar = fails the uplink or downlink test' : '');
  hbars($('#chartClutter'), { title: title, labelW: 190, rowH: 13, gap: 0, rows: rows, max: m === 'ul' ? 420 : 1700, legend: FWA.ORDER.map(function (id) { return { color: techColor(id), name: FWA.TECH[id].short }; }), xlabel: 'Mbps' });
}
function buildClutterTable() {
  var bands = [2600, 3600, 6400, 28000];
  var html = '<thead><tr><th>NLCD class</th><th class="num">Obstacle ht</th><th class="num">Typical foliage depth</th>' + bands.map(function (b) { return '<th class="num">' + (b / 1000).toFixed(1) + ' GHz</th>'; }).join('') + '</tr></thead><tbody>';
  CLASS_ORDER.forEach(function (c) { var n = FWA.NLCD[c]; html += '<tr><td>' + n.n + '</td><td class="num">' + n.R + ' m</td><td class="num">' + CLASS_DEPTH[c] + ' m</td>' + bands.map(function (b) { var v = FWA.foliageLoss(CLASS_DEPTH[c], b, c, { season: 'leafon', clutterScale: 1 }) + FWA.bldgLoss(c, b, 6, { clutterScale: 1 }); return '<td class="num">' + (v < 0.05 ? '0' : v.toFixed(1)) + '</td>'; }).join('') + '</tr>'; });
  html += '<tr><td colspan="3">Indoor gateway adds (window / interior low-loss / low-E)</td>' + bands.map(function (b) { return '<td class="num">' + FWA.o2iLoss('window', b).toFixed(1) + ' / ' + FWA.o2iLoss('low', b).toFixed(1) + ' / ' + FWA.o2iLoss('windowLowE', b).toFixed(1) + '</td>'; }).join('') + '</tr>';
  $('#clutterTbl').innerHTML = html + '</tbody>';
}

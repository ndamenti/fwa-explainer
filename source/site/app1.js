/* ===== utilities, static content ===== */
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); } if (parent) parent.appendChild(e); return e; }
function h(tag, attrs, html) { var e = document.createElement(tag); for (var k in (attrs || {})) { if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]); } if (html != null) e.innerHTML = html; return e; }
function fmtN(v, d) { if (v == null || !isFinite(v)) return '—'; return Number(v).toLocaleString('en-US', { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: d == null ? 0 : d }); }
function fmtK(v) { return v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k' : fmtN(v); }
function fmtMoney(v, d) { return '$' + fmtN(v, d); }
function tag(t) { return '<span class="tag ' + t + '">' + t.toUpperCase() + '</span>'; }
var SERIES = ['var(--ink2)', 'var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)'];
function sc(i) { return SERIES[i]; }
var TIP = null;
function tipShow(ev, html) { TIP = TIP || $('#tip'); TIP.innerHTML = html; TIP.style.display = 'block'; tipMove(ev); }
function tipMove(ev) { if (!TIP) return; var x = ev.clientX + 14, y = ev.clientY + 14; if (x + 290 > innerWidth) x = ev.clientX - 290; if (y + 120 > innerHeight) y = ev.clientY - 100; TIP.style.left = x + 'px'; TIP.style.top = y + 'px'; }
function tipHide() { if (TIP) TIP.style.display = 'none'; }

/* ---- generic SVG charts (hand-rolled; one scale, thin marks, hairline grid) ---- */
// Horizontal grouped/stacked bars. rows: [{label, segs:[{v, color, name}], note}] ; stacked=true draws segs end to end
function hbars(container, cfg) {
  var rows = cfg.rows, W = cfg.width || 760, lw = cfg.labelW || 150, rowH = cfg.rowH || (cfg.stacked ? 26 : 18), gap = cfg.gap || 8, groupGap = 14;
  var nseg = cfg.stacked ? 1 : Math.max.apply(null, rows.map(function (r) { return r.segs.length; }));
  var ph = rows.length * (nseg * rowH + groupGap) + 40, pw = W - lw - 90;
  var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + (ph + 30 + (cfg.xlabel ? 8 : 0)), 'class': 'chart', role: 'img' });
  if (cfg.title) el('text', { x: 0, y: 14, 'class': 'ttl', text: cfg.title }, svg);
  var max = cfg.max || Math.max.apply(null, rows.map(function (r) { return cfg.stacked ? r.segs.reduce(function (a, s) { return a + s.v; }, 0) : Math.max.apply(null, r.segs.map(function (s) { return s.v; })); })) || 1;
  var x = function (v) { return lw + v / max * pw; };
  var g = el('g', { transform: 'translate(0,28)' }, svg);
  var grid = el('g', { 'class': 'grid' }, g);
  var ticks = niceTicks(0, max, 5);
  ticks.forEach(function (t) { el('line', { x1: x(t), x2: x(t), y1: 0, y2: ph - 50 }, grid); el('text', { x: x(t), y: ph - 36, 'text-anchor': 'middle', text: (cfg.tickFmt || fmtN)(t) }, g); });
  if (cfg.guides) cfg.guides.forEach(function (gd) { el('line', { x1: x(gd.v), x2: x(gd.v), y1: 0, y2: ph - 50, stroke: 'var(--ink2)', 'stroke-width': 1 }, g); el('text', { x: x(gd.v) + 3, y: 10, text: gd.label, 'font-size': 11 }, g); });
  var y = 0;
  rows.forEach(function (r) {
    el('text', { x: lw - 8, y: y + (nseg * rowH) / 2 + 4, 'text-anchor': 'end', 'class': 'lbl', text: r.label }, g);
    if (r.sub) el('text', { x: lw - 8, y: y + (nseg * rowH) / 2 + 17, 'text-anchor': 'end', 'font-size': 11, text: r.sub }, g);
    if (cfg.stacked) {
      var acc = 0;
      r.segs.forEach(function (s, i) { var x0 = x(acc), x1 = x(acc + s.v); acc += s.v; if (x1 - x0 < 0.5) return; var rect = el('rect', { x: x0 + (i ? 1 : 0), y: y + 3, width: Math.max(0.5, x1 - x0 - (i ? 1 : 0)), height: rowH - 6, fill: s.color, rx: 0 }, g); bindTip(rect, function () { return '<b>' + r.label + '</b><br>' + s.name + ': ' + (cfg.valFmt || fmtN)(s.v); }); });
      if (r.note) el('text', { x: x(acc) + 6, y: y + rowH / 2 + 4, text: r.note, 'font-size': 11.5 }, g);
    } else {
      r.segs.forEach(function (s, i) { var yy = y + i * rowH; var w = Math.max(0, x(Math.min(s.v, max)) - lw); var rect = el('rect', { x: lw, y: yy + 2, width: w, height: rowH - 4, fill: s.color, rx: 3 }, g); bindTip(rect, function () { return '<b>' + r.label + '</b><br>' + s.name + ': ' + (cfg.valFmt || fmtN)(s.v); }); if (s.label !== false) el('text', { x: lw + w + 5, y: yy + rowH / 2 + 4, text: s.text != null ? s.text : (cfg.valFmt || fmtN)(s.v), 'font-size': 11.5 }, g); });
    }
    y += nseg * rowH + groupGap;
  });
  if (cfg.xlabel) el('text', { x: lw + pw / 2, y: ph - 16, 'text-anchor': 'middle', text: cfg.xlabel }, g);
  container.innerHTML = ''; container.appendChild(svg);
  if (cfg.legend) container.appendChild(legend(cfg.legend));
  return svg;
}
function legend(items) { var d = h('div', { 'class': 'legendkeys' }); items.forEach(function (it) { d.appendChild(h('span', {}, '<i class="swatch" style="background:' + it.color + '"></i>' + it.name)); }); return d; }
function bindTip(node, fn) { node.addEventListener('mousemove', function (e) { tipShow(e, fn()); }); node.addEventListener('mouseleave', tipHide); node.style.cursor = 'default'; }
function niceTicks(lo, hi, n) { var span = hi - lo, step = Math.pow(10, Math.floor(Math.log10(span / n))); var err = span / n / step; if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2; var out = []; for (var v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10)); return out; }
// Line chart. series: [{name,color,pts:[[x,y]],dash}] ; cfg: xlabel,ylabel,xmax,ymax,ymin,guides:[{y,label}],logy
function lines(container, cfg) {
  var W = cfg.width || 760, H = cfg.height || 300, ml = 56, mr = 16, mt = 24, mb = 40, pw = W - ml - mr, ph = H - mt - mb;
  var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, 'class': 'chart', role: 'img' });
  if (cfg.title) el('text', { x: 0, y: 14, 'class': 'ttl', text: cfg.title }, svg);
  var xmax = cfg.xmax, ymin = cfg.ymin || 0, ymax = cfg.ymax;
  if (ymax == null) { ymax = 0; cfg.series.forEach(function (s) { s.pts.forEach(function (p) { if (p[1] > ymax) ymax = p[1]; }); }); ymax = niceTicks(0, ymax * 1.05 || 1, 5).pop(); }
  var x = function (v) { return ml + v / xmax * pw; }, y = function (v) { return mt + ph - (v - ymin) / (ymax - ymin) * ph; };
  var g = el('g', {}, svg), grid = el('g', { 'class': 'grid' }, g);
  niceTicks(ymin, ymax, 5).forEach(function (t) { el('line', { x1: ml, x2: ml + pw, y1: y(t), y2: y(t) }, grid); el('text', { x: ml - 8, y: y(t) + 4, 'text-anchor': 'end', text: fmtN(t) }, g); });
  niceTicks(0, xmax, 6).forEach(function (t) { el('text', { x: x(t), y: mt + ph + 18, 'text-anchor': 'middle', text: fmtN(t) }, g); });
  el('line', { x1: ml, x2: ml + pw, y1: mt + ph, y2: mt + ph, stroke: 'var(--axis)' }, g);
  (cfg.guides || []).forEach(function (gd) { if (gd.y > ymax) return; el('line', { x1: ml, x2: ml + pw, y1: y(gd.y), y2: y(gd.y), stroke: 'var(--ink2)', 'stroke-width': 1 }, g); el('text', { x: ml + pw - 4, y: y(gd.y) - 4, 'text-anchor': 'end', text: gd.label, 'font-size': 11 }, g); });
  cfg.series.forEach(function (s) {
    var d = ''; s.pts.forEach(function (p, i) { var yy = Math.max(mt, Math.min(mt + ph, y(p[1]))); d += (i ? 'L' : 'M') + x(p[0]).toFixed(1) + ',' + yy.toFixed(1); });
    var path = el('path', { d: d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, g);
    if (s.dash) path.setAttribute('stroke-dasharray', '5 4');
  });
  // hover crosshair
  var hov = el('g', { visibility: 'hidden' }, g); var vl = el('line', { y1: mt, y2: mt + ph, stroke: 'var(--ink2)' }, hov);
  var dots = cfg.series.map(function (s) { return el('circle', { r: 4.5, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 2 }, hov); });
  var hit = el('rect', { x: ml, y: mt, width: pw, height: ph, fill: 'transparent' }, g);
  hit.addEventListener('mousemove', function (e) { var r = svg.getBoundingClientRect(); var vx = (e.clientX - r.left) / r.width * W; var xv = (vx - ml) / pw * xmax; xv = Math.max(0, Math.min(xmax, xv)); hov.setAttribute('visibility', 'visible'); vl.setAttribute('x1', x(xv)); vl.setAttribute('x2', x(xv)); var html = '<b>' + (cfg.xfmt ? cfg.xfmt(xv) : fmtN(xv, 1)) + '</b>'; cfg.series.forEach(function (s, i) { var yv = interp(s.pts, xv); dots[i].setAttribute('cx', x(xv)); dots[i].setAttribute('cy', Math.max(mt, Math.min(mt + ph, y(yv)))); html += '<br>' + s.name + ': ' + (cfg.yfmt ? cfg.yfmt(yv) : fmtN(yv, 1)); }); tipShow(e, html); });
  hit.addEventListener('mouseleave', function () { hov.setAttribute('visibility', 'hidden'); tipHide(); });
  if (cfg.xlabel) el('text', { x: ml + pw / 2, y: H - 4, 'text-anchor': 'middle', text: cfg.xlabel }, g);
  if (cfg.ylabel) el('text', { x: 12, y: mt + ph / 2, transform: 'rotate(-90 12 ' + (mt + ph / 2) + ')', 'text-anchor': 'middle', text: cfg.ylabel }, g);
  container.innerHTML = ''; container.appendChild(svg);
  if (cfg.legend) container.appendChild(legend(cfg.legend));
}
function interp(pts, xv) { for (var i = 1; i < pts.length; i++) { if (pts[i][0] >= xv) { var a = pts[i - 1], b = pts[i]; var t = (xv - a[0]) / (b[0] - a[0] || 1); return a[1] + t * (b[1] - a[1]); } } return pts[pts.length - 1][1]; }

/* ===== static content ===== */
var MATRIX = [
  ['Spectrum', 'n41 2.5 GHz (T-Mobile, 100–200 MHz); n77 C-band 3.7–3.98 GHz (Verizon avg 161 MHz, AT&T 120 MHz + 40–70 MHz of 3.45 GHz); low-band fallback ' + tag('c'), '3.55–3.70 GHz Part 96; 10 MHz PAL channels (≤40 MHz per county per licensee), up to 150 MHz GAA where idle ' + tag('c'), 'n261 28 GHz, n260 39 GHz, 24 GHz; 400–800 MHz carriers, up to 8×100 MHz ' + tag('c'), 'CBRS 3.55–3.70 (2×40 MHz); 5 GHz UNII-1/3; 6 GHz UNII-5/7 (4×40 MHz on G1x2) ' + tag('c'), 'One radio: 3.55–3.70 + 5.725–5.895 + 5.925–6.425 + 6.525–6.865 GHz; four 40 MHz carriers in any band mix ' + tag('m'), 'Ku-band user links 10.7–12.7 / 14.0–14.5 GHz ' + tag('c')],
  ['Regulatory power', '1,640 W/MHz non-rural, 3,280 W/MHz rural (47 CFR 27.50); radio-limited at ≈79 dBm/100 MHz ' + tag('c') + tag('d'), 'Cat A 30 dBm/10 MHz; Cat B 47 dBm/10 MHz (57 dBm/100 MHz); end-user device 23 dBm/10 MHz; CPE-CBSD 30 dBm/10 MHz ' + tag('c'), '75 dBm/100 MHz base; fixed CPE up to 55 dBm EIRP (Part 30) ' + tag('c'), 'Grant: 48.45 dBm CBRS (42.4 dBm/10 MHz); 36 dBm in 5/6 GHz, split across carriers (30 dBm each at 4) ' + tag('m'), 'Same grant limits (FCC ID 2ABOF-G2BNF356900, 21 May 2025, incl. 6 GHz standard power under AFC) ' + tag('m'), 'n/a (satellite EIRP density limits)'],
  ['Base radio', '64T64R massive MIMO, 192–256 elements, ≈24 dBi, 320–480 W, up to 16 DL layers (e.g. Ericsson AIR 6492) ' + tag('c'), '2T2R integrated (Baicells Aurora 243, 14.5 dBi, 2×10 W) to 8T8R/32T32R macro radios; GPS-synced TDD ' + tag('c'), '64–256-element arrays on poles or rooftops; 2018 Verizon small cells ' + tag('c'), 'BN: 16 chains, 13.2–14.3 dBi per port at 3.5 GHz, 15.6–16.9 dBi at 6 GHz; 19 kg; 275 W ' + tag('m'), 'G2 BN: 16 chains, 8 MU-MIMO streams, 22 kg, 420 W typical, dual 10G SFP+ ' + tag('c') + tag('m'), 'Satellite phased arrays; ~9,670 operational satellites (Sep 2026) ' + tag('m')],
  ['Customer equipment', 'Indoor gateway (Arcadyan G5AR, Nokia FastMile, Askey), 4×4 MIMO, internal antennas ≈0–5 dBi, Wi-Fi 7; self-install at a window ' + tag('c'), 'Outdoor 14–17 dBi panel (Baicells Atom OD06H 14 dBi / Photon OD63H 17 dBi, 29 dBm), 4×4, pro-install; $250–400 ' + tag('c'), 'Window-mounted phased array (Qualcomm QTM527 class); pro-install 3–4 h in 2018, later self-install ' + tag('c'), 'RN: 8 cross-polarised chains, 14.5 dBi per antenna, 1×1/2×2 (4×4 in x2 mode); pro-install (6 GHz RN may be self); RNv-6 value unit 4 antennas, LoS/nLoS only ' + tag('m') + tag('c'), 'RNm-3+6 multiband, 1.6 Gbps aggregate, 50 W, 3 kg; G1 RNs remain compatible ' + tag('c'), 'Standard dish, self-install; kit $349 (often free with 12-month term) ' + tag('c')],
  ['Peak per customer', '≈1–1.5 Gbps radio peak; plans cap at 300–1,000 Mbps ' + tag('c'), 'Aurora 243: 850/660 Mbps at 100 MHz; ≈340 at 40 MHz ' + tag('c') + tag('d'), '1–4 Gbps with 800 MHz ' + tag('c'), '800 Mbps (80 MHz); 1.6 Gbps in x2 mode ' + tag('c'), '1.6 Gbps per RN ' + tag('c'), '400+ Mbps (Residential Max plan) ' + tag('c')],
  ['Measured typical', 'Ookla Q2 2026 median: T-Mobile 223/18, AT&T 161/10, Verizon 126/12 Mbps; rural 100–205 down; <40% of tests ≥100/20 ' + tag('m'), 'Operators: 100 Mbps "very reliably" to 6 mi with 200–250 ft mounts ' + tag('c'), 'Verizon 2018: typical 300, peak 940 Mbps ' + tag('c'), 'Preseem fleet median 24 h link rate: CBRS 434 (p95 641), 5 GHz 307, 6 GHz 4-carrier 774 Mbps; sold median plan 102 Mbps ' + tag('m'), 'Nextlink test link 950+/400+ Mbps; 9.3-mile production link, 186 users per sector ' + tag('c'), 'Ookla Q1 2026 US median 128 down; 44.7% of users ≥100/20 in Q4 2025 ' + tag('m')],
  ['Latency', '≈25–50 ms; rural 7–13 ms worse than urban ' + tag('m'), '≈15–30 ms ' + tag('c'), '≈10–20 ms ' + tag('c'), '<5 ms one-way claim; "about 10 ms" typical in BEAD material ' + tag('c'), 'Same ' + tag('c'), '25–60 ms multi-server; <40 ms median in 10 states ' + tag('m')],
  ['Sector / site capacity', '≈1–1.5 Gbps per sector shared with mobile; FWA sold only into forecast fallow capacity per hex bin ' + tag('c'), '≈150–400 Mbps per 40 MHz sector; 1,200 RRC users (Aurora) ' + tag('c') + tag('d'), '1–3 Gbps per node; ≈27 eligible addresses per Sacramento cell ' + tag('c'), '2.4 Gbps/BN, 9.6 Gbps per 4-BN cell on one 80 MHz channel (k=1 reuse); 250 RNs/BN ' + tag('c'), '6.4 Gbps/BN, 25.6 Gbps per cell; 512 RNs/BN ' + tag('c'), 'Per-cell capacity managed by demand surcharge ($100–1,500) ' + tag('m')],
  ['Range, LOS / NLOS', '5–10 km / 1–3 km to an indoor gateway (model) ' + tag('d'), '10+ km / 3–6 km with outdoor panel (operators, model) ' + tag('c') + tag('d'), '0.3–0.8 km / none ' + tag('c'), '30 km / 3 km (datasheet); 20-mile links reported ' + tag('c'), 'Same; 15 km production link ' + tag('c'), 'n/a'],
  ['Interference handling', 'Exclusive licence; inter-cell managed by planning ' + tag('c'), 'SAS coordination; GAA shared among 430,000+ CBSDs; typical 3 dB+ noise rise ' + tag('c'), 'Exclusive licence ' + tag('c'), 'Intra-network nulling "up to 45 dB" (universal reuse); ABIC "up to 40 dB" against external bursts ' + tag('c'), 'Same ' + tag('c'), 'Operator-managed'],
  ['Install model', 'Self-install, app-guided; ~70–80% self-install at Verizon by 2020 ' + tag('c'), 'Professional; $150–370 labour and mount ' + tag('d'), 'Professional (2018), later self ' + tag('c'), 'Professional with install app; alignment metric ≥12/30 ' + tag('c'), 'Same ' + tag('c'), 'Self, unobstructed sky needed ' + tag('c')],
  ['Sector hardware cost', 'Incremental to mobile network; not disclosed ' + tag('c'), '$5,000–8,500 eNB/gNB class radios; ≈$9–15k per Cat B sector installed ' + tag('c') + tag('d'), '$20–30k per node ' + tag('c'), 'BN-3 $24,470; BN-5 $21,400; BN-6 $21,410 (US list) ' + tag('c'), 'G2 BN $38,640 (US list) ' + tag('c'), 'n/a'],
  ['CPE cost', '≈$275 retail (AT&T gateway); subsidised ' + tag('c'), '$246–400 ' + tag('c'), '$200–400 (2018 drop ≈$200 all-in, Moffett) ' + tag('c'), 'RN-3 $1,290; RN-5 $1,130; RN-6 $1,180; RNv-6 $840 (5-pack pricing incl. 100 Mbps licence) ' + tag('c'), 'RNm $1,460; "Perpetual Uncapped" licence +$180 ' + tag('c'), '$349 kit ' + tag('c')],
  ['Ecosystem / lock-in', '3GPP, multi-vendor, carrier scale ' + tag('c'), '3GPP multi-vendor; Cambium cnRanger end-of-sale Mar 2025; Baicells, Airspan, Ericsson, Nokia ' + tag('c'), '3GPP ' + tag('c'), 'Single vendor; hosted NMS (Tarana Cloud Suite); ≈$457M raised, share price flat since 2023 ' + tag('c'), 'Single vendor ' + tag('c'), 'Single vendor'],
  ['BEAD "reliable broadband"', 'Licensed (BDC code 71): yes ' + tag('c'), 'Licensed-by-rule GAA (code 72): yes per NTIA Nov 2023 ' + tag('c'), 'Yes ' + tag('c'), 'CBRS yes; unlicensed 5/6 GHz (code 70) no, except where nothing reliable is under the high-cost threshold ' + tag('c'), 'Same ' + tag('c'), 'LEO eligible under June 2025 tech-neutral rules; won 21.9% of locations nationally ' + tag('m')],
  ['Scale (2026)', '≈17–18 M US subscribers; T-Mobile ≈9.4 M, Verizon 6.2 M, AT&T 2.0 M ' + tag('m') + tag('d'), '430,000+ CBSDs across all uses; WISP share not published ' + tag('c'), 'Verizon mmWave-served FWA share not disclosed; Starry ≈100k subs acquired ' + tag('c'), '300+ operators, 24 countries, 20 M homes covered, "hundreds of thousands" of subs ' + tag('c'), '350+ live G2 sectors at Nextlink alone ' + tag('c'), '12 M global, 2.7 M US (85% rural) ' + tag('m') + tag('c')]
];
var MATRIX_COLS = [['MNO macro FWA', 1], ['CBRS 5G NR (WISP)', 3], ['mmWave 5G FWA', 4], ['Tarana G1', 2], ['Tarana G2', 2], ['Starlink Residential', 0]];

var SW = [
  { name: 'MNO macro FWA', color: 1, s: 'Lowest price per customer, zero truck roll, national brand, exclusive licensed spectrum and an existing tower grid. Rides capex that mobile already paid for.', w: 'Coverage is a by-product of the mobile grid; service is offered only where fallow capacity exists and withdrawn when it fills (July 2026 availability drop). Indoor gateways spend 15–30 dB on walls and height before the trees start. Deprioritised behind mobile at congestion; uplinks of 10–18 Mbps median.' },
  { name: 'Dedicated CBRS 5G NR', color: 3, s: 'Multi-vendor 3GPP radios and $250–400 CPEs; "reliable broadband" status for BEAD; outdoor pro-installed panels recover most of what MNO gateways lose; 40% of Tarana\'s sector cost.', w: 'One 40–60 MHz carrier per sector in practice; GAA noise rise grows with 430k+ CBSDs and Google\'s SAS exit concentrates the market; fixed panels lose gain in multipath; Cat B radios need CPI registration; the 3GPP small-cell vendor base for WISPs is thin (cnRanger gone, Baicells is Chinese-origin, Ericsson/Nokia priced for carriers).' },
  { name: 'mmWave 5G FWA', color: 4, s: 'Enormous channels (400–800 MHz), multi-gigabit peaks, exclusive spectrum, tiny latency. Right answer for dense MDUs and rooftops with clear sight lines.', w: 'Line-of-sight only: a single tree is 10–30 dB, low-E glass 28 dB, rain 4.6 dB/km. Effective radius ≈200 m from poles; nothing in a forested county. Verizon redirected it to MDUs after six years.' },
  { name: 'Tarana G1 / G2', color: 2, s: 'Best link budget in the category: arrays at both ends, carrier aggregation across CBRS and 6 GHz, interference cancellation, universal frequency reuse, 25.6 Gbps per G2 site. Field medians of 434–774 Mbps across tens of thousands of RNs. Operators report 40% fewer towers.', w: 'Single private vendor with a hosted controller; BN at $21–39k and RN at $840–1,460 are 3–5× 3GPP prices; 6 GHz capacity depends on AFC and is not "reliable" for BEAD; CBRS coverage depends on the same GAA rules as everyone; ~10% of plans sold on RNs exceed the link\'s capability (Preseem).' },
  { name: 'Starlink', color: 0, s: 'No towers, backhaul or spectrum fights; $1,383 per BEAD location; 128 Mbps median download; 12 M subscribers; instant availability anywhere with sky view.', w: 'Per-cell capacity rationed by $100–1,500 surcharges; uploads 10–25 Mbps; 25–60 ms latency; dish needs a clear sky arc that pine canopy often blocks; price $55–130 before the kit.' }
];

var OTHERS = [
  ['Tarana G1 / G2', '5 GHz, 6 GHz, CBRS; G2 multiband', 'True NLOS: 16×8-chain distributed MU-MIMO, interference cancellation', 'G1 2.4 Gbps/BN; G2 6.4 Gbps/BN', '3 km NLOS / 30 km LOS (datasheet)', 'BN $21.4–38.6k; RN $840–1,460', 'Category performance leader; highest sector capex; growing share'],
  ['Cambium PMP 450m / 450v (now Airspan)', '3 GHz CBRS, 5 GHz', 'Near-LOS; GPS-synced TDMA; 14×14 cnMedusa MU-MIMO', '>800 Mbps in 40 MHz; 238 SMs; 450v ≈2×', '≈5 mi planning; field average 18 subs/sector (p95 55)', 'AP $8,846; SM $150–300', 'Closest legacy rival; vendor orphaned and re-homed in Sept 2026'],
  ['Cambium ePMP 4600 / 4600L', '6 GHz (5.925–7.125) under AFC', 'LOS / near-LOS 802.11ax, 4×4 MU-MIMO', 'Up to 4 Gbps aggregate, 160 MHz, 120 subs', 'Several miles LOS', 'AP $1,499; Force 4518/4616 SMs low-cost', 'Volume 6 GHz play; no owner after the collapse'],
  ['Cambium cnWave V5000/V3000 (Airspan)', '60 GHz (57–71) Terragraph', 'Strict LOS mesh', 'Multi-gigabit', '<1 km per hop', 'V3000 client $835', 'Dense suburban / urban distribution, not rural access'],
  ['Ubiquiti LTU / airMAX AC', '5 GHz proprietary TDMA', 'LOS / near-LOS', '≈1 Gbps class', 'Several miles', 'LTU Rocket $729; LTU Pro $369; LiteBeam $90', 'Price leader; the perennial low-cost alternative; #1 US FWA vendor by base'],
  ['Ubiquiti Wave', '60 GHz + 5 GHz failover', 'LOS', 'Multi-gigabit', '<2 km', 'Wave AP $538–923; Nano $539; Pico $352', 'Short-range suburban'],
  ['Siklu / Ceragon MultiHaul TG', '60 GHz Terragraph', 'LOS mesh', '3.8 Gbps per node', '<300 m per hop', 'N265 node $1,129; TU $287–574', 'Meta Terragraph lineage; dense distribution'],
  ['Mimosa A5 / A5c / A6 (Radisys)', '5 GHz; A6 5.1–6.4 GHz', 'LOS / near-LOS; A6 8×8 MU-MIMO', 'A5c 1 Gbps+; A6 "7 Gbps"', 'Several miles', 'A5-14 $605; A5c $648; A6 $1,933', 'Mid-tier capacity, LOS; sold by Airspan to Radisys 2023'],
  ['Baicells Nova 436Q / 846 / Aurora 243 (3GPP)', 'CBRS LTE and 5G NR n48', 'NLOS-tolerant 3GPP waveform; interference-limited in GAA', '436Q 290/70; 846 580/70; Aurora 850/660 Mbps', 'Several miles', 'Nova 436Q $2,890–4,999; Nova 846 $8,499; Atom CPE $246–307', '3GPP alternative for WISPs; Chinese-origin vendor adoption barriers'],
  ['RADWIN JET PRO / DUO', '5 GHz; 3.5 GHz', 'Near-LOS beamforming', '≈750 Mbps class', 'Several miles', 'No US price located', 'Niche']
];

var YARD = [
  ['Entry price / month', '$35–50 (bundled) · $50–60 list', 'WISP $30–75', 'n/a', '$55 (100 Mbps)'],
  ['Top residential tier', '$70–80 (up to 1 Gbps advertised)', 'WISP $75–170', 'n/a', '$130 (Max, 400+ Mbps)'],
  ['Equipment', '$0–275 gateway, usually included', '$250–400 CPE + install, often fee-waived', 'included', '$349 kit, free with 12-month term in many areas'],
  ['Median download (independent)', 'TMO 223 / ATT 161 / VZ 126 Mbps (Ookla Q2 2026)', 'Operator-level: Resound 99, Nextlink 68, Wisper 53, Rise 43 (Ookla Q2 2025, disputed)', 'Link-rate median 434 (CBRS) / 774 (6 GHz 4-carrier) (Preseem)', '128 Mbps (Ookla Q1 2026)'],
  ['Median upload', '18 / 10 / 12 Mbps', '31 / 18 / 12 / 18 Mbps', 'n/a published', '≈20 Mbps in 22 states'],
  ['Share meeting 100/20', '<40% of tests in 48 states', 'Resound 41.5%, Wisper 26%, Nextlink 24%, Rise 7%', 'n/a', '44.7% (Q4 2025)'],
  ['Latency', '25–50 ms (rural +7–13)', '15–30 ms', '<5 ms one-way claim; ~10 ms', '25–60 ms'],
  ['Availability gate', 'Fallow capacity per hex bin; shrinking in cities', 'Coverage + sector capacity', 'Coverage + BN capacity (250–512 RNs)', 'Per-cell capacity; $100–1,500 demand surcharge'],
  ['Scale', '≈17–18 M US', '≈8 M US WISP subs (industry est., not sourced here)', '"hundreds of thousands" on Tarana', '2.7 M US / 12 M global'],
  ['BEAD cost per location', 'n/a (rarely bid)', 'TN avg $1,289; Nextlink $642–2,479', 'PhireLink "roughly half of fiber"', '$1,383 national avg; $1,920 SC; Kuiper $601 SC']
];
var YARD_COLS = ['', 'MNO macro FWA', 'WISP FWA (incl. CBRS 5G NR)', 'Tarana-based WISP', 'Starlink Residential'];

var MISSING = [
  ['1 · The uplink is the gate', 'BEAD, FCC "served" status and every video call are decided by the 20 Mbps uplink, and the uplink runs from a 23–36 dBm CPE to the tower. Downlink coverage maps overstate every technology; on this page the CBRS 5G NR footprint shrinks by about a third when the uplink test is applied, and Tarana\'s 16-chain receive array is worth more there than anywhere else.'],
  ['2 · Coverage is not serviceable passings', 'A Tarana BN\'s "250 RNs" is a connection limit. At 5.2 Mbps busy-hour demand a 1.9 Gbps downlink carries ≈370 subscribers in theory and 120–150 at realistic peak-to-mean, so a site that covers 3,000 homes at 30% take is capacity-bound before it is range-bound. MNO FWA has the same arithmetic hidden inside the hex-bin gate. Use the economics tab\'s capacity bar, not the map alone.'],
  ['3 · Spectrum rules are moving under all of them', 'FCC 24-86 (higher CBRS power, 26 dBm UEs, DPA codification) has sat without an order since late 2024; a power increase helps 3GPP radios more than Tarana, which already sits below the Cat B cap. Carriers\' 2025 proposal to relocate CBRS "hasn\'t gained traction" but is not dead. Google exits SAS administration on 10 June 2027, leaving Federated with ~83% share. The upper C-band auction will add MNO FWA capacity. 6 GHz standard power depends on AFC and Wi-Fi 7 will load the band.'],
  ['4 · Vendor survival is a real scenario', 'Cambium, behind 39.5% of US fixed-wireless CPE, failed in eleven days in September 2026; ePMP has no buyer. Tarana is private, has raised ≈$457M with a flat $1.07 share price across three rounds, and activates, licenses and upgrades every RN through a hosted cloud suite. Model the orphaned-network case: radios keep running, spares and software do not.'],
  ['5 · Seasons and storms', 'Leaf-off cuts deciduous and mixed-forest loss by roughly 30% but does nothing for pine, which is most of this county; swamp forest is in between. Georgetown is a hurricane coast: a 4-BN site draws 1.1–1.7 kW and needs 10–25 Gbps of backhaul, so generator run-time and middle-mile diversity are part of the availability story. Rain matters only at mmWave (4.6 dB/km at 25 mm/h at 28 GHz).'],
  ['6 · GAA is getting crowded; 6 GHz is clean "for now"', '430,000+ CBSDs are deployed in 80% of counties. Tarana\'s own CEO: 6 GHz "is pretty clean spectrum right now. But it\'s not going to be clean forever." Preseem\'s fleet shows CBRS links running 41% faster than 5 GHz unlicensed; the same mechanism will act on 6 GHz as AFC devices and Wi-Fi 7 arrive. Interference margin is a forecast, not a constant.'],
  ['7 · Sold versus delivered', 'Preseem finds just under 10% of plans sold on Tarana RNs exceed what the link can deliver (5% on legacy gear) because operators sell faster tiers on Tarana. Ookla\'s Q2 2025 report card put only 7–42% of WISP users at 100/20; WISPA disputes the method. For diligence, ask for per-RN link-rate distributions, not plan mix.'],
  ['8 · MNOs leave their biggest lever unused', 'Moving the MNO gateway outdoors roughly doubles its 100/20 footprint in this model, yet no US MNO runs an outdoor-CPE programme at scale; their FWA economics depend on a self-installed box. Rural MNO coverage is wherever the mobile grid happens to be, and sector-level sell-outs now show up in cities. Treat MNO FWA as a competitor for the easiest 40% of addresses, not the footprint.'],
  ['9 · The RN price drives take-rate sensitivity', 'A $1,290 RN plus a $250 install is ≈$1,500 of acquisition cost before any site share, against ≈$600 for a 3GPP CPE. At 15% annual churn that difference is ≈$11 per subscriber per month in replacement cost alone. Tarana\'s 100 Mbps-per-RN licence and $180 "uncapped" upgrade are also recurring-ish costs most models omit.'],
  ['10 · Technology codes decide funding', 'FCC Broadband Data Collection codes 70 (unlicensed), 71 (licensed) and 72 (licensed-by-rule) determine whether a location counts as served and whether a build is "reliable" for BEAD. Tarana on CBRS is 72 and qualifies; Tarana on 5/6 GHz is 70 and does not, except where nothing reliable fits under the high-cost threshold. The same radio on the same tower can be fundable or not depending on which carrier is lit.'],
  ['11 · Fiber already won this county', 'HTC and Spectrum builds took rural Georgetown County from 27% unserved to under 3%; South Carolina\'s whole remaining BEAD scope is 19,022 locations, half of them going to Kuiper and Starlink. The physics here transfers to any pine-belt county; the business case does not. Fixed wireless now competes for take rate against fiber at $49.95, not against nothing.'],
  ['12 · Starlink is capacity-rationed too', 'Demand surcharges of $100–1,500 by cell, a 100 Mbps entry tier at $55, uploads near 20 Mbps and a V3 constellation step that is still unconfirmed in orbit. A terrestrial operator\'s pitch is the uplink, the latency and local control, and it needs ~100+ passings per sector to beat $1,383 per location.'],
  ['13 · Power, backhaul and the 10G problem', 'A G2 site peaks at 25.6 Gbps; a 4-BN G1 site at 9.6 Gbps. Rural towers rarely have fiber; E-band radios are cheap to register ($75 per link per decade) but need LOS between towers, and IP transit at ~$3/Mbps/month makes the middle mile a larger opex line than the lease at many sites. 36% of ISPs report backhaul above 10% of opex.'],
  ['14 · Calibrate the foliage model locally', 'The biggest uncertainty on this page is the loss through Lowcountry pine at 3.6 and 6 GHz: the constants come from 0.1–2.1 GHz measurements with one 3.6 GHz anchor (46 dB through 200 m of mixed forest, Southern England) and none at 6 GHz. A two-day stationary measurement campaign from one of these towers, CPE at 2/6/10 m at 20–30 homes across the NLCD classes, would tighten every figure here by more than any further modelling.']
];

var GLOSS = [
  ['ABIC', 'Asynchronous Burst Interference Cancellation; Tarana\'s claimed suppression of out-of-network interferers such as Wi-Fi ("up to 40 dB").'],
  ['ACRB', 'Auto-Convergent Retrodirective Beamforming; Tarana\'s per-sub-band adaptive beamforming, recomputed ~5,000 times per second.'],
  ['AFC', 'Automated Frequency Coordination; the database system that lets standard-power (36 dBm) devices operate outdoors in UNII-5/7 at 6 GHz.'],
  ['BEAD / BSL', 'Broadband Equity, Access and Deployment programme; Broadband Serviceable Location, the unit funded.'],
  ['BN / RN', 'Tarana Base Node (sector radio) and Remote Node (customer radio).'],
  ['CBRS, Cat A / Cat B, CPE-CBSD, EUD', 'Citizens Broadband Radio Service, 3.55–3.70 GHz. Category A CBSD: 30 dBm/10 MHz; Category B: 47 dBm/10 MHz, professional install. CPE-CBSD: a customer radio registered as a Cat A CBSD. EUD: end-user device, 23 dBm/10 MHz.'],
  ['CPI', 'Certified Professional Installer, required to register Cat B CBSDs with a SAS.'],
  ['DMM / MU-MIMO', 'Distributed massive MIMO (Tarana\'s term for 16 BN + 8 RN chains); multi-user MIMO, several users served on the same resource via spatial separation.'],
  ['EIRP', 'Equivalent isotropically radiated power: transmit power plus antenna gain, dBm.'],
  ['Fallow capacity / hex bin', 'T-Mobile\'s term for forecast unused mobile capacity; the ~36 million geographic bins in which it is forecast and FWA is approved.'],
  ['FSPL', 'Free-space path loss, 20 log(4πdf/c).'],
  ['GAA / PAL', 'General Authorized Access (shared, licensed-by-rule) and Priority Access Licence (county-level 10 MHz licences) in CBRS.'],
  ['ITM / Longley-Rice', 'The ITS Irregular Terrain Model v1.2.2, the FCC\'s standard terrain propagation model, 20 MHz–20 GHz.'],
  ['MCS / SE', 'Modulation and coding scheme; spectral efficiency in bit/s/Hz per layer.'],
  ['n41, n77, n48, n261', '3GPP band numbers: 2.5 GHz TDD; 3.3–4.2 GHz TDD (C-band); CBRS; 28 GHz.'],
  ['ngFWA', 'Tarana\'s category label, "next-generation fixed wireless access".'],
  ['NLCD', 'National Land Cover Database (MRLC), 30 m, 16 classes.'],
  ['NLOS / nLOS / LOS', 'Non-, near- and full line of sight.'],
  ['O2I', 'Outdoor-to-indoor (building penetration) loss, 3GPP TR 38.901 §7.4.3.'],
  ['Oversubscription', 'Sum of sold plan rates divided by sector capacity; or subscribers times busy-hour demand divided by capacity.'],
  ['P.833 / P.2108 / P.838', 'ITU-R recommendations for vegetation attenuation, statistical clutter loss, and rain attenuation.'],
  ['SAS', 'Spectrum Access System; Federated, Google (exiting June 2027), Nokia, RED, Sony, Keybridge.'],
  ['SINR / SNR', 'Signal to interference-plus-noise ratio, dB; the quantity that sets the MCS.'],
  ['TDD ratio', 'Share of time slots given to downlink versus uplink (MNO ≈3:1; Tarana 4.5:1 to 1.75:1 configurable).'],
  ['TCS', 'Tarana Cloud Suite, the hosted network management, activation and licensing system.'],
  ['Weissberger / A<sub>m</sub> model', 'Two vegetation-loss forms: the exponential-decay fit, and the P.833 saturating model with maximum A<sub>m</sub> used here.'],
  ['64T64R', 'A 64-transmit, 64-receive massive-MIMO radio, typically 192–256 antenna elements.']
];

var SOURCES = [
  'Tarana Wireless, G2 product page — https://taranawireless.com/g2/',
  'Light Reading, "With G2, Tarana sees hybrid fiber-FWA networks as the future" — https://www.lightreading.com/broadband/with-g2-tarana-sees-hybrid-fiber-fwa-networks-as-the-future-',
  'Tarana G1 3/5/6 GHz datasheet (WAV) — https://www.wavonline.com/img/wav/pdf/Tarana-G1-3-5-6-GHz-Datasheet.pdf',
  'Tarana product overview — https://taranawireless.com/product/',
  'Tarana ngFWA datasheet (Winncom) — https://www.winncom.com/pdf/Tarana_G2_BN/Tarana_ngFWA_Datasheet.pdf',
  'Tarana ngFWA Primer white paper (2509-02) — https://resourcesapi.taranawireless.com/storage/resource_files/white-papers/1758649242_Tarana-ngFWA-Primer-White-Paper-2509-02.pdf',
  'FCC ID 2ABOF-G2BNF356900 grant and exhibits (G2 BN) — https://fccid.io/2ABOF-G2BNF356900',
  'FCC ID 2ABOF-G1-BN3ASI001 (G1 BN-3) — https://fcc.report/FCC-ID/2ABOF-G1-BN3ASI001',
  'G2 BN antenna test report (MVG, March 2025) — https://fccid.io/2ABOF-G2BNF356900/Test-Report/G2-Cello-BN-Antenna-Test-Report-Rev1-1-8288176.pdf',
  'Tarana, "G1 is first FCC-certified outdoor 6 GHz product" — https://taranawireless.com/g1-is-first-fcc-certified-outdoor-6ghz-product/',
  'FCC test report, G1 RN 5 GHz (antenna and chain count) — https://fcc.report/FCC-ID/2ABOF-G1RN5AHB012/6268509.pdf',
  'Tarana, "Power and the FCC" — https://taranawireless.com/power-and-the-fcc-what-you-need-to-know-about-wireless-power-limits/',
  'Tarana, ngFWA vs 4G/5G white paper (2509-07) — https://resourcesapi.taranawireless.com/storage/resource_files/white-papers/1758917331_Tarana-ngFWA-vs-4G-5G-White-Paper-2509-07.pdf',
  'Tarana RN 6 GHz installation guide — https://fccid.io/2ABOF-G1RN6AHB012/User-Manual/RN-6GHz-G1RN6AHB012-Installation-Guide-R05-6900642.pdf',
  'Preseem, "Tarana G1 in action" (fleet link rates, Feb 2025) — https://preseem.com/2025/02/tarana-g1-in-action/',
  'BusinessWire, Nextlink expands gigabit coverage with Tarana G2 (Nov 2025) — https://www.businesswire.com/news/home/20251119296022/en/',
  'Fierce Network, "Look, it\'s Tarana in a tree" — https://www.fierce-network.com/wireless/look-its-tarana-tree',
  'Fierce Network, Wisper hits 600k passings with Tarana — https://www.fierce-network.com/broadband/wisper-hits-600k-passings-taranas-fwa-tech',
  'US distributor list prices: Winncom (G2 BN), WAV, Wireless Units (RNs) — https://www.winncom.com/en/products/35-0200-001 ; https://wirelessunits.com/tarana-remote-nodes/',
  '650 Group, "Tarana launches its new G2 product" — https://650group.com/blog/tarana-launches-its-new-g2-product/',
  'Preseem, "From plans to performance: Tarana link rate success" — https://preseem.com/2025/02/from-plans-to-performance-analyzing-tarana-link-rate-success/',
  'Ookla WISP report card via CCG and Benton — https://potsandpansbyccg.com/2026/01/15/ooklas-wisp-report-card/ ; https://www.benton.org/blog/fixed-wireless-ready-bead',
  'Light Reading, "WISPs clap back at Ookla report" — https://www.lightreading.com/broadband/wisps-clap-back-at-ookla-report-on-fwa-speeds',
  'The Fast Mode, Nextlink activates first BEAD-funded tower with Tarana — https://www.thefastmode.com/technology-solutions/48566-nextlink-activates-nation-s-first-bead-funded-tower-using-tarana-s-ngfwa',
  'Broadband Breakfast, NTIA confirms licensed-by-rule may apply for BEAD — https://broadbandbreakfast.com/ntia-confirms-licensed-by-rule-may-apply-for-bead-funding/',
  'Broadband Breakfast, all BEAD plans approved, $18.2B — https://broadbandbreakfast.com/with-all-bead-plans-approved-states-and-territories-set-to-spend-18-2-billion-on-deployment/',
  'Light Reading, "What\'s going on with fixed wireless and BEAD" — https://www.lightreading.com/broadband/what-s-going-on-with-fixed-wireless-and-bead-',
  'Forge Global, Tarana funding history — https://forgeglobal.com/tarana_ipo/',
  'RCR Wireless, "The Cambium collapse: what it means for WISPs" (Sept 2026) — https://rcrwireless.com/20260923/analyst-angle/the-cambium-collapse-what-it-means-for-wisps-analyst-angle',
  'Verizon Q2 2026 results (8-K exhibit 99) — https://www.sec.gov/Archives/edgar/data/0000732712/000073271226000040/a2026q2exhibit99.htm',
  'AT&T Q2 2026 earnings; Internet Air 2 million — https://about.att.com/story/2026/2q-earnings.html ; https://about.att.com/story/2026/aia-2-million-subscribers.html',
  'T-Mobile Q2 2026 earnings call transcript — https://s29.q4cdn.com/310188824/files/doc_financials/2026/q2/TMUS-USQ_Transcript_2026-07-23-1.pdf',
  'Ookla US FWA rural/urban 1H 2026, via Light Reading — https://www.lightreading.com/fixed-wireless-access/5g-fwa-has-rural-urban-performance-gap-in-us-ookla',
  'Opensignal, State of US FWA (Oct 2025) — https://insights.opensignal.com/2025/10/20/the-state-of-us-fwa-what-impact-has-att-internet-airs-launch-had/dt',
  'ConsumerAffairs, T-Mobile Home Internet tiers (Nov 2025) — https://www.consumeraffairs.com/news/t-mobile-revamps-5g-home-internet-with-new-tiers-faster-wi-fi-and-streaming-perks-111025.html',
  'T-Mobile network management practices — https://www.t-mobile.com/home-internet/policies/internet-service/network-management-practices.html',
  'Fierce Network, urban FWA availability shrinking (July 2026) — https://www.fierce-network.com/broadband/urban-people-fwa-cities-might-run-low-availability',
  'Telecompetitor, MoffettNathanson: FWA uses more than half of mobile capacity — https://www.telecompetitor.com/fwa-uses-more-than-half-of-mobile-network-capacity-analysis/',
  '47 CFR §27.50 power limits — https://www.ecfr.gov/current/title-47/chapter-I/subchapter-B/part-27/subpart-C/section-27.50',
  '47 CFR Part 96 (CBRS) — https://www.ecfr.gov/current/title-47/chapter-I/subchapter-D/part-96',
  'FCC 24-86 NPRM (3.5 GHz framework) — https://docs.fcc.gov/public/attachments/FCC-24-86A1.pdf',
  'Technology Policy Institute, "CBRS in 2026" panel recap — https://techpolicyinstitute.org/publications/broadband/spectrum-and-wireless/cbrs-in-2026-what-have-we-learned-panel-recap/',
  'Ericsson AIR 6492 — https://www.ericsson.com/en/portfolio/networks/ericsson-radio-system/radio/macro/massive-mimo/air-6492',
  'arXiv 2511.16827, LOS probability at 13,253 US macro sites — https://arxiv.org/pdf/2511.16827',
  'Baicells Aurora 243, Photon OD63H, Atom OD06H datasheets — https://www.waveform.com/products/aurora-243 ; https://www.alliancecorporation.ca/wp-content/uploads/2026/02/Baicells-Photon-OD63H-EG8561A-Datasheet.pdf',
  'Google SAS pricing (Light Reading 2019) and SAS exit (Fierce 2026) — https://www.lightreading.com/5g/google-puts-a-price-on-cbrs-sas-2-25-month-per-home ; https://www.fierce-network.com/wireless/google-exits-cbrs-sas-administration-business',
  'Telecompetitor, WISPs get CBRS range as great as six miles at 100 Mbps — https://www.telecompetitor.com/wisps-get-cbrs-range-as-great-as-six-miles-at-100-mbps-speeds/',
  'Light Reading, Moffett on Verizon 5G Home economics (2019) — https://www.lightreading.com/mobile/5g/verizon-faces-steep-climb-to-attain-attractive-return-on-5g-home---analyst-/d/d-id/750289',
  'Wireless Estimator, Verizon acquires Starry (Oct 2025) — https://wirelessestimator.com/articles/2025/verizon-acquires-starry-to-bolster-fixed-wireless-in-multi-dwelling-units-taking-it-off-of-life-support/',
  '3GPP TR 38.901 §7.4.1 path loss and §7.4.3 O2I — https://itecspec.com/3gpp/38.901/s/7.4.1 ; https://itecspec.com/3gpp/38.901/s/7.4.3.1',
  'ITU-R P.833-10, Attenuation in vegetation — https://www.itu.int/rec/R-REC-P.833/en',
  'ITU-R P.2108, Prediction of clutter loss — https://www.itu.int/rec/R-REC-P.2108/en',
  'ITU-R P.838-3, rain attenuation model — https://www.itu.int/rec/R-REC-P.838/en',
  'ITS, The ITS Irregular Terrain Model v1.2.2: The Algorithm; itmlogic Python port (Oughton et al.) — https://github.com/edwardoughton/itmlogic',
  'USGS 3D Elevation Program, 1 arc-second DEM — https://www.usgs.gov/3d-elevation-program',
  'MRLC, National Land Cover Database 2021 — https://www.mrlc.gov/',
  'FCC Antenna Structure Registration weekly extract (r_tower.zip, 4 Oct 2026) — https://data.fcc.gov/download/pub/uls/complete/',
  'US Census Bureau, TIGER/Line 2023 (counties, places, roads, TABBLOCK20 with 2020 housing counts) — https://www2.census.gov/geo/tiger/',
  'Cell tower lease benchmarks (Q2 2026) — https://www.celltowerleaseexperts.com/cell-tower-lease/',
  'Ceragon, 70/80 GHz FCC link registration procedure — https://www.ceragon.com/70ghz-and-80ghz-fcc-link-registration-procedure/',
  'Fiber Broadband Association / Cartesian 2025 fiber deployment cost survey — https://secure.businesswire.com/news/home/20260120910286/en/',
  'Broadband Breakfast, Tennessee BEAD bid averages — https://broadbandbreakfast.com/analysis-leo-bids-average-886-per-location-in-tennessee-bead-round/',
  'Benton Institute, "Is fixed wireless ready for BEAD?" (rate cards, awards per location) — https://www.benton.org/blog/fixed-wireless-ready-bead',
  'NTIA, South Carolina BEAD Final Proposal overview; Telecompetitor on the 2026 scope reduction — https://broadbandusa.ntia.gov/sites/default/files/2025-12/BEAD_FP_Overview_SC.pdf ; https://www.telecompetitor.com/south-carolina-reduces-scope-of-bead-projects-eyes-construction-soon/',
  'Post and Courier, Spectrum and HTC expanding broadband in Georgetown County — https://www.postandcourier.com/georgetown/news/spectrum-htc-expanding-broadband-operations-georgetown-county/article_8b6f4a66-e6f0-11ee-9d48-cf9446d02500.html',
  'S&P Global Kagan, US broadband monthly churn 1.25% — https://www.spglobal.com/market-intelligence/en/news-insights/research/2026/02/us-broadband-monthly-churn-hits-one-point-three-percent',
  'OpenVault Q2 2026 usage report, via Advanced Television — https://www.advanced-television.com/2026/07/23/report-broadband-upstream-usage-up-20-yoy-in-q2/',
  'Preseem 2026 ISP Network Report, summary coverage — https://africanwirelesscomms.com/fixed-wireless-and-fibre-performance-hold-steady-as-demand-surges-2/',
  'Cambium Networks, "Plan for high capacity" (oversubscription planning) — https://www.cambiumnetworks.com/blog/plan-for-high-capacity/',
  'Tarana filing to the California PUC (Dec 2023) — https://docs.cpuc.ca.gov/PublishedDocs/Efile/G000/M521/K313/521313890.PDF',
  'Starlink US pricing 2026 and demand surcharges — https://starlink-news.com/2026/09/06/starlink-cost-in-2026-every-plan-and-price-by-country/ ; https://www.satelliteinternet.com/resources/starlink-congestion-surcharge/',
  'Ookla Starlink performance Q4 2025 / Q1 2026 — https://www.telecompetitor.com/starlink-nearing-full-fcc-broadband-compliance-ookla-report/ ; https://5gstore.com/blog/2026/05/05/starlink-speeds-130-mbps-cable-competitor/',
  'SpaceX 12 M Starlink customers; New Street Research 2.7 M US — https://finance.yahoo.com/markets/stocks/articles/spacex-starlink-surpasses-12m-customers-000951284.html ; https://broadbandbreakfast.com/study-with-2-7-million-subscribers-starlink-is-a-top-10-u-s-isp/',
  'Starlink $661M BEAD across 478,073 locations — https://finance.yahoo.com/news/starlink-track-receive-661-million-175955603.html',
  'Wireless Nerd, "Cambium\'s radios will outlive the company" — https://wirelessnerd.net/2026/09/14/cambium-s-radios-will-outlive-the-company-the-last-great/',
  'Tarana, "G1 head to head with the competition" (Michigan test) — https://taranawireless.com/g1-head-to-head-with-the-competition/',
  'BusinessWire, PhireLink BEAD grant with Tarana — https://secure.businesswire.com/news/home/20250227229706/en/',
  'Wisper ISP fee schedule (RN non-return $550, install $100) — https://wisperisp.com/fees/',
  'ISP Supplies (Canada), Tarana base node list — https://www.ispsupplies.ca/brands/tarana/tarana-base-nodes',
  'Light Reading, Tarana announces G1x2 — https://www.lightreading.com/broadband/tarana-announces-g1x2-wireless-with-unprecedented-economics-and-speed'
];

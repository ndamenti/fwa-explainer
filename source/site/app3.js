/* ===== geodata + maps ===== */
var GEO = null, L = { sites: [] }, GRID = null;
function loadImage(b64) { return new Promise(function (res, rej) { var im = new Image(); im.onload = function () { var c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; var cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(im, 0, 0); res(cx.getImageData(0, 0, c.width, c.height).data); }; im.onerror = rej; im.src = 'data:image/png;base64,' + b64; }); }
function loadGeo() {
  GEO = JSON.parse($('#geodata').textContent);
  var W = GEO.crop.w, H = GEO.crop.h;
  var jobs = [loadImage(GEO.nlcd), loadImage(GEO.housing)];
  GEO.sites.forEach(function (s) { jobs.push(loadImage(s.itm[0]), loadImage(s.itm[1]), loadImage(s.itm[2]), loadImage(s.depth), loadImage(s.los)); });
  return Promise.all(jobs).then(function (imgs) {
    var nl = imgs[0], hu = imgs[1]; L.cls = new Uint8Array(W * H); L.units = new Float32Array(W * H); L.county = new Uint8Array(W * H); L.huTotal = 0;
    for (var i = 0; i < W * H; i++) { L.cls[i] = nl[i * 4]; L.units[i] = (hu[i * 4] * 256 + hu[i * 4 + 1]) / 10; L.county[i] = hu[i * 4 + 2] > 127 ? 1 : 0; if (L.county[i]) L.huTotal += L.units[i]; }
    GEO.sites.forEach(function (s, k) { var b = 2 + k * 5; L.sites.push({ s: s, itm: [imgs[b], imgs[b + 1], imgs[b + 2]], depth: imgs[b + 3], los: imgs[b + 4] }); });
    L.W = W; L.H = H; L.dl = new Float32Array(W * H); L.ul = new Float32Array(W * H); L.src = new Int8Array(W * H);
  });
}
// which CPE variant to apply for the map/compare runs
function techVariant(id, cpe) {
  var t = FWA.clone(T(id));
  if (t.cpe === 'gateway' && t.layerF >= 0) { // MNO
    if (cpe === 'interior') { t.o2i = 'low'; } else if (cpe === 'lowe') { t.o2i = 'windowLowE'; } else if (cpe === 'outdoor') { t.cpe = 'panel'; t.cpeGain = 17; t.cpeComb = 3; t.cpeH = 6; t.o2i = 'none'; t.ulEirp = Math.max(t.ulEirp, 33); } else { t.o2i = 'window'; t.cpeH = 2; }
  } else if (t.layerF < 0) { if (cpe === 'outdoor') { t.o2i = 'none'; t.cpeH = 6; } else { t.cpeH = 2; } }
  else { t.cpeH = (cpe === 'h10') ? 10 : 6; }
  return t;
}
function cpeOptionsFor(id) {
  var t = FWA.TECH[id];
  if (t.cpe === 'gateway' && t.layerF >= 0) return [{ v: 'window', l: 'Window sill, 2 m' }, { v: 'interior', l: 'Interior, 2 m' }, { v: 'lowe', l: 'Low-E window' }, { v: 'outdoor', l: 'Outdoor 17 dBi, 6 m' }];
  if (t.layerF < 0) return [{ v: 'window', l: 'Window-mount, 2 m' }, { v: 'outdoor', l: 'Outdoor, 6 m' }];
  return [{ v: 'h6', l: '6 m (eave)' }, { v: 'h10', l: '10 m (pole)' }];
}
function defaultCpe(id) { return cpeOptionsFor(id)[0].v; }
// evaluate one tech over the grid for a set of sites → fills dl/ul/src arrays
function computeGrid(t, siteIdx, dl, ul, src) {
  var W = L.W, hi = FWA.LAYER_H.indexOf(t.cpeH); if (hi < 0) hi = 1;
  dl.fill(0); ul.fill(0); src.fill(-1);
  var RES = GEO.res, opts = S.opts, env = { dist: 0, itm: 0, depth: 0, los: true, cls: 0 };
  siteIdx.forEach(function (k) {
    var site = L.sites[k], s = site.s, itmImg = site.itm[hi], dep = site.depth, los = site.los;
    for (var ly = 0; ly < s.h; ly++) {
      var y = ly + s.r0, dy = (y - s.py) * RES;
      for (var lx = 0; lx < s.w; lx++) {
        var x = lx + s.c0, dx = (x - s.px) * RES, dist = Math.sqrt(dx * dx + dy * dy); if (dist > 25000) continue;
        var j = (ly * s.w + lx) * 4, gi = y * W + x;
        var raw = t.layerF < 0 ? 0 : itmImg[j + t.layerF]; if (t.layerF >= 0 && raw === 255) continue;
        env.dist = dist; env.itm = 70 + raw / 1.5; env.depth = dep[j + hi] * 10; env.los = los[j + hi] > 127; env.cls = L.cls[gi];
        var r = FWA.evalLink(t, env, opts);
        if (r.dl > dl[gi]) { dl[gi] = r.dl; ul[gi] = r.ul; src[gi] = k; }
      }
    }
  });
}
function siteIndices() { return S.map.site === 'all' ? [0, 1, 2] : [GEO.sites.findIndex(function (s) { return s.id === S.map.site; })]; }
var DL_T = [10, 25, 100, 300, 1000], UL_T = [3, 10, 20, 50, 100];
var RAMP = ['#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#0d366b'];
var RAMP_D = ['#1c5cab', '#2a78d6', '#3987e5', '#86b6ef', '#cde2fb'];
function isDark() { var dt = document.documentElement.getAttribute('data-theme'); if (dt) return dt === 'dark'; return matchMedia('(prefers-color-scheme: dark)').matches; }
function hex2rgb(hx) { var n = parseInt(hx.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function tierOf(v, th) { var k = -1; for (var i = 0; i < th.length; i++) if (v >= th[i]) k = i; return k; }
var MAPC = { dirty: true, timer: null };
function invalidateMap() { MAPC.dirty = true; if ($('#tab-maps').classList.contains('active')) scheduleMap(); }
function scheduleMap() { clearTimeout(MAPC.timer); MAPC.timer = setTimeout(renderMap, 60); }
function renderMap() {
  if (!GEO) return;
  var W = L.W, H = L.H, canvas = $('#mapCanvas'); canvas.width = W; canvas.height = H; var ctx = canvas.getContext('2d');
  var dark = isDark(), surf = hex2rgb(dark ? '#171d1a' : '#ffffff'), img = ctx.createImageData(W, H), d = img.data;
  var metric = S.map.metric, tech = S.map.tech;
  var statsRows = [];
  if (metric === 'best') {
    var best = new Int8Array(W * H).fill(-1), bestV = new Float32Array(W * H), tmpD = new Float32Array(W * H), tmpU = new Float32Array(W * H), tmpS = new Int8Array(W * H);
    FWA.ORDER.forEach(function (id, ti) { computeGrid(techVariant(id, defaultCpe(id)), siteIndices(), tmpD, tmpU, tmpS); for (var i = 0; i < W * H; i++) { var ok = tmpD[i] >= 100 && tmpU[i] >= 20; var v = ok ? Math.min(tmpD[i] / 100, tmpU[i] / 20) + 1000 : Math.min(tmpD[i] / 100, tmpU[i] / 20); if (v > bestV[i] && tmpD[i] >= 10) { bestV[i] = v; best[i] = ti; } } });
    MAPC.best = best; MAPC.bestV = bestV;
  } else {
    computeGrid(techVariant(tech, S.map.cpe), siteIndices(), L.dl, L.ul, L.src);
  }
  var ramp = (dark ? RAMP_D : RAMP).map(hex2rgb), techRGB = FWA.ORDER.map(function (id) { return hex2rgb(cssVar('--s' + FWA.TECH[id].color)); });
  var tierHU = [0, 0, 0, 0, 0, 0], tierKm = [0, 0, 0, 0, 0, 0], a = GEO.res * GEO.res / 1e6, hu1020 = 0, hu253 = 0, techHU = FWA.ORDER.map(function () { return 0; });
  for (var i = 0; i < W * H; i++) {
    var c = L.cls[i], base = FWA.NLCD[c] ? hex2rgb(FWA.NLCD[c].c) : surf, k = S.map.base === 'nlcd' ? 0.45 : 0.12;
    var r = surf[0] + (base[0] - surf[0]) * k, g = surf[1] + (base[1] - surf[1]) * k, b = surf[2] + (base[2] - surf[2]) * k;
    var col = null, alpha = 0.78;
    if (metric === 'best') { if (MAPC.best[i] >= 0) { col = techRGB[MAPC.best[i]]; alpha = MAPC.bestV[i] >= 1000 ? 0.85 : 0.35; if (L.county[i]) techHU[MAPC.best[i]] += L.units[i]; } }
    else {
      var v = metric === 'ul' ? L.ul[i] : L.dl[i], tier = metric === 'ul' ? tierOf(v, UL_T) : tierOf(L.dl[i], DL_T);
      if (metric === 'bead') { if (L.dl[i] >= 100 && L.ul[i] >= 20) { col = ramp[3]; } else if (L.dl[i] >= 25 && L.ul[i] >= 3) { col = ramp[0]; alpha = 0.7; } }
      else if (tier >= 0) col = ramp[tier];
      if (L.county[i] && L.dl[i] > 0) { var u = L.units[i]; if (tier >= 0) { tierHU[tier] += u; tierKm[tier] += a; } if (L.dl[i] >= 100 && L.ul[i] >= 20) hu1020 += u; if (L.dl[i] >= 25 && L.ul[i] >= 3) hu253 += u; }
    }
    if (col) { r = r + (col[0] - r) * alpha; g = g + (col[1] - g) * alpha; b = b + (col[2] - b) * alpha; }
    if (!L.county[i]) { r = r + (surf[0] - r) * 0.35; g = g + (surf[1] - g) * 0.35; b = b + (surf[2] - b) * 0.35; }
    d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  MAPC.dirty = false;
  // legend + stats
  var leg = $('#mpLegend'), st = $('#mpStats');
  if (metric === 'best') {
    leg.innerHTML = '<div class="legendkeys">' + FWA.ORDER.map(function (id) { return '<span><i class="swatch" style="background:' + techColor(id) + '"></i>' + FWA.TECH[id].short + '</span>'; }).join('') + '</div><div class="small">Strong fill: meets 100/20; faint fill: the best available is below 100/20. Each technology at its default CPE.</div>';
    $('#mpStatsTitle').textContent = 'Homes for which each technology is the best option';
    st.innerHTML = ''; var mx = Math.max.apply(null, techHU) || 1; FWA.ORDER.forEach(function (id, ti) { st.appendChild(h('div', { 'class': 'r' }, '<span>' + FWA.TECH[id].short + '</span><span class="b" style="width:' + (techHU[ti] / mx * 100) + '%;background:' + techColor(id) + '"></span><span class="n">' + fmtN(techHU[ti]) + '</span>')); });
  } else if (metric === 'bead') {
    leg.innerHTML = '<div class="legendkeys"><span><i class="swatch" style="background:' + (dark ? RAMP_D[3] : RAMP[3]) + '"></i>≥100/20 Mbps (BEAD "served")</span><span><i class="swatch" style="background:' + (dark ? RAMP_D[0] : RAMP[0]) + '"></i>25/3 to 100/20 (underserved)</span><span><i class="swatch" style="background:var(--surface2);border:1px solid var(--line2)"></i>below 25/3</span></div>';
    $('#mpStatsTitle').textContent = 'Homes by FCC/BEAD service class';
    st.innerHTML = ''; [['≥100/20', hu1020, 3], ['25/3–100/20', hu253 - hu1020, 0], ['Below 25/3 or none', L.huTotal - hu253, -1]].forEach(function (x) { st.appendChild(h('div', { 'class': 'r' }, '<span>' + x[0] + '</span><span class="b" style="width:' + (x[1] / L.huTotal * 100) + '%;background:' + (x[2] >= 0 ? (dark ? RAMP_D : RAMP)[x[2]] : 'var(--line2)') + '"></span><span class="n">' + fmtN(x[1]) + '</span>')); });
  } else {
    var th = metric === 'ul' ? UL_T : DL_T, labels = th.map(function (v, i) { return i < th.length - 1 ? v + '–' + th[i + 1] : '≥' + v; });
    leg.innerHTML = '<div class="small">' + (metric === 'ul' ? 'Uplink' : 'Downlink') + ' Mbps</div><div class="ramp">' + (dark ? RAMP_D : RAMP).map(function (c) { return '<span style="background:' + c + '"></span>'; }).join('') + '</div><div class="rampl">' + labels.map(function (l) { return '<span>' + l + '</span>'; }).join('') + '</div>';
    $('#mpStatsTitle').textContent = 'Homes by ' + (metric === 'ul' ? 'uplink' : 'downlink') + ' tier · ' + fmtN(hu1020) + ' at ≥100/20';
    st.innerHTML = ''; var served = tierHU.reduce(function (p, q) { return p + q; }, 0);
    labels.forEach(function (l, i) { st.appendChild(h('div', { 'class': 'r' }, '<span>' + l + ' Mbps</span><span class="b" style="width:' + (tierHU[i] / L.huTotal * 100) + '%;background:' + (dark ? RAMP_D : RAMP)[i] + '"></span><span class="n">' + fmtN(tierHU[i]) + '</span>')); });
    st.appendChild(h('div', { 'class': 'r' }, '<span>No service</span><span class="b" style="width:' + ((L.huTotal - served) / L.huTotal * 100) + '%;background:var(--line2)"></span><span class="n">' + fmtN(L.huTotal - served) + '</span>'));
  }
  drawOverlay();
  var tv = techVariant(tech, S.map.cpe);
  $('#mapCap').innerHTML = (metric === 'best' ? 'Best technology per cell' : FWA.TECH[tech].name + ' · ' + cpeOptionsFor(tech).filter(function (o) { return o.v === S.map.cpe; })[0].l + ' · ' + (tv.layerF < 0 ? 'free-space + clutter LOS' : 'ITM layer ' + FWA.LAYER_F[tv.layerF] + ' MHz, CPE ' + tv.cpeH + ' m')) + ' · ' + (S.opts.season === 'leafon' ? 'leaf-on' : 'leaf-off') + ' · fade ' + S.opts.fade + ' dB · clutter ×' + S.opts.clutterScale.toFixed(2) + ' · 90 m cells · ' + (S.map.site === 'all' ? 'three sites, best server' : 'single site') + '. Rings at 5, 10 and 25 km.';
}
function drawOverlay() {
  var svg = $('#mapOv'), W = L.W, H = L.H; svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.innerHTML = '';
  var g = el('g', {}, svg);
  GEO.county.forEach(function (ring) { el('path', { d: 'M' + ring.map(function (p) { return p[0] + ',' + p[1]; }).join('L') + 'Z', fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1.4, 'stroke-opacity': .8 }, g); });
  GEO.roads.forEach(function (r) { el('path', { d: 'M' + r.pts.map(function (p) { return p[0] + ',' + p[1]; }).join('L'), fill: 'none', stroke: 'var(--ink)', 'stroke-width': r.cls === 'S1100' ? 1.2 : 0.6, 'stroke-opacity': r.cls === 'S1100' ? .55 : .35 }, g); });
  GEO.places.forEach(function (p) { if (p.area < 2 && ['Hemingway', 'Andrews', 'Pawleys Island'].indexOf(p.name) < 0) return; el('text', { x: p.px, y: p.py, 'font-size': 11, 'text-anchor': 'middle', fill: 'var(--ink)', 'font-family': 'var(--mono)', 'paint-order': 'stroke', stroke: 'var(--surface)', 'stroke-width': 3, 'stroke-opacity': .7, text: p.name }, g); });
  var idx = siteIndices();
  GEO.sites.forEach(function (s, k) { var on = idx.indexOf(k) >= 0; [5000, 10000, 25000].forEach(function (rm) { if (on) el('circle', { cx: s.px, cy: s.py, r: rm / GEO.res, fill: 'none', stroke: 'var(--ink)', 'stroke-width': .7, 'stroke-opacity': rm === 25000 ? .5 : .3, 'stroke-dasharray': rm === 25000 ? '' : '3 3' }, g); }); el('circle', { cx: s.px, cy: s.py, r: 5, fill: on ? 'var(--ink)' : 'var(--muted)', stroke: 'var(--surface)', 'stroke-width': 2 }, g); el('text', { x: s.px + 8, y: s.py - 7, 'font-size': 12, 'font-weight': 700, fill: 'var(--ink)', 'paint-order': 'stroke', stroke: 'var(--surface)', 'stroke-width': 3, 'stroke-opacity': .8, text: s.id + ' · ' + s.ht + ' m' }, g); });
  el('g', { id: 'ovCursor' }, svg);
}
function utmToLatLon(x, y) { var k0 = 0.9996, a = 6378137, f = 1 / 298.257223563, e2 = f * (2 - f), ep2 = e2 / (1 - e2), lon0 = -81 * Math.PI / 180; x -= 500000; var M = y / k0, mu = M / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256)), e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2)); var p1 = mu + (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32) * Math.sin(2 * mu) + (21 * e1 * e1 / 16 - 55 * Math.pow(e1, 4) / 32) * Math.sin(4 * mu) + 151 * Math.pow(e1, 3) / 96 * Math.sin(6 * mu); var sp = Math.sin(p1), cp = Math.cos(p1), tp = Math.tan(p1); var N1 = a / Math.sqrt(1 - e2 * sp * sp), T1 = tp * tp, C1 = ep2 * cp * cp, R1 = a * (1 - e2) / Math.pow(1 - e2 * sp * sp, 1.5), D = x / (N1 * k0); var lat = p1 - (N1 * tp / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * Math.pow(D, 4) / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * Math.pow(D, 6) / 720); var lon = lon0 + (D - (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * Math.pow(D, 5) / 120) / cp; return [lat * 180 / Math.PI, lon * 180 / Math.PI]; }
function mapHover(ev) {
  if (!GEO || MAPC.dirty) return;
  var box = $('#mapCanvas').getBoundingClientRect(); var x = Math.floor((ev.clientX - box.left) / box.width * L.W), y = Math.floor((ev.clientY - box.top) / box.height * L.H);
  if (x < 0 || y < 0 || x >= L.W || y >= L.H) return;
  var gi = y * L.W + x, cls = L.cls[gi]; var ox = GEO.crop.c0, oy = GEO.crop.r0;
  var utmX = 594270 + (x + ox + 0.5) * 90, utmY = 3756420 - (y + oy + 0.5) * 90, ll = utmToLatLon(utmX, utmY);
  var cur = $('#ovCursor'); cur.innerHTML = ''; el('rect', { x: x - 1, y: y - 1, width: 3, height: 3, fill: 'none', stroke: 'var(--critical)', 'stroke-width': 1.2 }, cur);
  var tech = S.map.metric === 'best' ? (MAPC.best && MAPC.best[gi] >= 0 ? FWA.ORDER[MAPC.best[gi]] : S.map.tech) : S.map.tech;
  var t = techVariant(tech, S.map.metric === 'best' ? defaultCpe(tech) : S.map.cpe), hi = FWA.LAYER_H.indexOf(t.cpeH); if (hi < 0) hi = 1;
  var best = null, bestSite = null;
  siteIndices().forEach(function (k) { var site = L.sites[k], s = site.s, lx = x - s.c0, ly = y - s.r0; if (lx < 0 || ly < 0 || lx >= s.w || ly >= s.h) return; var dist = Math.hypot((x - s.px) * 90, (y - s.py) * 90); if (dist > 25000) return; var j = (ly * s.w + lx) * 4; var raw = site.itm[hi][j + Math.max(t.layerF, 0)]; if (t.layerF >= 0 && raw === 255) return; var env = { dist: dist, itm: 70 + raw / 1.5, depth: site.depth[j + hi] * 10, los: site.los[j + hi] > 127, cls: cls }; var r = FWA.evalLink(t, env, S.opts); r.env = env; if (!best || r.dl > best.dl) { best = r; bestSite = s; } });
  var txt = ll[0].toFixed(4) + ', ' + ll[1].toFixed(4) + (L.county[gi] ? '' : ' (outside county)') + '\n' + (FWA.NLCD[cls] ? FWA.NLCD[cls].n : 'n/a') + ' · ' + (L.units[gi] > 0 ? L.units[gi].toFixed(1) + ' HU/cell' : 'no housing') + '\n' + FWA.TECH[tech].short;
  if (!best) txt += '\nOut of range of the selected site(s)';
  else { var e = best.env; txt += ' via ' + bestSite.id + ' · ' + (e.dist / 1000).toFixed(1) + ' km\n' + (t.layerF < 0 ? 'FSPL+gas+rain ' + (FWA.fspl(e.dist, t.fMHz) + (t.gas || 0) * e.dist / 1000 + (t.rain || 0)).toFixed(1) : 'ITM terrain ' + (e.itm + 20 * Math.log10(t.fMHz / FWA.LAYER_F[t.layerF])).toFixed(1)) + ' dB · foliage ' + e.depth + ' m → ' + FWA.foliageLoss(e.depth, t.fMHz, cls, S.opts).toFixed(1) + ' dB\nbuilding ' + FWA.bldgLoss(cls, t.fMHz, t.cpeH, S.opts).toFixed(1) + ' · O2I ' + FWA.o2iLoss(t.o2i, t.fMHz).toFixed(1) + ' · NLOS pen ' + best.pen + ' · ' + (e.los ? 'clutter LOS' : 'obstructed') + '\ntotal path loss ' + best.L.toFixed(1) + ' dB\nSINR DL ' + best.snrDl.toFixed(1) + ' / UL ' + best.snrUl.toFixed(1) + ' dB\nrate DL ' + fmtN(best.dl) + ' / UL ' + fmtN(best.ul) + ' Mbps'; }
  $('#mpRead').textContent = txt;
}
function initMaps() {
  seg($('#mpSite'), [{ v: 'all', l: 'All three' }].concat(GEO.sites.map(function (s) { return { v: s.id, l: s.id + ' · ' + s.name.split(' — ')[0] }; })), S.map.site, function (v) { S.map.site = v; scheduleMap(); });
  seg($('#mpTech'), FWA.ORDER.map(function (id) { return { v: id, l: FWA.TECH[id].short, color: techColor(id) }; }), S.map.tech, function (v) { S.map.tech = v; S.map.cpe = defaultCpe(v); renderCpeSeg(); scheduleMap(); });
  seg($('#mpMetric'), [{ v: 'dl', l: 'Downlink Mbps' }, { v: 'ul', l: 'Uplink Mbps' }, { v: 'bead', l: '100/20 served' }, { v: 'best', l: 'Best technology' }], S.map.metric, function (v) { S.map.metric = v; $('#mpCpeWrap').hidden = v === 'best'; scheduleMap(); });
  function renderCpeSeg() { seg($('#mpCpe'), cpeOptionsFor(S.map.tech), S.map.cpe, function (v) { S.map.cpe = v; scheduleMap(); }); }
  renderCpeSeg();
  seg($('#mpSeason'), [{ v: 'leafon', l: 'Leaf-on' }, { v: 'leafoff', l: 'Leaf-off' }], S.opts.season, function (v) { S.opts.season = v; syncSeasonUI(); renderClutter(); scheduleMap(); });
  bindRange('mpFade', 'mpFadeO', function (v) { return v + ' dB'; }, function (v) { S.opts.fade = v; LBC.fade.set(v); scheduleMap(); });
  bindRange('mpScale', 'mpScaleO', function (v) { return Math.round(v * 100) + '%'; }, function (v) { S.opts.clutterScale = v; $('#clScale').value = v; $('#clScaleO').textContent = Math.round(v * 100) + '%'; renderClutter(); scheduleMap(); });
  seg($('#mpBase'), [{ v: 'nlcd', l: 'Land cover' }, { v: 'plain', l: 'Plain' }], S.map.base, function (v) { S.map.base = v; scheduleMap(); });
  var mb = $('#mapbox'); mb.addEventListener('mousemove', mapHover); mb.addEventListener('click', mapHover);
  $('#mpCompare').addEventListener('click', compareAll);
  var html = '<thead><tr><th>Site</th><th>FCC ASR</th><th>Owner</th><th class="num">Structure</th><th class="num">Radio centre</th><th class="num">Ground</th><th>Location</th><th>Why this site</th></tr></thead><tbody>';
  var why = { GT: 'Town, Winyah Bay, salt marsh and the Waccamaw Neck across the water: open paths over water, dense trees on land.', PV: 'Mid-county pine plantation and Pee Dee swamp forest along US 701; the tallest structure, mounted at 90 m.', HW: 'The county\'s farm-and-small-town corner: the most cropland of any site, otherwise swamp forest.' };
  GEO.sites.forEach(function (s) { html += '<tr><td><b>' + s.id + '</b> ' + s.name + '</td><td class="mono">' + s.asr + '</td><td>' + s.owner + '</td><td class="num">' + s.tower_m + ' m</td><td class="num">' + s.ht + ' m</td><td class="num">' + s.ground_m + ' m</td><td class="mono">' + s.lat.toFixed(4) + ', ' + s.lon.toFixed(4) + '</td><td>' + why[s.id] + '</td></tr>'; });
  $('#siteTbl').innerHTML = html + '</tbody>';
  document.addEventListener('tabshown', function (e) { if (e.detail === 'maps' && MAPC.dirty) scheduleMap(); });
  if (matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { invalidateMap(); });
  new MutationObserver(function () { invalidateMap(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}
// stats for one tech variant over given sites: returns {hu1020, hu253, huAny, km1020, tiers[]}
function statsFor(t, siteIdx, dl, ul, src) {
  dl = dl || new Float32Array(L.W * L.H); ul = ul || new Float32Array(L.W * L.H); src = src || new Int8Array(L.W * L.H);
  computeGrid(t, siteIdx, dl, ul, src);
  var o = { hu1020: 0, hu253: 0, huAny: 0, km1020: 0, tiers: [0, 0, 0, 0, 0] }, a = GEO.res * GEO.res / 1e6;
  for (var i = 0; i < L.W * L.H; i++) { if (!L.county[i]) continue; var u = L.units[i]; if (dl[i] >= 10) { o.huAny += u; o.tiers[tierOf(dl[i], DL_T)] += u; } if (dl[i] >= 25 && ul[i] >= 3) o.hu253 += u; if (dl[i] >= 100 && ul[i] >= 20) { o.hu1020 += u; o.km1020 += a; } }
  return o;
}
function compareAll() {
  var card = $('#mpCompareCard'); card.hidden = false; var tbl = $('#mpCompareTbl'); tbl.innerHTML = '<tbody><tr><td>Computing…</td></tr></tbody>';
  setTimeout(function () {
    var rows = []; var idx = siteIndices();
    FWA.ORDER.forEach(function (id) { cpeOptionsFor(id).forEach(function (o, k) { if (k > 1 && id !== 'mno_cband') return; var st = statsFor(techVariant(id, o.v), idx); rows.push([id, o.l, st]); }); });
    var html = '<thead><tr><th>Technology</th><th>CPE</th><th class="num">Homes ≥100/20</th><th class="num">Share of county</th><th class="num">Homes ≥25/3</th><th class="num">Homes any service</th><th class="num">km² ≥100/20</th></tr></thead><tbody>';
    rows.forEach(function (r) { html += '<tr><td><span class="swatch" style="background:' + techColor(r[0]) + '"></span> ' + FWA.TECH[r[0]].short + '</td><td>' + r[1] + '</td><td class="num">' + fmtN(r[2].hu1020) + '</td><td class="num">' + (r[2].hu1020 / L.huTotal * 100).toFixed(1) + '%</td><td class="num">' + fmtN(r[2].hu253) + '</td><td class="num">' + fmtN(r[2].huAny) + '</td><td class="num">' + fmtN(r[2].km1020) + '</td></tr>'; });
    tbl.innerHTML = html + '</tbody>';
  }, 30);
}

/* ===== hero numbers and figures ===== */
var HERO = {};
function computeHero(done) {
  var tiles = $('#heroTiles'); tiles.innerHTML = ''; var dl = new Float32Array(L.W * L.H), ul = new Float32Array(L.W * L.H), src = new Int8Array(L.W * L.H);
  var inRange = 0; for (var i = 0; i < L.W * L.H; i++) if (L.county[i]) { var x = i % L.W, y = (i / L.W) | 0; var ok = GEO.sites.some(function (s) { return Math.hypot((x - s.px) * 90, (y - s.py) * 90) <= 25000; }); if (ok) inRange += L.units[i]; }
  $('#heroHU').textContent = fmtN(L.huTotal); $('#heroInRange').textContent = fmtN(inRange);
  var queue = FWA.ORDER.slice(); HERO.stats = {};
  function step() {
    if (!queue.length) { HERO.stats.mno_out = statsFor(techVariant('mno_cband', 'outdoor'), [0, 1, 2], dl, ul, src); HERO.stats.tarana10 = statsFor(techVariant('tarana_cbrs', 'h10'), [0, 1, 2], dl, ul, src); HERO.stats.nr10 = statsFor(techVariant('cbrs_nr', 'h10'), [0, 1, 2], dl, ul, src); renderHero(); if (done) done(); return; }
    var id = queue.shift(); HERO.stats[id] = statsFor(techVariant(id, defaultCpe(id)), [0, 1, 2], dl, ul, src);
    tiles.appendChild(h('div', { 'class': 'tile' }, '<div class="k"><i class="swatch" style="background:' + techColor(id) + '"></i>' + FWA.TECH[id].short + '</div><div class="v">' + fmtK(HERO.stats[id].hu1020) + '</div><div class="l">' + (HERO.stats[id].hu1020 / L.huTotal * 100).toFixed(0) + '% of county homes · ' + fmtN(HERO.stats[id].km1020) + ' km²</div>'));
    setTimeout(step, 10);
  }
  step();
}
var KEY = {
  mno_cband: ['MNO macro FWA, C-band', 'T-Mobile / Verizon / AT&T-style home internet from an existing mobile macro tower: 64T64R massive-MIMO sector, 100 MHz at 3.7 GHz (band n77).', 'Indoor Wi-Fi gateway the customer puts on a window sill, 2 m up, self-installed.'],
  mno_n41: ['MNO macro FWA, 2.5 GHz', 'Same as above but on T-Mobile\'s 2.5 GHz spectrum (band n41); lower frequency, less loss through trees and walls.', 'Same indoor gateway on a window sill.'],
  mmwave: ['mmWave 5G FWA, 28 GHz', 'Verizon 5G Home-style millimetre wave (band n261), 400 MHz channel. Modelled from the same tower top, its best case.', 'Window-mounted phased-array receiver, 2 m up.'],
  cbrs_nr: ['Dedicated 5G NR in CBRS', 'A WISP-grade standard 3GPP 5G radio on a leased tower, 40 MHz shared (GAA) channel at 3.6 GHz, Category B power (47 dBm/10 MHz), 4T4R with a 17 dBi sector antenna.', 'Outdoor 17 dBi panel at the eave, 6 m up, professionally installed.'],
  tarana_cbrs: ['Tarana on CBRS', 'Tarana G1 or G2 Base Node (BN) using two 40 MHz CBRS carriers at 3.6 GHz; 16-chain distributed massive MIMO, 48.5 dBm per carrier (FCC grant). G1 BN-3 and G2 behave the same for coverage; G2 adds capacity.', 'Tarana Remote Node (RN), an 8-chain outdoor array, at the eave, 6 m up, professionally installed.'],
  tarana_5: ['Tarana on 5 GHz unlicensed', 'Tarana G1 BN-5 using two 40 MHz carriers in the 5 GHz UNII-1/3 bands (5.15–5.25 and 5.725–5.85 GHz). Unlicensed point-to-multipoint is capped at 36 dBm EIRP for the whole radio, so 33 dBm per carrier, and the band is shared with Wi-Fi. This is where most of the G1 installed base runs; G2 covers 5.7–5.9 GHz too. Licensed 3.3–3.8 GHz variants exist outside the US.', 'Tarana Remote Node (RN-5) at the eave, 6 m up.'],
  tarana_6: ['Tarana on 6 GHz', 'Same Tarana BN family (G1 BN-6 in "x2" mode, or G2) using four 40 MHz carriers in the 6 GHz unlicensed band under AFC: four times the spectrum, but the whole radio is capped at 36 dBm EIRP (30 dBm per carrier).', 'Tarana Remote Node (RN-6 or RNm) at the eave, 6 m up.']
};
function buildKeyTable() {
  var html = '<thead><tr><th>Configuration</th><th>What it is</th><th>Customer equipment (standard placement)</th></tr></thead><tbody>';
  FWA.ORDER.forEach(function (id) { var k = KEY[id]; html += '<tr><td style="white-space:nowrap"><span class="swatch" style="background:' + techColor(id) + '"></span> <b>' + FWA.TECH[id].short + '</b><br><span class="muted">' + k[0] + '</span></td><td>' + k[1] + '</td><td>' + k[2] + '</td></tr>'; });
  $('#keyTbl').innerHTML = html + '</tbody>';
}
function renderHero() {
  var st = HERO.stats;
  $('#vTaranaVsNr').textContent = Math.round((st.tarana_cbrs.hu1020 / st.cbrs_nr.hu1020 - 1) * 100) + '% (' + fmtK(st.tarana_cbrs.hu1020) + ' vs ' + fmtK(st.cbrs_nr.hu1020) + ')';
  $('#vTarana10').textContent = fmtN(st.tarana10.hu1020 - st.tarana_cbrs.hu1020) + ' homes';
  hbars($('#chartHero'), { rows: FWA.ORDER.map(function (id) { var s = st[id]; return { label: FWA.TECH[id].short, segs: [{ v: s.hu1020, color: techColor(id), name: 'Homes at ≥100/20', text: fmtN(s.hu1020) + ' homes (' + Math.round(s.hu1020 / L.huTotal * 100) + '% of county)' }] }; }), labelW: 130, rowH: 26, max: L.huTotal * 0.75, tickFmt: fmtK, xlabel: 'Homes at ≥100 Mbps down / 20 Mbps up' });
  var html = '<thead><tr><th>Configuration</th><th class="num">Served (≥100/20)</th><th class="num">Underserved (25/3 to 100/20)</th><th class="num">Connects below 25/3</th><th class="num">No service</th><th class="num">km² at ≥100/20</th></tr></thead><tbody>';
  FWA.ORDER.forEach(function (id) { var s = st[id]; var pct = function (v) { return fmtN(v) + ' <span class="muted">(' + Math.round(v / L.huTotal * 100) + '%)</span>'; }; html += '<tr><td><span class="swatch" style="background:' + techColor(id) + '"></span> ' + FWA.TECH[id].short + '</td><td class="num">' + pct(s.hu1020) + '</td><td class="num">' + pct(Math.max(0, s.hu253 - s.hu1020)) + '</td><td class="num">' + pct(Math.max(0, s.huAny - s.hu253)) + '</td><td class="num">' + pct(Math.max(0, L.huTotal - s.huAny)) + '</td><td class="num">' + fmtN(s.km1020) + '</td></tr>'; });
  $('#heroTbl').innerHTML = html + '</tbody>';
  var pairs = [['mno_cband', 'Indoor gateway on a window sill, 2 m', st.mno_cband.hu1020, 'Outdoor 17 dBi panel at the eave, 6 m (a WISP-style install)', st.mno_out.hu1020], ['cbrs_nr', 'Outdoor panel at the eave, 6 m', st.cbrs_nr.hu1020, 'Outdoor panel on a 10 m pole', st.nr10.hu1020], ['tarana_cbrs', 'Remote Node at the eave, 6 m', st.tarana_cbrs.hu1020, 'Remote Node on a 10 m pole', st.tarana10.hu1020]];
  html = '<thead><tr><th>Configuration</th><th>Standard placement</th><th class="num">Homes at 100/20</th><th>Alternative placement</th><th class="num">Homes at 100/20</th><th class="num">Change</th></tr></thead><tbody>';
  pairs.forEach(function (p) { html += '<tr><td style="white-space:nowrap"><span class="swatch" style="background:' + techColor(p[0]) + '"></span> ' + FWA.TECH[p[0]].short + '</td><td>' + p[1] + '</td><td class="num">' + fmtN(p[2]) + '</td><td>' + p[3] + '</td><td class="num">' + fmtN(p[4]) + '</td><td class="num">+' + fmtN(p[4] - p[2]) + ' (+' + Math.round((p[4] / p[2] - 1) * 100) + '%)</td></tr>'; });
  $('#cpeTbl').innerHTML = html + '</tbody>';
}

/* ===== land cover figure ===== */
function buildLandcover() {
  var groups = [['Water & marsh', [11, 95], '#6fa8dc'], ['Developed', [21, 22, 23, 24], '#c45f4a'], ['Pine forest', [42], '#2f7a3d'], ['Swamp forest', [90], '#7fb3a6'], ['Other forest & shrub', [41, 43, 52], '#8fc27a'], ['Crops, pasture, grass, barren', [71, 81, 82, 31], '#dcd45a']];
  var rows = GEO.sites.map(function (s) { var cnt = {}; var tot = 0; for (var y = s.r0; y < s.r0 + s.h; y++) for (var x = s.c0; x < s.c0 + s.w; x++) { if (Math.hypot((x - s.px) * 90, (y - s.py) * 90) > 25000) continue; var c = L.cls[y * L.W + x]; cnt[c] = (cnt[c] || 0) + 1; tot++; } return { label: s.id + ' · area within 25 km', segs: groups.map(function (g) { return { v: g[1].reduce(function (p, c) { return p + (cnt[c] || 0); }, 0) / tot * 100, color: g[2], name: g[0] }; }) }; });
  var hu = {}; for (var i = 0; i < L.W * L.H; i++) if (L.county[i]) hu[L.cls[i]] = (hu[L.cls[i]] || 0) + L.units[i];
  rows.push({ label: 'County housing units by class', segs: groups.map(function (g) { return { v: g[1].reduce(function (p, c) { return p + (hu[c] || 0); }, 0) / L.huTotal * 100, color: g[2], name: g[0] }; }) });
  hbars($('#chartLandcover'), { stacked: true, rows: rows, labelW: 200, rowH: 24, max: 100, tickFmt: function (v) { return v + '%'; }, valFmt: function (v) { return v.toFixed(1) + '%'; }, legend: groups.map(function (g) { return { color: g[2], name: g[0] }; }) });
}

/* ===== economics ===== */
var ECON = {
  mno_cband: { sectors: 3, radio: 0, cap: 0.4, cpe: 275, install: 0, label: 'MNO C-band (fallow share of 3 sectors)' },
  mno_n41: { sectors: 3, radio: 0, cap: 0.4, cpe: 275, install: 0, label: 'MNO n41 (fallow share of 3 sectors)' },
  mmwave: { sectors: 1, radio: 25000, cap: 1.5, cpe: 300, install: 150, label: 'mmWave node' },
  cbrs_nr: { sectors: 4, radio: 9000, cap: 0.2, cpe: 350, install: 250, label: 'CBRS 5G NR, 4 sectors' },
  tarana_cbrs: { sectors: 4, radio: 24470, cap: 1.92, cpe: 1290, install: 250, label: 'Tarana G1 BN-3, 4 BNs' },
  tarana_g2: { sectors: 4, radio: 38640, cap: 5.12, cpe: 1460, install: 250, label: 'Tarana G2, 4 BNs (RNm)', color: 2 },
  tarana_5: { sectors: 4, radio: 21400, cap: 1.92, cpe: 1130, install: 250, label: 'Tarana G1 BN-5 (5 GHz), 4 BNs' },
  tarana_6: { sectors: 4, radio: 21410, cap: 2.56, cpe: 1180, install: 250, label: 'Tarana G1 BN-6 ×2 mode, 4 BNs' }
};
var EC = { pass: 2000, take: 25, arpu: 65, bh: 5.2, lease: 800, bh2: 2000, site: 25000, opex: 16, churn: 15 };
function initEcon() {
  seg($('#ecPassMode'), [{ v: 'model', l: 'From coverage model (Tarana CBRS, 3 sites ÷ 3)' }, { v: 'manual', l: 'Manual' }], S.ec.mode, function (v) { S.ec.mode = v; renderEcon(); });
  bindRange('ecPass', 'ecPassO', fmtN, function (v) { EC.pass = v; S.ec.mode = 'manual'; $$('#ecPassMode button').forEach(function (b, i) { b.setAttribute('aria-pressed', String(i === 1)); }); renderEcon(); });
  bindRange('ecTake', 'ecTakeO', function (v) { return v + '%'; }, function (v) { EC.take = v; renderEcon(); });
  bindRange('ecArpu', 'ecArpuO', function (v) { return '$' + v; }, function (v) { EC.arpu = v; renderEcon(); });
  bindRange('ecBh', 'ecBhO', function (v) { return v.toFixed(1); }, function (v) { EC.bh = v; renderEcon(); });
  bindRange('ecLease', 'ecLeaseO', function (v) { return '$' + fmtN(v); }, function (v) { EC.lease = v; renderEcon(); });
  bindRange('ecBh2', 'ecBh2O', function (v) { return '$' + fmtN(v); }, function (v) { EC.bh2 = v; renderEcon(); });
  bindRange('ecSite', 'ecSiteO', function (v) { return '$' + fmtN(v); }, function (v) { EC.site = v; renderEcon(); });
  bindRange('ecOpex', 'ecOpexO', function (v) { return '$' + v; }, function (v) { EC.opex = v; renderEcon(); });
  bindRange('ecChurn', 'ecChurnO', function (v) { return v + '%'; }, function (v) { EC.churn = v; renderEcon(); });
  renderEcon();
}
function renderEcon() {
  var pass = EC.pass; if (S.ec.mode === 'model' && HERO.stats && HERO.stats.tarana_cbrs) { pass = Math.round(HERO.stats.tarana_cbrs.hu1020 / 3 / 100) * 100; $('#ecPass').value = pass; $('#ecPassO').textContent = fmtN(pass); }
  var ids = ['mno_cband', 'cbrs_nr', 'tarana_cbrs', 'tarana_g2', 'tarana_5', 'tarana_6', 'mmwave'];
  var rows = [], html = '<thead><tr><th>Site build</th><th class="num">Site capex</th><th class="num">Capex / passing</th><th class="num">Subs at take</th><th class="num">Busy-hour capacity (subs)</th><th class="num">Capex / sub</th><th class="num">Contribution / sub / mo</th><th class="num">Payback</th></tr></thead><tbody>';
  ids.forEach(function (id) {
    var e = ECON[id], base = id === 'tarana_g2' ? 'tarana_cbrs' : id;
    var sitePass = id === 'mmwave' ? Math.min(pass, 150) : pass;     // mmWave footprint is a few hundred metres
    var siteCapex = e.sectors * e.radio + (e.radio ? EC.site : 0);
    var subs = sitePass * EC.take / 100, capSubs = e.cap * e.sectors * 1000 / EC.bh * 0.8; // 0.8 = scheduler/peak-to-mean efficiency
    var served = Math.min(subs, capSubs); if (served < 1) served = 1;
    var fixedPerSub = e.radio ? (EC.lease + EC.bh2) / served : 0;
    var churnCost = EC.churn / 100 * (e.cpe + e.install) / 12;
    var contrib = EC.arpu - EC.opex - fixedPerSub - churnCost;
    var capexSub = siteCapex / served + e.cpe + e.install;
    var payback = contrib > 0 ? capexSub / contrib : Infinity;
    rows.push({ id: id, label: e.label, capexSub: capexSub, capexPass: siteCapex / sitePass, subs: subs, capSubs: capSubs, color: techColor(base) });
    html += '<tr><td><span class="swatch" style="background:' + techColor(base) + '"></span> ' + e.label + (served < subs ? ' <span class="tag c" title="capacity-bound">cap</span>' : '') + '</td><td class="num">' + fmtMoney(siteCapex) + '</td><td class="num">' + (e.radio ? fmtMoney(siteCapex / sitePass) : 'n/a') + '</td><td class="num">' + fmtN(subs) + '</td><td class="num">' + fmtN(capSubs) + '</td><td class="num">' + fmtMoney(capexSub) + '</td><td class="num">' + fmtMoney(contrib) + '</td><td class="num">' + (isFinite(payback) ? fmtN(payback, 1) + ' mo' : '—') + '</td></tr>';
  });
  html += '<tr><td>Starlink (operator view: no site; consumer kit)</td><td class="num">—</td><td class="num">$1,383 BEAD avg / loc</td><td class="num">—</td><td class="num">per-cell</td><td class="num">$349 kit</td><td class="num">—</td><td class="num">—</td></tr>';
  html += '<tr><td>Fiber, aerial, 10 locations/mile, 45% take (FBA 2025 medians + $700 drop)</td><td class="num">—</td><td class="num">$4,224</td><td class="num">' + fmtN(pass * 0.45) + '</td><td class="num">unconstrained</td><td class="num">' + fmtMoney(4224 / 0.45 + 700) + '</td><td class="num">—</td><td class="num">—</td></tr>';
  $('#econTbl').innerHTML = html + '</tbody>';
  hbars($('#chartCapex'), { title: 'Capital cost per subscriber at ' + EC.take + '% take, ' + fmtN(pass) + ' passings per site', labelW: 230, rowH: 16, tickFmt: function (v) { return '$' + fmtK(v); }, valFmt: function (v) { return fmtMoney(v); }, rows: rows.map(function (r) { return { label: r.label, segs: [{ v: r.capexSub, color: r.color, name: 'Capex per subscriber' }] }; }).concat([{ label: 'Fiber aerial (per sub at 45% take + $700 drop)', segs: [{ v: 4224 / 0.45 + 700, color: 'var(--ink2)', name: 'Fiber' }] }, { label: 'Starlink BEAD subsidy per location', segs: [{ v: 1383, color: sc(0), name: 'Starlink' }] }]) });
  hbars($('#chartCapacity'), { title: 'Subscribers per site: footprint at take rate vs busy-hour capacity (' + EC.bh + ' Mbps/sub)', labelW: 230, rowH: 14, rows: rows.map(function (r) { return { label: r.label, segs: [{ v: r.subs, color: r.color, name: 'Subscribers from footprint' }, { v: r.capSubs, color: 'var(--line2)', name: 'Busy-hour capacity' }] }; }), legend: [{ color: 'var(--ink2)', name: 'Footprint × take rate (series colour)' }, { color: 'var(--line2)', name: 'Busy-hour capacity' }] });
}

/* ===== boot ===== */
document.addEventListener('DOMContentLoaded', function () {
  initTabs(); buildKeyTable(); buildMatrix(); buildOthers(); buildYard(); buildMissing(); buildGloss(); buildParams(); buildSpectrum(); buildDiagrams(); buildWaterfall(); initLinkBudget(); initClutter(); initEcon();
  var v = document.body.getAttribute('data-ver') || 'v1'; $('#ver').textContent = v; $('#ver2').textContent = v;
  $('#heroTiles').innerHTML = '<div class="tile"><div class="l">Decoding terrain layers…</div></div>';
  loadGeo().then(function () { initMaps(); buildLandcover(); computeHero(function () { renderEcon(); }); if ($('#tab-maps').classList.contains('active')) scheduleMap(); }).catch(function (e) { $('#heroTiles').innerHTML = '<div class="tile"><div class="l">Map layers failed to load: ' + e + '</div></div>'; });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { if (HERO.stats) renderHero(); });
});

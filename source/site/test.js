// node-side validation of the model against the packed geodata
const fs = require('fs'); const { PNG } = require('pngjs'); const FWA = require('./model.js');
const G = JSON.parse(fs.readFileSync(process.argv[2] || '../geo/geodata.json'));
function dec(b64) { const p = PNG.sync.read(Buffer.from(b64, 'base64')); return p; }
const nl = dec(G.nlcd), hu = dec(G.housing);
const W = G.crop.w, H = G.crop.h, RES = G.res;
const sites = G.sites.map(s => ({ s, itm: s.itm.map(dec), depth: dec(s.depth), los: dec(s.los) }));
const cls = new Uint8Array(W * H), units = new Float32Array(W * H), inCounty = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) { cls[i] = nl.data[i * 4]; units[i] = (hu.data[i * 4] * 256 + hu.data[i * 4 + 1]) / 10; inCounty[i] = hu.data[i * 4 + 2] > 127 ? 1 : 0; }
let huTot = 0; for (let i = 0; i < W * H; i++) if (inCounty[i]) huTot += units[i];
console.log('grid', W, H, 'county HU', huTot.toFixed(0));

function envAt(site, t, x, y) {       // x,y in crop pixel coords
  const s = site.s, lx = x - s.c0, ly = y - s.r0;
  if (lx < 0 || ly < 0 || lx >= s.w || ly >= s.h) return null;
  const dist = Math.hypot((x - s.px) * RES, (y - s.py) * RES); if (dist > 25000) return null;
  const hi = FWA.LAYER_H.indexOf(t.cpeH); const j = (ly * s.w + lx) * 4;
  const itm = t.layerF < 0 ? null : 70 + site.itm[hi].data[j + t.layerF] / 1.5;
  if (itm !== null && site.itm[hi].data[j + t.layerF] === 255) return null;
  return { dist, itm, depth: site.depth.data[j + hi] * 10, los: site.los.data[j + hi] > 127, cls: cls[y * W + x] };
}
const tiers = [10, 25, 100, 300, 1000];
function stats(techId, overrides) {
  const t = Object.assign({}, FWA.TECH[techId], overrides || {});
  const out = { km2_100_20: 0, hu_100_20: 0, hu_25_3: 0, hu_any: 0, km2_any: 0, hu_in_range: 0 };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let best = null;
    for (const site of sites) { const e = envAt(site, t, x, y); if (!e) continue; const r = FWA.evalLink(t, e); if (!best || r.dl > best.dl) best = r; }
    if (!best) continue;
    const i = y * W + x, u = inCounty[i] ? units[i] : 0, a = RES * RES / 1e6;
    out.hu_in_range += u;
    if (best.dl >= 10) { out.hu_any += u; out.km2_any += a; }
    if (best.dl >= 25 && best.ul >= 3) out.hu_25_3 += u;
    if (best.dl >= 100 && best.ul >= 20) { out.hu_100_20 += u; out.km2_100_20 += a; }
  }
  return out;
}
const rows = [];
for (const id of FWA.ORDER) { const o = stats(id); rows.push({ tech: id, ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v)])) }); }
rows.push({ tech: 'mno_cband outdoor17dBi', ...Object.fromEntries(Object.entries(stats('mno_cband', { cpe: 'panel', cpeGain: 17, cpeComb: 3, cpeH: 6, o2i: 'none' })).map(([k, v]) => [k, Math.round(v)])) });
rows.push({ tech: 'tarana_cbrs @10m', ...Object.fromEntries(Object.entries(stats('tarana_cbrs', { cpeH: 10 })).map(([k, v]) => [k, Math.round(v)])) });
console.table(rows);
// range sanity along one open-water radial and one forest cell
const t = FWA.TECH.tarana_cbrs;
for (const d of [1000, 3000, 5000, 10000, 15000, 20000]) {
  const open = FWA.evalLink(t, FWA.analyticEnv(t, d, 95, 0, 60)), pine = FWA.evalLink(t, FWA.analyticEnv(t, d, 42, 400, 60)), dev = FWA.evalLink(t, FWA.analyticEnv(t, d, 21, 0, 60));
  console.log(d, 'open', open.dl.toFixed(0), open.ul.toFixed(0), 'pine', pine.dl.toFixed(0), pine.ul.toFixed(0), 'devopen', dev.dl.toFixed(0), dev.ul.toFixed(0), 'L_pine', pine.L.toFixed(1));
}

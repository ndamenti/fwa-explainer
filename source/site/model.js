/* FWA propagation + link-budget model. Pure functions; shared by the page and by node-side tests. */
var FWA = (function () {
  'use strict';
  var LOG10 = Math.log10;
  var LAYER_F = [2600, 3600, 6000];   // MHz of the ITM layers (R,G,B)
  var LAYER_H = [2, 6, 10];           // receiver heights of the layers (m)

  // ---------- Technology profiles (defaults; every field is user-adjustable in the page) ----------
  // cpe: 'gateway' (indoor omni-ish, 2 m), 'panel' (fixed high-gain outdoor, 6/10 m), 'array' (adaptive outdoor array, 6/10 m)
  var TECH = {
    mno_cband: { id: 'mno_cband', name: 'MNO macro FWA · C-band (n77)', short: 'MNO C-band', color: 1,
      fMHz: 3700, layerF: 1, carriers: 1, bw: 100, dlFrac: 0.74, ulFrac: 0.26,
      eirp: 79, nfCpe: 7, maxLayers: 4, seMax: 7.4, capDl: 1000, capUl: 150,
      cpe: 'gateway', cpeGain: 3, cpeComb: 6, cpeH: 2, o2i: 'window',
      ulEirp: 29, bsGain: 24, nfBs: 3, ulLayers: 2, interf: 3, interfUl: 2, tag: 'mno',
      note: '64T64R massive-MIMO sector on the macro tower; indoor self-install gateway at a window.' },
    mno_n41: { id: 'mno_n41', name: 'MNO macro FWA · 2.5 GHz (n41)', short: 'MNO n41', color: 5,
      fMHz: 2600, layerF: 0, carriers: 1, bw: 100, dlFrac: 0.74, ulFrac: 0.26,
      eirp: 79, nfCpe: 7, maxLayers: 4, seMax: 7.4, capDl: 1000, capUl: 150,
      cpe: 'gateway', cpeGain: 3, cpeComb: 6, cpeH: 2, o2i: 'window',
      ulEirp: 29, bsGain: 24, nfBs: 3, ulLayers: 2, interf: 3, interfUl: 2, tag: 'mno',
      note: 'T-Mobile-style n41 layer; 100 MHz of the 2.5 GHz BRS/EBS holdings; same indoor gateway.' },
    mmwave: { id: 'mmwave', name: 'mmWave 5G FWA · 28 GHz (n261)', short: 'mmWave 28', color: 4,
      fMHz: 28000, layerF: -1, carriers: 1, bw: 400, dlFrac: 0.74, ulFrac: 0.26,
      eirp: 65, nfCpe: 7, maxLayers: 2, seMax: 7.4, capDl: 2000, capUl: 300,
      cpe: 'gateway', cpeGain: 20, cpeComb: 0, cpeH: 2, o2i: 'glass28',
      ulEirp: 40, bsGain: 30, nfBs: 5, ulLayers: 1, interf: 1, interfUl: 1, rain: 6, gas: 0.1, tag: 'mmw',
      note: 'Radio placed on the same tower top (its best case); window-mounted phased-array CPE. LOS through clutter is required.' },
    cbrs_nr: { id: 'cbrs_nr', name: 'Dedicated 5G NR · CBRS Cat B', short: 'CBRS 5G NR', color: 3,
      fMHz: 3625, layerF: 1, carriers: 1, bw: 40, dlFrac: 0.74, ulFrac: 0.26,
      eirp: 53, nfCpe: 7, maxLayers: 4, seMax: 7.4, capDl: 850, capUl: 200,
      cpe: 'panel', cpeGain: 17, cpeComb: 3, cpeH: 6, o2i: 'none',
      ulEirp: 36, bsGain: 23, nfBs: 4, ulLayers: 2, interf: 3, interfUl: 3, tag: 'cbrs',
      note: 'WISP-grade 4T4R gNB with a 17 dBi sector panel at the Part 96 Cat B ceiling (47 dBm/10 MHz), one 40 MHz GAA channel; pro-installed 17 dBi outdoor CPE registered as a Cat A CPE-CBSD (30 dBm/10 MHz).' },
    tarana_cbrs: { id: 'tarana_cbrs', name: 'Tarana G1/G2 · CBRS (2×40 MHz)', short: 'Tarana CBRS', color: 2,
      fMHz: 3625, layerF: 1, carriers: 2, bw: 40, dlFrac: 0.80, ulFrac: 0.20,
      eirp: 48.5, nfCpe: 6, maxLayers: 2, seMax: 7.35, capDl: 800, capUl: 200,
      cpe: 'array', cpeGain: 14.5, cpeComb: 9, cpeH: 6, o2i: 'none',
      ulEirp: 36, bsGain: 26.3, nfBs: 5, ulLayers: 2, interf: 1, interfUl: 1, tag: 'tarana',
      note: 'BN-3: 16-chain distributed massive MIMO at 48.5 dBm EIRP per 40 MHz carrier (FCC grant); 8-chain RN, pro-installed, operated as a Cat A CPE-CBSD (30 dBm/10 MHz).' },
    tarana_5: { id: 'tarana_5', name: 'Tarana G1 BN-5 · 5 GHz unlicensed (2×40 MHz)', short: 'Tarana 5 GHz', color: 7,
      fMHz: 5800, layerF: 2, carriers: 2, bw: 40, dlFrac: 0.80, ulFrac: 0.20,
      eirp: 33, nfCpe: 6, maxLayers: 2, seMax: 7.35, capDl: 800, capUl: 200,
      cpe: 'array', cpeGain: 14.5, cpeComb: 9, cpeH: 6, o2i: 'none',
      ulEirp: 36, bsGain: 26.5, nfBs: 5, ulLayers: 2, interf: 4, interfUl: 4, tag: 'tarana',
      note: 'Unlicensed UNII-1/3: 36 dBm EIRP total for point-to-multipoint, so 33 dBm per carrier with two carriers; shared with Wi-Fi, hence the larger interference margin. The largest part of the G1 installed base.' },
    tarana_6: { id: 'tarana_6', name: 'Tarana G1x2/G2 · 6 GHz (4×40 MHz)', short: 'Tarana 6 GHz', color: 6,
      fMHz: 6400, layerF: 2, carriers: 4, bw: 40, dlFrac: 0.80, ulFrac: 0.20,
      eirp: 30, nfCpe: 6, maxLayers: 2, seMax: 7.35, capDl: 1600, capUl: 400,
      cpe: 'array', cpeGain: 15.5, cpeComb: 9, cpeH: 6, o2i: 'none',
      ulEirp: 24, bsGain: 28, nfBs: 5, ulLayers: 2, interf: 0.5, interfUl: 0.5, tag: 'tarana',
      note: 'Standard-power 6 GHz under AFC: 36 dBm EIRP shared across four 40 MHz carriers (30 dBm each). Four times the spectrum at a fraction of the power.' }
  };
  var ORDER = ['mno_cband', 'mno_n41', 'mmwave', 'cbrs_nr', 'tarana_cbrs', 'tarana_5', 'tarana_6'];

  // ---------- Global modelling options (user-adjustable) ----------
  var OPTS = {
    fade: 4,            // dB fade / location margin applied to every link
    season: 'leafon',   // 'leafon' | 'leafoff'
    clutterScale: 1.0,  // multiplier on foliage + building clutter
    nlosPanel: 4,       // dB effective-gain loss for a fixed high-gain panel in NLOS (angular spread)
    nlosGateway: 1,     // dB for a low-gain indoor gateway
    nlosArray: 0,       // dB for an adaptive array (Tarana RN)
    minSnr: -5          // dB: lowest usable SINR (QPSK 1/8-class)
  };

  // ---------- NLCD classes ----------
  var NLCD = {
    11: { n: 'Open water', c: '#6fa8dc', fol: 0, R: 0 },
    21: { n: 'Developed, open space', c: '#e8d5c4', fol: 0, R: 5, k: 0.5 },
    22: { n: 'Developed, low intensity', c: '#d9a08a', fol: 0, R: 8, k: 0.8 },
    23: { n: 'Developed, medium intensity', c: '#c45f4a', fol: 0, R: 10, k: 1.0 },
    24: { n: 'Developed, high intensity', c: '#8a2f22', fol: 0, R: 15, k: 1.2 },
    31: { n: 'Barren land', c: '#c9c4bb', fol: 0, R: 0 },
    41: { n: 'Deciduous forest', c: '#8fc27a', fol: 1, R: 20, seas: 0.7 },
    42: { n: 'Evergreen (pine) forest', c: '#2f7a3d', fol: 1, R: 22, seas: 1.0 },
    43: { n: 'Mixed forest', c: '#6aa66b', fol: 1, R: 21, seas: 0.8 },
    52: { n: 'Shrub / scrub', c: '#cdbf86', fol: 1, R: 3, seas: 0.9 },
    71: { n: 'Grassland', c: '#e6e39a', fol: 0, R: 0.5 },
    81: { n: 'Pasture / hay', c: '#dcd45a', fol: 0, R: 0.5 },
    82: { n: 'Cultivated crops', c: '#b48b3f', fol: 0, R: 1 },
    90: { n: 'Woody wetlands (swamp forest)', c: '#7fb3a6', fol: 1, R: 18, seas: 0.85 },
    95: { n: 'Emergent herbaceous wetlands (marsh)', c: '#a9d8c8', fol: 0, R: 1 }
  };

  // ---------- Loss components ----------
  function fspl(dm, fMHz) { return 20 * LOG10(4 * Math.PI * Math.max(dm, 1) * fMHz * 1e6 / 2.998e8); }
  // ITU-R P.833 one-terminal-in-woodland: A = Am(1 - exp(-d*gamma/Am)); Am = 1.37 f^0.42 (St Petersburg mixed forest), gamma extrapolated from Table 1
  function amMax(fMHz) { return 1.37 * Math.pow(fMHz, 0.42); }
  function gammaF(fMHz) { return 0.34 * Math.pow(fMHz / 2117, 0.8); }
  function foliageLoss(depth, fMHz, cls, opts) {
    opts = opts || OPTS;
    if (!(depth > 0)) return 0;
    var k = NLCD[cls] ? NLCD[cls].seas || 1 : 1;
    var sf = (opts.season === 'leafoff') ? k : 1;
    var A = amMax(fMHz) * sf * opts.clutterScale, g = gammaF(fMHz) * sf;
    return A * (1 - Math.exp(-depth * g / A));
  }
  // Developed-area clutter: ITU-R P.2108 §3.2 low-angle median term Ll = 23.5 + 9.6 log10(f GHz), scaled by intensity and by how far the CPE sits below the roof/tree line
  function bldgLoss(cls, fMHz, hr, opts) {
    opts = opts || OPTS;
    var d = NLCD[cls]; if (!d || !d.k) return 0;
    var Ll = 23.5 + 9.6 * LOG10(fMHz / 1000);
    var frac = Math.max(0, Math.min(1, (d.R - hr) / d.R));
    return d.k * Ll * frac * opts.clutterScale;
  }
  // 3GPP TR 38.901 §7.4.3 building penetration
  function o2iLoss(mode, fMHz) {
    var f = fMHz / 1000, glass = 2 + 0.2 * f, irr = 25.4 + 0.11 * f, conc = 5 + 4 * f;
    switch (mode) {
      case 'none': return 0;
      case 'window': return glass + 3;                 // gateway on the sill of a standard-glass window
      case 'windowLowE': return irr + 3;               // low-E / IRR glass
      case 'low': return 5 - 10 * LOG10(0.3 * Math.pow(10, -glass / 10) + 0.7 * Math.pow(10, -conc / 10));
      case 'high': return 5 - 10 * LOG10(0.7 * Math.pow(10, -irr / 10) + 0.3 * Math.pow(10, -conc / 10));
      case 'glass28': return (2 + 0.2 * f) + 3 + 3;    // mmWave window mount: standard glass + placement + incidence
      default: return 0;
    }
  }
  function noiseDbm(bwMHz, nf) { return -174 + 10 * LOG10(bwMHz * 1e6) + nf; }
  function se(snr, seMax, opts) { opts = opts || OPTS; if (snr < opts.minSnr) return 0; return Math.min(seMax, 0.8 * Math.log2(1 + Math.pow(10, snr / 10))); }
  function rank(snr, maxL) { var L = snr < 12 ? 1 : (snr < 20 ? 2 : 4); return Math.min(L, maxL); }

  // ---------- Per-link evaluation ----------
  // env = { dist (m), itm (dB, terrain-only basic transmission loss at the tech's layer freq & CPE height; null for mmWave),
  //         depth (m foliage along the ray at CPE height), los (bool clutter-free LOS at CPE height), cls (NLCD) }
  function evalLink(t, env, opts) {
    opts = opts || OPTS;
    var hr = t.cpeH, f = t.fMHz;
    var L;
    if (t.layerF < 0) {   // mmWave: analytic
      L = fspl(env.dist, f) + (t.gas || 0) * env.dist / 1000 + (t.rain || 0);
      if (!env.los) L += (env.depth > 0 ? foliageLoss(env.depth, f, env.cls, opts) : 40);
    } else {
      L = env.itm + 20 * LOG10(f / LAYER_F[t.layerF]) + foliageLoss(env.depth, f, env.cls, opts);
    }
    L += bldgLoss(env.cls, f, hr, opts) + o2iLoss(t.o2i, f);
    var nlos = (env.depth > 0) || !env.los || (NLCD[env.cls] && NLCD[env.cls].k && NLCD[env.cls].R > hr);
    var pen = nlos ? (t.cpe === 'panel' ? opts.nlosPanel : t.cpe === 'gateway' ? opts.nlosGateway : opts.nlosArray) : 0;
    var gRx = t.cpeGain + t.cpeComb;
    var snrDl = t.eirp + gRx - L - pen - noiseDbm(t.bw, t.nfCpe) - opts.fade - t.interf;
    var dl = t.carriers * t.bw * t.dlFrac * se(snrDl, t.seMax, opts) * rank(snrDl, t.maxLayers);
    dl = Math.min(dl, t.capDl);
    // uplink: scheduler picks the sub-band split that maximises rate
    var ul = 0, snrUl = -99, gBs = t.bsGain;
    for (var k = 1; k <= 16; k *= 2) {
      var bwk = t.bw / k;
      var s = t.ulEirp + gBs - L - pen - noiseDbm(bwk, t.nfBs) - opts.fade - t.interfUl;
      var r = t.carriers * bwk * t.ulFrac * se(s, t.seMax, opts) * Math.min(rank(s, t.ulLayers), t.ulLayers);
      if (r > ul) { ul = r; snrUl = s; }
      if (k === 1) snrUl = Math.max(snrUl, s);
    }
    ul = Math.min(ul, t.capUl);
    return { L: L, snrDl: snrDl, snrUl: snrUl, dl: dl, ul: ul, pen: pen, nlos: nlos };
  }

  // Analytic environment for the link-budget tab (no terrain): FSPL + smooth-earth horizon check
  function analyticEnv(t, distM, cls, depth, htx) {
    var hr = t.cpeH;
    var horizon = 4120 * (Math.sqrt(htx) + Math.sqrt(hr)); // m, 4/3 earth
    var itm = fspl(distM, LAYER_F[Math.max(t.layerF, 0)]);
    if (distM > horizon) itm += 0.08 * (distM - horizon) / 100; // crude beyond-horizon slope (dB per 100 m)
    var los = depth <= 0 && !(NLCD[cls] && NLCD[cls].k && NLCD[cls].R > hr);
    return { dist: distM, itm: itm, depth: depth, los: los, cls: cls };
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  return { TECH: TECH, ORDER: ORDER, OPTS: OPTS, NLCD: NLCD, LAYER_F: LAYER_F, LAYER_H: LAYER_H,
    fspl: fspl, amMax: amMax, gammaF: gammaF, foliageLoss: foliageLoss, bldgLoss: bldgLoss, o2iLoss: o2iLoss,
    noiseDbm: noiseDbm, se: se, rank: rank, evalLink: evalLink, analyticEnv: analyticEnv, clone: clone };
})();
if (typeof module !== 'undefined') module.exports = FWA;

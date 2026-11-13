/* Finale "Abspann": Eva on the summit at sunset launches fireworks (the last rockets spell ALLES GUTE EVA!),
   night falls, the friends' present – a motorized disco ball – descends from the stars (swipe to spin it!),
   then a retro game credits roll with portraits, photos and the personal message. Ends in free-play disco. */
(function () {
  'use strict';

  GAMES['finale_credits'] = {
    title: 'Abspann',
    intro: 'Tippe in den Himmel und zünde das Gipfel-Feuerwerk! Danach: Kugel wischen zum Drehen, Tippen/Halten spult den Abspann vor.',
    start(root, api) {
      const E = window.Engine;
      const DEF = { birthdayName: 'Eva', from: ['Laurenz', 'Enrico', 'Hannah', 'Magnus'], message: [], gallery: [] };
      let contentTag = null;
      if (!window.CONTENT) { contentTag = document.createElement('script'); contentTag.src = 'js/content.js'; document.head.appendChild(contentTag); }
      const W = 180, H = 320;
      const cv = api.makeCanvas(root, W, H);
      const g = cv.ctx;
      api.music('birthday');

      const GY = 300;                 // summit plateau (feet)
      const CT = 104, CB = 258;       // credits window
      const BX = 90, BY = 62, BR = 32; // disco ball final position / radius
      const LIGHTS = ['#ff3fa4', '#3fe0ff', '#ffe23f', '#7cff4f', '#b45cff', '#ff8a2a'];
      const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
      const LRGB = LIGHTS.map(rgb);
      const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
      const lerp = (a, b, k) => a + (b - a) * k;
      const rnd = (a, b) => a + Math.random() * (b - a);
      const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
      let seed = 7; const srnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

      /* ================= backgrounds (prerendered) ================= */
      function mk() { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; }
      function ridge(base, amp, f1, f2, ph) { const a = []; for (let x = 0; x < W; x++) a.push(Math.round(base - amp * (0.55 * Math.sin(x * f1 + ph) + 0.3 * Math.sin(x * f2 + ph * 2.3) + 0.15 * Math.sin(x * 0.31 + ph)) - (srnd() < 0.3 ? 1 : 0))); return a; }
      const R1 = ridge(232, 26, 0.035, 0.09, 1.2), R2 = ridge(262, 18, 0.05, 0.13, 4.1);
      function sky(c, stops, sun) {
        const x = c.getContext('2d');
        // banded + dithered gradient
        for (let y = 0; y < GY; y++) {
          const k = y / 250 * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(k)), f = Math.min(1, k - i);
          const a = rgb(stops[i]), b = rgb(stops[i + 1]);
          const q = Math.floor(f * 4) / 4, r = f * 4 - Math.floor(f * 4);
          for (let xx = 0; xx < W; xx += 1) {
            const dq = ((xx + y) % 2 === 0 && r > 0.5) ? 0.25 : 0;
            const kk = Math.min(1, q + dq);
            x.fillStyle = `rgb(${lerp(a[0], b[0], kk) | 0},${lerp(a[1], b[1], kk) | 0},${lerp(a[2], b[2], kk) | 0})`;
            x.fillRect(xx, y, 1, 1);
          }
        }
        if (sun) {
          const sx = 52, sy = 238, sr = 24;
          for (let y = -sr; y <= sr; y++) {
            if (y > 4 && (y % 5 === 0 || y % 5 === 1)) continue; // retro sun stripes
            const hw = Math.floor(Math.sqrt(sr * sr - y * y));
            x.fillStyle = y < -10 ? '#ffe28a' : y < 2 ? '#ffc35a' : '#ff9a4a';
            x.fillRect(sx - hw, sy + y, hw * 2 + 1, 1);
          }
          x.fillStyle = 'rgba(255,220,150,0.18)';
          for (let r = sr + 3; r < sr + 15; r += 4) { x.beginPath(); x.arc(sx, sy, r, 0, Math.PI * 2); x.fill(); }
          // cloud streaks
          x.fillStyle = '#f08a7a';
          [[18, 150, 40], [96, 166, 54], [130, 132, 30], [8, 186, 30], [110, 196, 64]].forEach(([cx, cy, cw]) => { x.fillRect(cx, cy, cw, 2); x.fillRect(cx + 6, cy - 2, cw - 14, 2); });
          x.fillStyle = '#ffc48a';
          [[22, 150, 30], [104, 166, 36], [116, 196, 40]].forEach(([cx, cy, cw]) => x.fillRect(cx, cy + 1, cw, 1));
        } else {
          // moon (crescent)
          x.fillStyle = '#f4ecd0'; x.beginPath(); x.arc(150, 28, 9, 0, Math.PI * 2); x.fill();
          x.fillStyle = stops[0]; x.beginPath(); x.arc(154, 25, 8, 0, Math.PI * 2); x.fill();
        }
      }
      function mountains(c, far, near, rim) {
        const x = c.getContext('2d');
        for (let xx = 0; xx < W; xx++) {
          x.fillStyle = far; x.fillRect(xx, R1[xx], 1, GY - R1[xx]);
          if (rim && R1[xx] <= R1[Math.max(0, xx - 1)]) { x.fillStyle = rim; x.fillRect(xx, R1[xx], 1, 1); }
        }
        // snow caps on far ridge
        for (let xx = 1; xx < W - 1; xx++) if (R1[xx] < 214 && R1[xx] <= R1[xx - 1] && R1[xx] <= R1[xx + 1]) { x.fillStyle = rim ? '#f0c8c0' : '#8a94b8'; x.fillRect(xx - 3, R1[xx], 7, 2); x.fillRect(xx - 1, R1[xx] + 2, 3, 1); }
        for (let xx = 0; xx < W; xx++) { x.fillStyle = near; x.fillRect(xx, R2[xx], 1, GY - R2[xx]); }
        // pine tips on near ridge
        x.fillStyle = near;
        for (let xx = 3; xx < W; xx += 7 + (xx % 3)) { const y = R2[xx]; x.fillRect(xx, y - 6, 1, 6); x.fillRect(xx - 1, y - 3, 3, 3); x.fillRect(xx - 2, y - 1, 5, 1); }
      }
      function summit(c, top, rock, dark, hi, cross) {
        const x = c.getContext('2d');
        seed = 99;
        for (let xx = 0; xx < W; xx++) {
          const edge = xx < 10 ? (10 - xx) * 0.9 : xx > W - 11 ? (xx - (W - 11)) * 0.9 : 0;
          const y = GY - 2 + Math.round(edge) + (srnd() < 0.25 ? -1 : 0);
          x.fillStyle = rock; x.fillRect(xx, y, 1, H - y);
          x.fillStyle = top; x.fillRect(xx, y, 1, 2);
          if (srnd() < 0.18) { x.fillStyle = hi; x.fillRect(xx, y, 1, 1); }
        }
        for (let i = 0; i < 26; i++) { const rx = srnd() * W | 0, ry = GY + 4 + srnd() * 16 | 0, rw = 3 + srnd() * 8 | 0; x.fillStyle = dark; x.fillRect(rx, ry, rw, 1); x.fillRect(rx + 1, ry + 1, rw - 2, 1); x.fillStyle = hi; x.fillRect(rx, ry - 1, 2, 1); }
        // autumn leaves / tufts on the plateau
        const lv = ['#d9822b', '#f2b33d', '#b5452c', '#6fae4f'];
        for (let i = 0; i < 30; i++) { x.fillStyle = lv[i % 4]; x.globalAlpha = cross === 'night' ? 0.45 : 1; x.fillRect(srnd() * W | 0, GY - 2 + (srnd() * 3 | 0), 2, 1); }
        x.globalAlpha = 1;
        // summit cross (Gipfelkreuz)
        const cx = 170;
        x.fillStyle = cross === 'night' ? '#2a2030' : '#4b2e1c'; x.fillRect(cx, 250, 3, GY - 250); x.fillRect(cx - 7, 259, 17, 3);
        x.fillStyle = cross === 'night' ? '#3a3046' : '#8a5a34'; x.fillRect(cx, 250, 1, GY - 250); x.fillRect(cx - 7, 259, 17, 1);
        x.fillStyle = cross === 'night' ? '#6a6a78' : '#e8c070'; x.fillRect(cx - 1, 264, 5, 4); // summit book box
      }
      const bgDay = mk(), bgNight = mk(), fgDay = mk(), fgNight = mk();
      sky(bgDay, ['#2a1b4a', '#5a2a64', '#a8406a', '#e0704a', '#f6b25a'], true);
      seed = 7; mountains(bgDay, '#7a3d68', '#4a2648', '#ff9a6a');
      sky(bgNight, ['#04051a', '#0a0d2c', '#141844', '#221c4a', '#2c2050'], false);
      mountains(bgNight, '#161a36', '#0c0f22', null);
      summit(fgDay, '#8a6a3a', '#5a4450', '#3a2a38', '#ffb070', 'day');
      summit(fgNight, '#3a3a4a', '#262433', '#14121c', '#5a5a78', 'night');
      const STARS = []; for (let i = 0; i < 90; i++) STARS.push({ x: Math.random() * W | 0, y: Math.random() * 220 | 0, p: Math.random() * 6, b: Math.random() < 0.15 });

      /* ================= state ================= */
      let phase = 'fw';     // fw → night → disco → credits → end
      let pt = 0;           // time in phase
      let T = 0;            // global time
      let nightK = 0, lit = 0, ballY = -80, flash = 0;
      let freeShots = 0; const FREE = 5; let wordShots = 0; let lastTap = 0;
      let won = false, fwDone = 0, discoOn = false;

      /* ================= fireworks ================= */
      const P = [];      // particles {x,y,vx,vy,life,max,c,kind,tx,ty,...}
      const ROCKETS = [];
      const FWC = ['#ff4a6a', '#ffd84a', '#4ae0ff', '#9a6aff', '#7cff6a', '#ff9a3a', '#ff7ad0', '#ffffff'];
      const FONT = {
        A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
        L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
        E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
        S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
        G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
        U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
        T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
        V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
        '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..']
      };
      const WORDS = [
        { s: 'ALLES', y: 30, cols: ['#ffd84a', '#ffb03a'] },
        { s: 'GUTE', y: 76, cols: ['#ff7ad0', '#ff4a6a'] },
        { s: 'EVA!', y: 122, cols: ['#4ae0ff', '#9af0ff'] }
      ];
      const SC = 5;
      const evaHand = () => ({ x: 98, y: GY - 26 });
      let evaJump = 0;

      function launch(tx, ty, word) {
        const h = evaHand();
        ROCKETS.push({ x0: h.x, y0: h.y, x: h.x, y: h.y, tx, ty, t: 0, dur: word != null ? 1.0 : 0.75 + Math.random() * 0.2, word, c: FWC[Math.random() * FWC.length | 0] });
        api.sfx('launch'); evaJump = 0.35;
      }
      function burst(x, y, c, kind) {
        const n = kind === 'heart' ? 60 : 70;
        const c2 = FWC[Math.random() * FWC.length | 0];
        for (let i = 0; i < n; i++) {
          let vx, vy;
          const a = (i / n) * Math.PI * 2;
          if (kind === 'ring') { vx = Math.cos(a) * 60; vy = Math.sin(a) * 60; }
          else if (kind === 'heart') { const tt = a; vx = 16 * Math.pow(Math.sin(tt), 3) * 3.8; vy = -(13 * Math.cos(tt) - 5 * Math.cos(2 * tt) - 2 * Math.cos(3 * tt) - Math.cos(4 * tt)) * 3.8; }
          else { const v = 25 + Math.random() * 55; const b = Math.random() * Math.PI * 2; vx = Math.cos(b) * v; vy = Math.sin(b) * v; }
          const life = kind === 'willow' ? 2.4 + Math.random() : 1.3 + Math.random() * 0.6;
          P.push({ x, y, vx, vy, life, max: life, c: kind === 'heart' ? (i % 2 ? '#ff4a7a' : '#ff9ac0') : (kind === 'ring' ? c : (i % 3 ? c : c2)), kind, g: kind === 'willow' ? 30 : 42, drag: kind === 'willow' ? 1.8 : 1.2, crackle: kind === 'crackle' });
        }
        if (P.length > 1600) P.splice(0, P.length - 1600);
        flash = Math.max(flash, 0.35); api.sfx('boom');
      }
      function wordBurst(wi, x, y) {
        const w = WORDS[wi], s = w.s;
        const tw = (s.length * 6 - 1) * SC, x0 = Math.round((W - tw) / 2);
        for (let li = 0; li < s.length; li++) {
          const rows = FONT[s[li]];
          for (let ry = 0; ry < 7; ry++) for (let rx = 0; rx < 5; rx++) if (rows[ry][rx] === '#') {
            const tx = x0 + (li * 6 + rx) * SC + 2, ty = w.y + ry * SC + 2;
            P.push({ x, y, sx: x, sy: y, tx, ty, t: 0, life: 999, max: 999, c: w.cols[(li + rx + ry) % 2], kind: 'letter', ph: Math.random() * 6, delay: Math.random() * 0.15 });
          }
        }
        for (let i = 0; i < 40; i++) { const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 60; P.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, max: 1, c: '#ffffff', kind: 'spark', g: 40, drag: 1.5 }); }
        flash = 0.7; api.sfx('boom'); setTimeout(() => api.sfx('ding'), 120);
      }
      function fwTap(x, y) {
        if (phase !== 'fw') return;
        lastTap = T;
        if (freeShots < FREE) {
          freeShots++;
          const kinds = ['peony', 'ring', 'heart', 'willow', 'crackle'];
          const r = { x: clamp(x, 16, W - 16), y: clamp(y, 24, 190) };
          launch(r.x, r.y, null);
          ROCKETS[ROCKETS.length - 1].kind = kinds[(freeShots - 1) % kinds.length];
        } else if (wordShots < WORDS.length && !ROCKETS.some(r => r.word != null)) {
          launch(W / 2, WORDS[wordShots].y + 17, wordShots);
          wordShots++;
        }
      }

      /* ================= confetti ================= */
      const CONF = ['#f5c542', '#d94c3d', '#6fae4f', '#4a7fd9', '#f2a7b8', '#8a5bd9', '#fff', '#3fe0ff'];
      const CF = [];
      function confetti(x, y, n) {
        for (let i = 0; i < (n || 50); i++) { const a = Math.random() * Math.PI * 2, v = 30 + Math.random() * 90; CF.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 50, c: CONF[Math.random() * CONF.length | 0], life: 1.6 + Math.random(), ph: Math.random() * 6 }); }
        if (CF.length > 500) CF.splice(0, CF.length - 500);
      }

      /* ================= disco ball ================= */
      const BD = BR * 2 + 1;
      const ballC = document.createElement('canvas'); ballC.width = BD; ballC.height = BD;
      const ballG = ballC.getContext('2d');
      const bimg = ballG.createImageData(BD, BD);
      const LATN = 13;
      const NCOLS = []; for (let i = 0; i < LATN; i++) { const latc = ((i + 0.5) / LATN - 0.5) * Math.PI; NCOLS.push(Math.max(6, Math.round(28 * Math.cos(latc) / 2) * 2)); }
      const BPX = [];
      for (let y = 0; y < BD; y++) for (let x = 0; x < BD; x++) {
        const nx = (x - BR) / (BR + 0.5), ny = (y - BR) / (BR + 0.5), d = nx * nx + ny * ny;
        if (d > 1) continue;
        const nz = Math.sqrt(1 - d), lat = Math.asin(ny), lon = Math.atan2(nx, nz);
        const lf = (lat / Math.PI + 0.5) * LATN, fi = Math.min(LATN - 1, Math.floor(lf));
        BPX.push({ i: (y * BD + x) * 4, fi, fr: lf - fi, lon, nz, rim: d > 0.9 });
      }
      const FC = new Float32Array(LATN * 64 * 3), FS = new Int32Array(LATN * 64);
      let frameId = 0, glints = [];
      const L1 = (() => { const v = [-0.5, -0.65, 0.58], m = Math.hypot(...v); return v.map(a => a / m); })();
      function facet(fi, jj, rot, beat) {
        const latc = ((fi + 0.5) / LATN - 0.5) * Math.PI, nc = NCOLS[fi];
        const lv = (jj + 0.5) / nc * Math.PI * 2 + rot;
        const cl = Math.cos(latc);
        const Nx = Math.sin(lv) * cl, Ny = Math.sin(latc), Nz = Math.cos(lv) * cl;
        const h = hash(fi * 7 + 3, jj);
        // reflected eye ray
        const ry = 2 * Nz * Ny;
        let r, gg, b;
        if (ry < 0) { // sky: deep night blue/purple, a bit brighter near the horizon
          const k = clamp(-ry, 0, 1);
          r = lerp(80, 14, k); gg = lerp(70, 16, k); b = lerp(140, 60, k);
        } else {       // below: the lit summit + floor colours
          const k = clamp(ry, 0, 1);
          r = lerp(120, 70, k); gg = lerp(90, 55, k); b = lerp(110, 80, k);
        }
        const base = h < 0.12 ? 0.35 : 0.55 + h * 1.0;
        r *= base; gg *= base; b *= base;
        // key light diffuse
        const nl = Nx * L1[0] + Ny * L1[1] + Nz * L1[2];
        const dif = Math.max(0, nl);
        r += dif * 90; gg += dif * 90; b += dif * 100;
        // specular of key light
        const rz = 2 * nl * Nz - L1[2];
        const spec = Math.pow(Math.max(0, rz), 28);
        // coloured stage lights reflected on some facets (cycle with the beat)
        const L = lit;
        if (h > 0.62) { const tc = LRGB[(Math.floor(beat) + (h * 60 | 0)) % LRGB.length]; const m = (0.35 + 0.5 * L) * (h > 0.85 ? 1 : 0.55); r = r * (1 - m) + tc[0] * m; gg = gg * (1 - m) + tc[1] * m; b = b * (1 - m) + tc[2] * m; }
        const br = 0.5 + 0.6 * L;
        r *= br; gg *= br; b *= br;
        // twinkle
        const tw = ((h * 131 + T * (0.6 + h)) % 1) < 0.035 ? 1 : 0;
        const s = Math.min(1, spec * 1.6 + tw);
        r += s * 255; gg += s * 255; b += s * 255;
        const o = (fi * 64 + jj) * 3;
        FC[o] = r; FC[o + 1] = gg; FC[o + 2] = b;
        if (spec > 0.45 && Nz > 0.25) glints.push({ x: BX + Nx * BR * 0.96, y: ballY + Ny * BR * 0.96, s: spec });
      }
      function renderBall(rot, beat) {
        frameId++; glints = [];
        const d = bimg.data;
        for (let k = 0; k < BPX.length; k++) {
          const p = BPX[k], nc = NCOLS[p.fi];
          let lf = ((p.lon - rot) / (Math.PI * 2)) * nc;
          lf = ((lf % nc) + nc) % nc;
          const fj = Math.floor(lf) % nc, fc = lf - Math.floor(lf);
          const key = p.fi * 64 + fj;
          if (FS[key] !== frameId) { FS[key] = frameId; facet(p.fi, fj, rot, beat); }
          const o = key * 3;
          let m = 0.62 + 0.38 * p.nz;
          if (p.fr < 0.13 || fc < 0.1 / Math.max(0.35, p.nz)) m *= 0.32;
          if (p.rim) m *= 0.7;
          const r = FC[o] * m, gg = FC[o + 1] * m, b = FC[o + 2] * m;
          d[p.i] = r > 255 ? 255 : r; d[p.i + 1] = gg > 255 ? 255 : gg; d[p.i + 2] = b > 255 ? 255 : b; d[p.i + 3] = 255;
        }
        ballG.putImageData(bimg, 0, 0);
        glints.sort((a, b) => b.s - a.s);
      }

      // reflection spots: directions on the ball; they sweep across the scene with the spin
      const DOTS = [];
      for (let i = 0; i < 130; i++) DOTS.push({ a: Math.random() * Math.PI * 2, e: Math.pow(Math.random(), 0.8), c: Math.random() < 0.55 ? -1 : (Math.random() * LIGHTS.length | 0), s: Math.random() < 0.3 ? 2 : 1, beam: i % 9 === 0 });

      /* ================= dancers ================= */
      const DANCERS = {
        eva: { who: 'eva', x: 90, tx: 90, style: 'couple', side: 0, on: true },
        magnus: { who: 'magnus', x: -20, tx: 20, style: 'side', on: false },
        laurenz: { who: 'laurenz', x: -20, tx: 44, style: 'pogo', on: false },
        niklas: { who: 'niklas', x: W + 20, tx: 102, style: 'couple', side: 1, on: false },
        hannah: { who: 'hannah', x: W + 20, tx: 136, style: 'sway', on: false },
        enrico: { who: 'enrico', x: W + 20, tx: 158, style: 'robot', on: false }
      };
      const ORDER = ['magnus', 'laurenz', 'hannah', 'enrico', 'eva', 'niklas'];
      function join(who) { const d = DANCERS[who]; if (!d || d.on) return; d.on = true; if (who === 'niklas') DANCERS.eva.tx = 78; api.sfx('jump'); }
      function pose(d, beat) {
        const bi = Math.floor(beat), f = beat - bi, bar = ((bi % 4) + 4) % 4, bounce = Math.sin(Math.PI * f);
        let dx = 0, dy = -bounce * 3, frame = bi % 2 ? 'run1' : 'run2', flip = false;
        switch (d.style) {
          case 'side': dx = Math.sin(beat * Math.PI / 2) * 4; flip = (bi % 2) === 1; dy = -bounce * 2; break;
          case 'pogo': if (bar % 2 === 1) { dy = -bounce * 10; frame = 'jump'; } else { dy = 0; frame = 'idle'; } flip = true; break;
          case 'couple': {
            flip = d.side === 1; frame = bar % 2 ? 'run1' : 'idle';
            if (!DANCERS.niklas.on || DANCERS.niklas.x !== DANCERS.niklas.tx) { flip = (bi >> 1) % 2 === 1; if (bar === 3) { dy = -bounce * 10; frame = 'jump'; } }
            else if (((bi >> 2) % 4) === 3) { flip = (bi % 2) === 1; if (bar === 3) { dy = -bounce * 9; frame = 'jump'; } }
            break;
          }
          case 'sway': dx = Math.sin(beat * Math.PI) * 3; dy = -Math.abs(Math.sin(beat * Math.PI)) * 2; flip = ((bi >> 2) % 2) === 0; frame = bar % 2 ? 'run1' : 'idle'; break;
          case 'robot': dx = (Math.floor(beat * 2) % 4 - 1.5) * 1.5; dy = (Math.floor(beat * 2) % 2) ? -2 : 0; frame = ['idle', 'run1', 'idle', 'run2'][Math.floor(beat * 2) % 4]; flip = ((bi >> 1) % 2) === 0; break;
        }
        return { dx, dy, frame, flip };
      }
      const HEARTS = []; const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
      let lastHeart = -1;

      /* ================= credits ================= */
      function wrap(str, max) {
        const words = String(str).split(/\s+/), out = []; let cur = '';
        for (const w of words) { if (!cur) cur = w; else if ((cur + ' ' + w).length <= max) cur += ' ' + w; else { out.push(cur); cur = w; } }
        if (cur) out.push(cur);
        return out;
      }
      let fromStr = '', NAME = 'EVA', ITEMS = [], FINAL = null, S_END = 1e9, PH = [], built = false;
      const joinAt = {};
      const MID = (CT + CB) / 2;
      let scroll = 0, boost = 0, speed = 0;
      // photo overlays (sharp HTML photos in pixel frames), clipped & faded to the credits window
      const ov = document.createElement('div');
      ov.style.cssText = 'position:absolute;overflow:hidden;pointer-events:none;z-index:2;-webkit-mask-image:linear-gradient(transparent,#000 14%,#000 86%,transparent);mask-image:linear-gradient(transparent,#000 14%,#000 86%,transparent)';
      root.appendChild(ov);
      function buildCredits() {
        if (built) return; built = true;
        const C = window.CONTENT || DEF;
        const fromNames = C.from || [];
        fromStr = 'von ' + (fromNames.length > 1 ? fromNames.slice(0, -1).join(', ') + ' & ' + fromNames[fromNames.length - 1] : fromNames.join(''));
        NAME = (C.birthdayName || 'Eva').toUpperCase();
        ITEMS = []; let cy = 0;
        const add = (it, h) => { it.y = cy; it.h = h; ITEMS.push(it); cy += h; };
        const txt = (s, color, gapAfter, size) => { const ls = wrap(s, size === 16 ? 10 : 21); add({ type: 'text', lines: ls, color, size: size || 8 }, ls.length * (size === 16 ? 20 : 11) + (gapAfter || 0)); };
        const gap = h => add({ type: 'gap' }, h);
        const role = (r, name, who, color) => { const ls = wrap(r.toUpperCase(), 21); add({ type: 'role', lines: ls, name, who, color: color || '#f5c542' }, ls.length * 11 + 44); };
        txt('EVAS', '#f5c542', 0); txt('GEBURTSTAGS-QUEST', '#f5c542', 6);
        txt('~ ENDE ~', '#f6e7c8', 0); gap(34);
        txt('- MITWIRKENDE -', '#3fe0ff', 14);
        role('Leveldesign', 'MAGNUS', 'magnus');
        role('Zecken-Choreografie', 'LAURENZ', 'laurenz');
        role('Saft-Logistik', 'HANNAH', 'hannah');
        role('Programmierung & Würfelbetrug', 'ENRICO', 'enrico');
        role('Bester Co-Pilot', 'NIKLAS', 'niklas', '#ff7ad0');
        role('Ehrengast', NAME, 'eva', '#ff7ad0');
        gap(10);
        add({ type: 'gift' }, 64);
        gap(12);
        txt('MUSIK', '#f5c542', 0); txt('Das 8-Bit-Gipfelorchester', '#f6e7c8', 14);
        txt('CATERING', '#f5c542', 0); txt('Pilze aus dem Wald (ungeprüft)', '#f6e7c8', 14);
        txt('Bei den Dreharbeiten wurden keine Zecken verletzt.', '#9ab0c8', 30);
        txt('- ERINNERUNGEN -', '#3fe0ff', 10);
        const CAPS = { wald: 'Waldliebe 🌲', hannah: 'Gipfel-Crew 💛', heirat: 'Der Bräutigam 💍' };
        (C.gallery || []).forEach((src, i) => { const base = (src.split('/').pop() || '').split('.')[0]; add({ type: 'photo', src, cap: CAPS[base] || ('Erinnerung #' + (i + 1)), i }, 124); });
        gap(20);
        txt('- PERSÖNLICHE NACHRICHT -', '#3fe0ff', 12);
        (C.message || []).filter(l => !/^\s*\[.*\]\s*$/.test(l)).forEach(l => txt(l, '#ffffff', 8));
        gap(40);
        add({ type: 'final' }, 100);
        FINAL = ITEMS[ITEMS.length - 1];
        S_END = CB + FINAL.y + FINAL.h / 2 - MID;
        ITEMS.forEach(it => { if (it.type === 'role') joinAt[it.who] = it.y; });
        PH = ITEMS.filter(it => it.type === 'photo').map(it => {
          const el = document.createElement('div');
          el.style.cssText = 'position:absolute;left:0;top:0;display:none;background:#fbf7ee;box-shadow:0 0 0 2px #000,4px 4px 0 2px rgba(0,0,0,.45);transform-origin:50% 50%;will-change:transform;box-sizing:border-box';
          const im = document.createElement('img'); im.src = it.src; im.alt = '';
          im.style.cssText = 'display:block;width:100%;object-fit:cover;object-position:50% 25%;background:#2a2030';
          im.onerror = () => { im.style.visibility = 'hidden'; };
          const cap = document.createElement('div'); cap.textContent = it.cap;
          cap.style.cssText = "font-family:'VT323',monospace;color:#2a2030;text-align:center;white-space:nowrap;overflow:hidden";
          el.appendChild(im); el.appendChild(cap); ov.appendChild(el);
          return { it, el, im, cap };
        });
      }
      let ovKey = '';
      function layoutOverlay() {
        const s = cv.canvas.clientWidth / W, ox = cv.canvas.offsetLeft, oy = cv.canvas.offsetTop;
        const key = s + ':' + ox + ':' + oy;
        if (PH.length && key !== ovKey) {
          ovKey = key;
          Object.assign(ov.style, { left: ox + 'px', top: (oy + CT * s) + 'px', width: (W * s) + 'px', height: ((CB - CT) * s) + 'px' });
          PH.forEach(p => { p.el.style.width = (84 * s) + 'px'; p.el.style.padding = (5 * s) + 'px ' + (5 * s) + 'px 0'; p.im.style.height = (86 * s) + 'px'; p.cap.style.fontSize = (11 * s) + 'px'; p.cap.style.lineHeight = (16 * s) + 'px'; });
        }
        PH.forEach(p => {
          const top = CB + p.it.y - scroll - CT; // relative to window
          const vis = phase === 'credits' || phase === 'end';
          if (!vis || top > CB - CT + 10 || top + 120 < -10) { p.el.style.display = 'none'; return; }
          p.el.style.display = 'block';
          const x = (p.it.i % 2 ? 54 : 42) + Math.sin(T * 0.8 + p.it.i) * 1.5;
          const rot = (p.it.i % 2 ? 4 : -4) + Math.sin(T * 1.1 + p.it.i * 2) * 1;
          p.el.style.transform = `translate(${x * s}px,${(top + 8) * s}px) rotate(${rot}deg)`;
        });
      }

      /* ================= input ================= */
      let drag = null, spin = 0.9, rot = 0, motorA = 0, hintSpin = 0, spunOnce = false;
      const canSpin = () => phase === 'disco' || phase === 'credits' || phase === 'end' || (phase === 'night' && ballY > 0);
      const onDown = e => {
        e.preventDefault();
        const p = cv.pointer(e);
        try { cv.canvas.setPointerCapture(e.pointerId); } catch (_) {}
        if (phase === 'fw') { fwTap(p.x, p.y); return; }
        drag = { x0: p.x, y0: p.y, x: p.x, t: performance.now(), t0: performance.now(), moved: 0 };
      };
      const onMove = e => {
        if (!drag) return;
        const p = cv.pointer(e), dx = p.x - drag.x, now = performance.now(), dtm = Math.max(8, now - drag.t);
        drag.moved += Math.abs(dx) + Math.abs(p.y - drag.y0) * 0.02; drag.x = p.x; drag.t = now;
        if (drag.moved > 6 && canSpin()) { spin = clamp(spin * 0.6 + (dx / dtm) * 1000 * 0.09, -45, 45); hintSpin = 0; spunOnce = true; }
      };
      const onUp = () => {
        if (!drag) return;
        const d = drag; drag = null;
        if (d.moved <= 6) {
          if (phase === 'end') { confetti(clamp(d.x0, 10, W - 10), clamp(d.y0, 10, H - 10), 50); api.sfx('coin'); }
          else if (phase === 'credits' && performance.now() - d.t0 < 250) boost = Math.min(6, boost + 3);
        } else if (Math.abs(spin) > 14) api.sfx('launch');
      };
      const keys = {};
      const onKey = e => {
        const down = e.type === 'keydown';
        if (['Space', 'Enter', 'ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); else return;
        if (down && keys[e.code]) return; keys[e.code] = down;
        if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp') {
          if (down && phase === 'fw') fwTap(rnd(30, 150), rnd(30, 170));
          else if (down && phase === 'end') { confetti(rnd(30, 150), rnd(140, 240), 50); api.sfx('coin'); }
        }
        if (down && canSpin() && (e.code === 'ArrowLeft' || e.code === 'KeyA')) { spin = clamp(spin - 8, -45, 45); spunOnce = true; hintSpin = 0; }
        if (down && canSpin() && (e.code === 'ArrowRight' || e.code === 'KeyD')) { spin = clamp(spin + 8, -45, 45); spunOnce = true; hintSpin = 0; }
      };
      cv.canvas.addEventListener('pointerdown', onDown);
      cv.canvas.addEventListener('pointermove', onMove);
      cv.canvas.addEventListener('pointerup', onUp);
      cv.canvas.addEventListener('pointercancel', onUp);
      window.addEventListener('keydown', onKey);
      window.addEventListener('keyup', onKey);

      /* ================= beat ================= */
      const t0 = performance.now();
      function beatNow() {
        const b = E.Audio.beat && E.Audio.beat();
        if (b != null && E.Audio.bpm && E.Audio.bpm() === 120) return Math.max(0, b);
        return (performance.now() - t0) / 500;
      }

      /* ================= draw helpers ================= */
      function beam(x, y, ang, len, spread, color, alpha) {
        g.globalAlpha = alpha; g.fillStyle = color;
        g.beginPath(); g.moveTo(x, y);
        g.lineTo(x + Math.cos(ang - spread) * len, y + Math.sin(ang - spread) * len);
        g.lineTo(x + Math.cos(ang + spread) * len, y + Math.sin(ang + spread) * len);
        g.closePath(); g.fill();
      }
      function windowAlpha(y) { return clamp((y - CT) / 16, 0, 1) * clamp((CB - y) / 16, 0, 1); }
      function ctext(str, y, color, size, a) {
        if (a <= 0) return;
        g.globalAlpha = a; api.text(g, str, W / 2, y, size || 8, color, 'center'); g.globalAlpha = 1;
      }
      function rainbow(str, y, size, beat) {
        const cw = size, x0 = W / 2 - str.length * cw / 2;
        for (let i = 0; i < str.length; i++) {
          const yy = y + Math.sin(T * 5 + i * 0.6) * (size > 8 ? 2.5 : 1.5);
          const a = windowAlpha(yy + size / 2);
          if (a <= 0) continue;
          g.globalAlpha = a;
          api.text(g, str[i], x0 + i * cw, yy, size, LIGHTS[(i + Math.floor(beat)) % LIGHTS.length], 'left');
        }
        g.globalAlpha = 1;
      }
      function drawMotor(y) {
        // chain from the stars down to the motor
        for (let yy = -2; yy < y; yy += 3) { const alt = ((yy / 3 | 0) + Math.floor(rot * 6)) % 2 === 0; g.fillStyle = alt ? '#c8c8d4' : '#7a7a88'; g.fillRect(BX - (alt ? 1 : 0), yy, alt ? 3 : 1, 2); }
        g.fillStyle = '#5a5568'; g.fillRect(BX - 9, y, 18, 12);
        g.fillStyle = '#8a86a0'; g.fillRect(BX - 9, y, 18, 2);
        g.fillStyle = '#2a2636'; g.fillRect(BX - 7, y + 4, 12, 5);
        const ph = Math.floor(motorA) % 4;
        g.fillStyle = '#b0acc8'; for (let k = 0; k < 3; k++) g.fillRect(BX - 7 + ((k * 4 + ph) % 12), y + 4, 2, 5);
        g.fillStyle = (Math.floor(T * 4) % 2) ? '#5cff6a' : '#1d6a24'; g.fillRect(BX + 6, y + 3, 2, 2);
        g.fillStyle = 'rgba(220,220,255,0.7)';
        if (ph % 2) { g.fillRect(BX - 13, y + 3, 2, 1); g.fillRect(BX + 11, y + 8, 2, 1); } else { g.fillRect(BX - 14, y + 8, 2, 1); g.fillRect(BX + 12, y + 3, 2, 1); }
        for (let yy = y + 12; yy < ballY - BR + 1; yy += 3) { const alt = ((yy / 3 | 0) + Math.floor(rot * 6)) % 2 === 0; g.fillStyle = alt ? '#c8c8d4' : '#7a7a88'; g.fillRect(BX - (alt ? 1 : 0), yy, alt ? 3 : 1, 2); }
      }
      function star4(x, y, s, c) { g.fillStyle = c; g.fillRect(x - s, y, s * 2 + 1, 1); g.fillRect(x, y - s, 1, s * 2 + 1); if (s > 2) g.fillRect(x - 1, y - 1, 3, 3); }

      /* ================= main loop ================= */
      const stop = api.loop((dt, t) => {
        T += dt; pt += dt;
        const beat = beatNow(), bi = Math.floor(beat), bf = beat - bi;
        const pulse = Math.pow(1 - bf, 2);

        /* ---- phase logic ---- */
        if (phase === 'fw') {
          if (wordShots >= WORDS.length && !ROCKETS.length) { if (!fwDone) fwDone = T; if (T - fwDone > 3.2) { phase = 'night'; pt = 0; } }
        } else if (phase === 'night') {
          nightK = clamp(pt / 3, 0, 1);
          if (pt > 1.6 && !discoOn) { discoOn = true; api.music('disco'); }
          const dk = clamp((pt - 1.6) / 3.4, 0, 1);
          const ease = 1 - Math.pow(1 - dk, 3) + Math.sin(dk * Math.PI) * 0.06;
          ballY = lerp(-90, BY, ease);
          if (dk >= 1) { ballY = BY; phase = 'disco'; pt = 0; flash = 1; api.sfx('ding'); hintSpin = 6; }
        } else if (phase === 'disco') {
          lit = clamp(pt / 0.8, 0, 1);
          if (pt > 4.5) { buildCredits(); phase = 'credits'; pt = 0; }
        } else if (phase === 'credits') {
          const target = ((drag && drag.moved <= 6 && performance.now() - drag.t0 > 250) || keys.Space || keys.Enter ? 5 : 1) + boost;
          boost = Math.max(0, boost - dt * 3);
          speed = lerp(speed, target, Math.min(1, dt * 6));
          scroll += 20 * speed * dt;
          ORDER.forEach(w => { if (joinAt[w] != null && CB + joinAt[w] - scroll < MID + 10) join(w); });
          if (scroll >= S_END) {
            scroll = S_END; phase = 'end'; pt = 0;
            Object.keys(DANCERS).forEach(join);
            confetti(50, 150, 70); confetti(130, 150, 70);
            if (!won) { won = true; api.win(); }
          }
        } else if (phase === 'end') {
          if (Math.floor(pt / 2.6) !== Math.floor((pt - dt) / 2.6)) { const r = { x: rnd(20, 160), y: rnd(20, 100) }; ROCKETS.push({ x0: rnd(20, 160), y0: GY, x: 0, y: GY, tx: r.x, ty: r.y, t: 0, dur: 0.9, c: FWC[Math.random() * FWC.length | 0], kind: ['peony', 'ring', 'heart', 'willow'][Math.random() * 4 | 0], quiet: true }); }
        }
        if (phase !== 'fw' && phase !== 'night') lit = Math.max(lit, clamp(pt / 0.8, 0, 1));

        // spin momentum: back to motor speed
        if (!drag) spin += (0.9 - spin) * Math.min(1, dt * 0.55);
        rot += dt * spin; motorA += dt * (20 + Math.abs(spin) * 6);
        evaJump = Math.max(0, evaJump - dt);

        /* ---- background ---- */
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        g.drawImage(bgDay, 0, 0);
        if (nightK > 0) { g.globalAlpha = nightK; g.drawImage(bgNight, 0, 0); g.globalAlpha = 1; }
        // stars (also faintly at sunset)
        const sa = 0.15 + 0.85 * nightK;
        for (let i = 0; i < STARS.length; i++) {
          const s = STARS[i]; if (s.y > 200 - nightK * 40 && nightK < 1) continue;
          g.globalAlpha = sa * (0.5 + 0.5 * Math.sin(T * 2 + s.p)) * (s.y < 120 ? 1 : 1 - (s.y - 120) / 120);
          g.fillStyle = '#fff'; g.fillRect(s.x, s.y, 1, 1);
          if (s.b && nightK > 0.5) { g.fillRect(s.x - 1, s.y, 3, 1); g.fillRect(s.x, s.y - 1, 1, 3); }
        }
        g.globalAlpha = 1;

        /* ---- disco light: beams + reflection spots (behind credits) ---- */
        g.globalCompositeOperation = 'lighter';
        if (lit > 0) {
          const c1 = LIGHTS[bi % LIGHTS.length], c2 = LIGHTS[(bi + 3) % LIGHTS.length];
          beam(0, GY - 10, -Math.PI * 0.32 + Math.sin(T * 0.9) * 0.35, 340, 0.06, c1, (0.1 + 0.06 * pulse) * lit);
          beam(W, GY - 10, -Math.PI * 0.68 + Math.sin(T * 1.1 + 1) * 0.35, 340, 0.06, c2, (0.1 + 0.06 * pulse) * lit);
          // halo
          const hg = g.createRadialGradient(BX, ballY, BR * 0.6, BX, ballY, BR * 2.2);
          hg.addColorStop(0, `rgba(180,160,255,${0.22 * lit})`); hg.addColorStop(1, 'rgba(0,0,0,0)');
          g.globalAlpha = 1; g.fillStyle = hg; g.fillRect(BX - BR * 2.3, ballY - BR * 2.3, BR * 4.6, BR * 4.6);
        }
        const spotK = Math.max(lit, nightK > 0.6 && ballY > -BR ? 0.25 : 0);
        if (spotK > 0) {
          const fast = clamp(Math.abs(spin) / 20, 0, 1);
          for (let i = 0; i < DOTS.length; i++) {
            const d = DOTS[i], ph = d.a + rot, cz = Math.cos(ph);
            if (cz < -0.1) continue;
            const x = BX + Math.sin(ph) * 120, y = ballY + 18 + d.e * (H - ballY - 10) * (0.75 + 0.25 * cz);
            const a = clamp(cz * 1.6, 0, 1) * spotK;
            const col = d.c < 0 ? '#ffffff' : LIGHTS[(d.c + bi) % LIGHTS.length];
            if (d.beam && lit > 0) {
              const ang = Math.atan2(y - ballY, x - BX);
              beam(BX, ballY, ang, Math.hypot(x - BX, y - ballY), 0.02, col, 0.09 * a * (0.6 + 0.4 * pulse));
            }
            g.globalAlpha = a * (0.6 + 0.4 * Math.sin(T * 7 + i));
            g.fillStyle = col;
            const streak = Math.min(14, 1 + Math.abs(spin) * 0.35 * cz);
            if (streak > 2) { g.fillRect((spin > 0 ? x - streak : x) | 0, y | 0, streak | 0, d.s); }
            else g.fillRect(x | 0, y | 0, d.s + 1, d.s + (fast > 0.5 ? 0 : 1));
          }
        }
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';

        /* ---- summit ---- */
        g.drawImage(fgDay, 0, 0);
        if (nightK > 0) { g.globalAlpha = nightK; g.drawImage(fgNight, 0, 0); g.globalAlpha = 1; }
        if (lit > 0) {
          g.globalCompositeOperation = 'lighter';
          for (let k = 0; k < 7; k++) {
            const x = 12 + k * 26 + Math.sin(T + k) * 4;
            g.globalAlpha = lit * (((k + bi) % 3 === 0) ? 0.35 + 0.25 * pulse : 0.12);
            g.fillStyle = LIGHTS[(k + bi) % LIGHTS.length];
            g.beginPath(); g.ellipse(x, GY + 3, 13, 3, 0, 0, Math.PI * 2); g.fill();
          }
          // warm spot on Eva (& Niklas)
          beam(BX, ballY + BR, Math.PI / 2 + (DANCERS.eva.x - BX) * 0.004, GY - ballY - BR + 4, 0.17, '#fff6c8', lit * (0.08 + 0.04 * pulse));
          g.globalAlpha = lit * 0.3; g.fillStyle = '#fff6c8';
          g.beginPath(); g.ellipse((DANCERS.eva.x + (DANCERS.niklas.on ? DANCERS.niklas.x : DANCERS.eva.x)) / 2, GY, 26, 5, 0, 0, Math.PI * 2); g.fill();
          g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        }

        /* ---- credits (canvas text; photos are HTML) ---- */
        if (phase === 'credits' || phase === 'end') {
          // darken window slightly for legibility
          { const wg = g.createLinearGradient(0, CT, 0, CB); wg.addColorStop(0, "rgba(5,4,12,0)"); wg.addColorStop(0.15, "rgba(5,4,12,0.3)"); wg.addColorStop(0.85, "rgba(5,4,12,0.3)"); wg.addColorStop(1, "rgba(5,4,12,0)"); g.fillStyle = wg; g.fillRect(0, CT, W, CB - CT); }
          for (const it of ITEMS) {
            const y0 = CB + it.y - scroll;
            if (y0 > CB + 4 || y0 + it.h < CT - 4) continue;
            if (it.type === 'text') {
              const lh = it.size === 16 ? 20 : 11;
              it.lines.forEach((l, k) => ctext(l, y0 + k * lh, it.color, it.size, windowAlpha(y0 + k * lh + 4)));
            } else if (it.type === 'role') {
              it.lines.forEach((l, k) => ctext(l, y0 + k * 11, it.color, 8, windowAlpha(y0 + k * 11 + 4)));
              const ry = y0 + it.lines.length * 11 + 4;
              const a = windowAlpha(ry + 16);
              if (a > 0) {
                const nw = it.name.length * 8, gw = 24 + 8 + nw, gx = Math.round(W / 2 - gw / 2);
                g.globalAlpha = a;
                g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(gx - 2, ry - 2, 28, 36);
                g.fillStyle = it.color; g.fillRect(gx - 2, ry - 2, 28, 1); g.fillRect(gx - 2, ry + 33, 28, 1); g.fillRect(gx - 2, ry - 2, 1, 36); g.fillRect(gx + 25, ry - 2, 1, 36);
                const fr = (bi % 2) ? 'idle' : (it.who === 'eva' ? 'jump' : 'run1');
                api.drawChar(g, it.who, fr, gx, Math.round(ry + (bi % 2 ? 0 : -1)), 2, false);
                api.text(g, it.name, gx + 32, ry + 12, 8, it.who === 'eva' ? LIGHTS[bi % LIGHTS.length] : '#ffffff', 'left');
                g.globalAlpha = 1;
              }
            } else if (it.type === 'gift') {
              ctext('GESCHENK', y0, '#f5c542', 8, windowAlpha(y0 + 4));
              ctext('1× DISKO-KUGEL', y0 + 13, '#ffffff', 8, windowAlpha(y0 + 17));
              ctext('MIT MOTOR', y0 + 24, '#ffffff', 8, windowAlpha(y0 + 28));
              const a = windowAlpha(y0 + 44);
              if (a > 0) {
                g.globalAlpha = a; api.text(g, '(DIE DA OBEN!)', W / 2 - 6, y0 + 40, 8, LIGHTS[bi % LIGHTS.length], 'center');
                // little pixel arrow pointing up at the ball
                const ax = W / 2 + 58, ay = y0 + 36 - (bi % 2) * 2;
                g.fillStyle = '#fff'; g.fillRect(ax, ay, 2, 10); g.fillRect(ax - 2, ay + 2, 6, 1); g.fillRect(ax - 1, ay + 1, 4, 1);
                g.globalAlpha = 1;
              }
            } else if (it.type === 'final') {
              rainbow('ALLES GUTE', y0, 8, beat);
              rainbow('ZUM GEBURTSTAG,', y0 + 14, 8, beat);
              rainbow(NAME + '!', y0 + 30, 16, beat);
              const fl = wrap(fromStr, 21);
              fl.forEach((l, k) => ctext(l, y0 + 58 + k * 11, '#f6e7c8', 8, windowAlpha(y0 + 62 + k * 11)));
            }
          }
          if (phase === 'credits' && speed > 1.6) { g.globalAlpha = 0.8; api.text(g, '>>', W - 6, CT + 2, 8, '#f5c542', 'right'); g.globalAlpha = 1; }
        }

        /* ---- dancers / Eva ---- */
        const dancing = phase !== 'fw' && phase !== 'night';
        const list = Object.values(DANCERS).filter(d => d.on).sort((a, b) => a.tx - b.tx);
        for (const d of list) {
          let frame = 'idle', flip = false, dx = 0, dy = 0;
          if (d.x !== d.tx) {
            const dir = Math.sign(d.tx - d.x); d.x += dir * Math.min(Math.abs(d.tx - d.x), 55 * dt);
            frame = Math.floor(T * 10) % 2 ? 'run1' : 'run2'; flip = dir < 0;
          } else if (dancing) { const p = pose(d, beat); frame = p.frame; flip = p.flip; dx = p.dx; dy = p.dy; }
          else if (d.who === 'eva') {
            if (evaJump > 0) { frame = 'jump'; dy = -Math.sin(evaJump / 0.35 * Math.PI) * 5; }
            else if (phase === 'night') { frame = Math.floor(T * 3) % 2 ? 'idle' : 'run1'; }
          }
          g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(Math.round(d.x - 9 + dx), GY - 1, 18, 2);
          api.drawChar(g, d.who, frame, Math.round(d.x - 12 + dx), Math.round(GY - 32 + dy), 2, flip);
        }
        if (phase === 'fw') { // little launcher tube next to Eva
          g.fillStyle = '#d94c3d'; g.fillRect(102, GY - 10, 4, 10); g.fillStyle = '#f5c542'; g.fillRect(102, GY - 10, 4, 2);
        }
        if (DANCERS.niklas.on && DANCERS.niklas.x === DANCERS.niklas.tx) {
          if (bi !== lastHeart && HEARTS.length < 6) { lastHeart = bi; HEARTS.push({ x: (DANCERS.eva.x + DANCERS.niklas.x) / 2 + rnd(-4, 4), y: GY - 36, t: 0, c: Math.random() < 0.5 ? '#ff3f7a' : '#ff8fb8' }); }
        }
        for (let i = HEARTS.length - 1; i >= 0; i--) {
          const h = HEARTS[i]; h.t += dt; h.y -= 16 * dt; h.x += Math.sin(h.t * 4) * 0.3;
          if (h.t > 2) { HEARTS.splice(i, 1); continue; }
          g.globalAlpha = Math.min(1, (2 - h.t) * 1.5); api.drawPixels(g, HEART, { X: h.c }, h.x - 3 | 0, h.y | 0, 1); g.globalAlpha = 1;
        }

        /* ---- disco ball ---- */
        if (ballY > -BR - 40) {
          drawMotor(ballY - BR - 19);
          renderBall(rot, beat);
          g.drawImage(ballC, BX - BR, Math.round(ballY) - BR);
          // glints follow the facets that catch the light
          for (let k = 0; k < Math.min(4, glints.length); k++) {
            const gl = glints[k], s = 1 + Math.round(gl.s * 3 + (Math.sin(T * 9 + k * 2) > 0.3 ? 1 : 0));
            star4(Math.round(gl.x), Math.round(gl.y), s, '#ffffff');
          }
          // big rotating sparkle
          const sp = (T * 0.7) % 1;
          if (sp < 0.3) { const s = Math.round(Math.sin(sp / 0.3 * Math.PI) * 6); star4(BX - 14, Math.round(ballY) - 16, s, '#fffbe0'); }
          if (hintSpin > 0 && canSpin()) {
            hintSpin -= dt;
            if (Math.floor(T * 2.5) % 2) {
              api.text(g, 'WISCHEN', BX, ballY + BR + 6, 8, '#fff', 'center');
              api.text(g, '= DREHEN!', BX, ballY + BR + 16, 8, '#fff', 'center');
            }
            // swipe hand arrows
            const ox = Math.sin(T * 4) * 8;
            g.fillStyle = '#f5c542'; g.fillRect(BX - BR - 14 + ox, ballY, 8, 2); g.fillRect(BX - BR - 8 + ox, ballY - 2, 2, 6);
            g.fillRect(BX + BR + 6 + ox, ballY, 8, 2); g.fillRect(BX + BR + 12 + ox, ballY - 2, 2, 6);
          }
        }

        /* ---- rockets & fireworks particles ---- */
        g.globalCompositeOperation = 'lighter';
        for (let i = ROCKETS.length - 1; i >= 0; i--) {
          const r = ROCKETS[i]; r.t += dt;
          const k = clamp(r.t / r.dur, 0, 1), e = 1 - (1 - k) * (1 - k);
          const px = r.x, py = r.y;
          r.x = lerp(r.x0, r.tx, e) + Math.sin(r.t * 18) * (1 - k) * 1.5; r.y = lerp(r.y0, r.ty, e);
          // trail
          for (let s = 0; s < 3; s++) P.push({ x: lerp(px, r.x, s / 3) + rnd(-0.5, 0.5), y: lerp(py, r.y, s / 3), vx: rnd(-8, 8), vy: rnd(5, 20), life: 0.45, max: 0.45, c: s ? '#ffcf6a' : '#ffffff', kind: 'trail', g: 20, drag: 2 });
          g.fillStyle = '#fff'; g.fillRect(r.x - 1 | 0, r.y - 1 | 0, 2, 3);
          if (k >= 1) {
            ROCKETS.splice(i, 1);
            if (r.word != null) wordBurst(r.word, r.x, r.y);
            else { if (r.quiet) { const f = flash; burst(r.x, r.y, r.c, r.kind); flash = Math.max(f, 0.12); } else burst(r.x, r.y, r.c, r.kind || 'peony'); }
          }
        }
        for (let i = P.length - 1; i >= 0; i--) {
          const p = P[i];
          if (p.kind === 'letter') {
            p.t += dt;
            const k = clamp((p.t - p.delay) / 0.7, 0, 1), e = 1 - Math.pow(1 - k, 3);
            if (phase === 'fw' || (phase === 'night' && pt < 0.8)) { p.x = lerp(p.sx, p.tx, e); p.y = lerp(p.sy, p.ty, e); }
            else { // letters drip down & fade as night falls (willow)
              p.vy = (p.vy || 0) + 14 * dt; p.y += p.vy * dt; p.fade = (p.fade == null ? 1 : p.fade) - dt * 0.35;
              if (p.fade <= 0) { P.splice(i, 1); continue; }
            }
            const tw = 0.65 + 0.35 * Math.sin(T * 8 + p.ph);
            g.globalAlpha = tw * (p.fade == null ? 1 : p.fade);
            g.fillStyle = p.c; g.fillRect(p.x - 2 | 0, p.y - 2 | 0, 4, 4);
            g.globalAlpha *= 0.9; g.fillStyle = '#fff'; g.fillRect(p.x - 1 | 0, p.y - 1 | 0, 2, 2);
            if (Math.sin(T * 5 + p.ph * 3) > 0.97) { g.globalAlpha = 1; star4(p.x | 0, p.y | 0, 3, '#fff'); }
            continue;
          }
          p.life -= dt;
          if (p.life <= 0) { P.splice(i, 1); continue; }
          const dk = Math.exp(-p.drag * dt);
          p.vx *= dk; p.vy = p.vy * dk + p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
          const lk = p.life / p.max;
          g.globalAlpha = p.crackle ? (Math.random() < 0.6 ? lk : 0.1) : Math.min(1, lk * 1.4);
          g.fillStyle = lk < 0.3 && p.kind !== 'trail' ? '#ff9a4a' : p.c;
          const s = lk > 0.6 && p.kind !== 'trail' ? 2 : 1;
          g.fillRect(p.x | 0, p.y | 0, s, s);
        }
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';

        /* ---- confetti ---- */
        for (let i = CF.length - 1; i >= 0; i--) {
          const p = CF[i]; p.vy += 120 * dt; p.vx *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.ph += dt * 10;
          if (p.life <= 0 || p.y > H + 4) { CF.splice(i, 1); continue; }
          g.fillStyle = p.c; g.fillRect(p.x | 0, p.y | 0, Math.sin(p.ph) > 0 ? 2 : 1, 2);
        }

        /* ---- HUD texts ---- */
        if (phase === 'fw') {
          if (freeShots < FREE) {
            if (freeShots === 0 || T - lastTap > 4) { if (Math.floor(T * 2) % 2) { api.text(g, 'TIPP IN DEN', W / 2, 190, 8, '#fff', 'center'); api.text(g, 'HIMMEL!', W / 2, 201, 8, '#fff', 'center'); } }
            api.text(g, 'RAKETEN ' + freeShots + '/' + FREE, W / 2, 6, 8, '#f5c542', 'center');
          } else if (wordShots < WORDS.length) {
            api.text(g, 'GROSSE RAKETE', W / 2, 190, 8, Math.floor(T * 3) % 2 ? '#ffd84a' : '#ff7ad0', 'center');
            api.text(g, 'TIPPEN! ' + (wordShots + 1) + '/' + WORDS.length, W / 2, 201, 8, '#fff', 'center');
          }
        }
        if (phase === 'end' && pt > 2 && Math.floor(T * 1.5) % 2) {
          api.text(g, 'TIPPEN = KONFETTI', W / 2, CB + 1, 8, '#fff', 'center');
        }

        if (flash > 0) { g.globalAlpha = flash * 0.5; g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; flash = Math.max(0, flash - dt * 3); }

        layoutOverlay();
      });

      return function cleanup() {
        stop();
        cv.canvas.removeEventListener('pointerdown', onDown);
        cv.canvas.removeEventListener('pointermove', onMove);
        cv.canvas.removeEventListener('pointerup', onUp);
        cv.canvas.removeEventListener('pointercancel', onUp);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('keyup', onKey);
        ov.remove();
        if (contentTag) contentTag.remove();
        cv.destroy();
      };
    }
  };
})();

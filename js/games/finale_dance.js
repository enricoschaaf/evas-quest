/* Finale "Dance-Off": dramatic gift reveal (motorized disco ball), then a short, unfailable rhythm dance-off.
   Every groove milestone brings another friend onto the dancefloor and powers up the ball. Climax + endless free play. */
(function () {
  'use strict';
  const W = 180, H = 320;
  const LIGHTS = ['#ff3fa4', '#3fe0ff', '#ffe23f', '#7cff4f', '#b45cff', '#ff8a2a'];
  const rgb = hex => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  const LRGB = LIGHTS.map(rgb);
  const CONF = ['#f5c542', '#d94c3d', '#6fae4f', '#4a7fd9', '#f2a7b8', '#8a5bd9', '#ffffff', '#3fe0ff'];
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const ease = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
  const easeOut = k => { k = clamp(k, 0, 1); return 1 - (1 - k) * (1 - k); };
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };

  GAMES['finale_dance'] = {
    title: 'Dance-Off',
    intro: 'Das große Finale! Tippe im Takt auf die Pfeile – jede gute Serie holt einen Freund auf die Tanzfläche. Wische über die Disco-Kugel, um sie zu drehen!',
    start(root, api) {
      const E = window.Engine;
      const cv = api.makeCanvas(root, W, H);
      const g = cv.ctx;
      api.music('disco');

      const FLOOR_Y = 150, STAGE_Y = 264;
      const BX = 90, BY = 88, BR = 34, BD = BR * 2 + 1;
      const LANE_X = [36, 90, 144], PAD_Y = 286, SPEED = 60, LEAD = 2.3;

      /* ---------- beat clock: smooth wall clock @120 bpm, phase-locked to the audio clock when it runs ---------- */
      const t0 = performance.now();
      let beatOff = 0, beat = 0;
      function updBeat(dt) {
        const wall = (performance.now() - t0) / 500;
        const ab = E.Audio.beat && E.Audio.beat();
        if (ab != null && E.Audio.bpm && E.Audio.bpm() === 120) {
          let d = (ab - (wall + beatOff)) % 1; if (d > 0.5) d -= 1; if (d < -0.5) d += 1;
          beatOff += d * Math.min(1, dt * 3);
        }
        beat = Math.max(beat, wall + beatOff); // never runs backwards
      }

      /* ---------- static background ---------- */
      const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
      const bgg = bg.getContext('2d');
      for (let y = 0; y < FLOOR_Y; y++) {
        const k = y / FLOOR_Y;
        bgg.fillStyle = `rgb(${16 + k * 16 | 0},${7 + k * 6 | 0},${30 + k * 22 | 0})`; bgg.fillRect(0, y, W, 1);
      }
      bgg.fillStyle = 'rgba(255,255,255,0.035)';
      for (let x = 6; x < W; x += 28) bgg.fillRect(x, 26, 1, FLOOR_Y - 30);
      bgg.fillStyle = '#0a0612'; bgg.fillRect(0, 0, W, 24);
      bgg.fillStyle = '#1c1428'; bgg.fillRect(0, 22, W, 2);
      bgg.fillStyle = '#05030a'; bgg.fillRect(0, FLOOR_Y - 3, W, 3);
      function speaker(x) {
        bgg.fillStyle = '#0c0c10'; bgg.fillRect(x, 96, 22, 52);
        bgg.fillStyle = '#24242c'; bgg.fillRect(x + 1, 97, 20, 50);
        bgg.fillStyle = '#0c0c10';
        bgg.beginPath(); bgg.arc(x + 11, 110, 6, 0, 7); bgg.fill();
        bgg.beginPath(); bgg.arc(x + 11, 132, 8, 0, 7); bgg.fill();
        bgg.fillStyle = '#3a3a46'; bgg.fillRect(x + 10, 109, 2, 2); bgg.fillRect(x + 10, 131, 2, 2);
      }
      speaker(2); speaker(W - 24);
      bgg.fillStyle = '#07040c'; bgg.fillRect(0, FLOOR_Y, W, STAGE_Y - FLOOR_Y);
      bgg.fillStyle = '#0d0716'; bgg.fillRect(0, STAGE_Y, W, H - STAGE_Y);
      bgg.fillStyle = '#1a1026'; for (let x = 0; x < W; x += 12) bgg.fillRect(x, STAGE_Y + 3, 11, 1);

      const ROWS = [12, 15, 18, 21, 22, 26];
      const tiles = [];
      let yy = FLOOR_Y;
      ROWS.forEach((rh, r) => {
        const cols = 7, rowW = 150 + r * 14 + (r === ROWS.length - 1 ? 30 : 0);
        const tw = rowW / cols, x0 = (W - rowW) / 2;
        for (let c = 0; c < cols; c++) tiles.push({ r, c, x: Math.round(x0 + c * tw), y: yy, w: Math.round(x0 + (c + 1) * tw) - Math.round(x0 + c * tw), h: rh });
        yy += rh;
      });

      /* ---------- pseudo-3D faceted disco ball ---------- */
      const ballC = document.createElement('canvas'); ballC.width = BD; ballC.height = BD;
      const ballG = ballC.getContext('2d');
      const img = ballG.createImageData(BD, BD);
      const LATN = 14, LONN = 28;
      const PX = [];
      for (let y = 0; y < BD; y++) for (let x = 0; x < BD; x++) {
        const nx = (x - BR) / BR, ny = (y - BR) / BR, d = nx * nx + ny * ny;
        if (d > 1) continue;
        const nz = Math.sqrt(1 - d), lat = Math.asin(ny), lon = Math.atan2(nx, nz);
        const latf = (lat / Math.PI + 0.5) * LATN, fi = Math.min(LATN - 1, Math.floor(latf));
        const latC = ((fi + 0.5) / LATN - 0.5) * Math.PI, cosC = Math.cos(latC);
        PX.push({ i: (y * BD + x) * 4, lon, fi, fr: latf - fi, cosC, sinC: Math.sin(latC), ncols: Math.max(4, Math.round(LONN * cosC / 2) * 2), d });
      }
      const L1 = [-0.48, -0.6, 0.64], L2 = [0.62, 0.45, 0.64];
      function renderBall(rot, glow, tintN) {
        const dd = img.data, bi = Math.floor(beat);
        const tint = LRGB[((bi % 6) + 6) % 6], tint2 = LRGB[((bi + 2) % 6 + 6) % 6];
        const thr = 1 - tintN;
        for (let k = 0; k < PX.length; k++) {
          const p = PX[k];
          const lf = (p.lon + rot) / (Math.PI * 2) * p.ncols;
          const fj = Math.floor(lf), fc = lf - fj, jj = ((fj % p.ncols) + p.ncols) % p.ncols;
          const lonC = (fj + 0.5) / p.ncols * Math.PI * 2 - rot;
          const nx = p.cosC * Math.sin(lonC), ny = p.sinC, nz = p.cosC * Math.cos(lonC);
          const dif = Math.max(0, nx * L1[0] + ny * L1[1] + nz * L1[2]);
          const rx = 2 * nz * nx, ry = 2 * nz * ny, rz = 2 * nz * nz - 1;
          let s1 = Math.max(0, rx * L1[0] + ry * L1[1] + rz * L1[2]); s1 = s1 * s1; s1 = s1 * s1; s1 = s1 * s1 * s1; // ^24
          let s2 = Math.max(0, rx * L2[0] + ry * L2[1] + rz * L2[2]); s2 = s2 * s2; s2 = s2 * s2; s2 = s2 * s2 * s2;
          const h = hash(p.fi, jj);
          const v = 34 + 150 * dif * (0.55 + 0.45 * h);
          let r = v, gg = v, b = v * 1.1 + 6;
          if (h > thr) { const tc = h > (1 + thr) / 2 ? tint : tint2; r = r * 0.45 + tc[0] * 0.6 * (0.4 + dif); gg = gg * 0.45 + tc[1] * 0.6 * (0.4 + dif); b = b * 0.45 + tc[2] * 0.6 * (0.4 + dif); }
          const w1 = s1 * 300;
          r += w1; gg += w1; b += w1;
          const c2 = s2 * 260 * glow; r += tint[0] / 255 * c2; gg += tint[1] / 255 * c2; b += tint[2] / 255 * c2;
          if (((h * 97 + beat * 0.5) % 1) < 0.02 + 0.03 * glow) { r = gg = b = 255; }
          if (p.fr < 0.13 || fc < 0.13) { r *= 0.3; gg *= 0.3; b *= 0.38; }
          if (p.d > 0.9) { r *= 0.62; gg *= 0.6; b *= 0.75; }
          dd[p.i] = r > 255 ? 255 : r; dd[p.i + 1] = gg > 255 ? 255 : gg; dd[p.i + 2] = b > 255 ? 255 : b; dd[p.i + 3] = 255;
        }
        ballG.putImageData(img, 0, 0);
      }

      /* ---------- arrows ---------- */
      const UP = ['.....X.....', '....XXX....', '...XXXXX...', '..XXXXXXX..', '.XXXXXXXXX.', 'XXXXXXXXXXX',
                  '...XXXXX...', '...XXXXX...', '...XXXXX...', '...XXXXX...', '...XXXXX...'];
      const LEFT = UP.map((_, y) => UP.map(r => r[y]).join(''));
      const RIGHT = LEFT.map(r => r.split('').reverse().join(''));
      const SHAPES = [LEFT, UP, RIGHT];
      const LANE_COL = ['#ff3fa4', '#ffe23f', '#3fe0ff'];
      function makeArrow(rows, fill, outline, hi) {
        const c = document.createElement('canvas'); c.width = 13; c.height = 13;
        const x = c.getContext('2d');
        for (const [ox, oy] of [[0, 1], [2, 1], [1, 0], [1, 2], [0, 0], [2, 2], [0, 2], [2, 0]]) api.drawPixels(x, rows, { X: outline }, ox, oy, 1);
        api.drawPixels(x, rows, { X: fill }, 1, 1, 1);
        if (hi) { x.globalCompositeOperation = 'source-atop'; x.fillStyle = hi; x.fillRect(0, 0, 13, 4); }
        return c;
      }
      const ARW = SHAPES.map((s, i) => ({
        note: makeArrow(s, LANE_COL[i], '#1a0d24', 'rgba(255,255,255,0.35)'),
        pad: makeArrow(s, '#2a1c3c', LANE_COL[i]),
        lit: makeArrow(s, '#ffffff', LANE_COL[i])
      }));

      /* ---------- chart (song beats; notes from s=4, climax at s=92) ---------- */
      const NOTES = [];
      let ln = 1, rep = 0, seed = 7;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      function lane() { let l = Math.floor(rnd() * 3); if (l === ln) { rep++; if (rep > 1) { l = (l + 1 + Math.floor(rnd() * 2)) % 3; rep = 0; } } else rep = 0; ln = l; return l; }
      for (let s = 4; s < 88; s++) {
        const bar = s % 4;
        if (s < 28) { if (bar !== 3) NOTES.push({ b: s, l: lane() }); }
        else if (s < 56) { NOTES.push({ b: s, l: lane() }); if (bar === 2) NOTES.push({ b: s + 0.5, l: lane() }); }
        else { NOTES.push({ b: s, l: lane() }); if (bar === 1 || (bar === 3 && s % 8 === 7)) NOTES.push({ b: s + 0.5, l: lane() }); }
      }
      NOTES.push({ b: 88, l: 1 }, { b: 89, l: 0 }, { b: 90, l: 2 });
      const END_S = 93;
      const TOTAL = NOTES.length;

      /* ---------- dancers ---------- */
      const FRIENDS = [
        { who: 'magnus', name: 'MAGNUS', x: 30, y: 214, style: 'side', from: -16 },
        { who: 'laurenz', name: 'LAURENZ', x: 150, y: 214, style: 'pogo', from: W + 16 },
        { who: 'hannah', name: 'HANNAH', x: 34, y: 254, style: 'sway', from: -16 },
        { who: 'enrico', name: 'ENRICO', x: 146, y: 254, style: 'robot', from: W + 16 },
        { who: 'niklas', name: 'NIKLAS', x: 106, y: 238, style: 'couple', side: 1, from: W + 16 }
      ];
      FRIENDS.forEach(f => { f.joined = false; f.jt = 0; });
      const THRESH = [6, 16, 28, 42, 56];
      const eva = { x: 56, y: 238, tx: 56, flip: false, mv: null };

      function pose(d, b) {
        const bi = Math.floor(b), f = b - bi, bar = ((bi % 4) + 4) % 4;
        const bounce = Math.sin(Math.PI * f);
        let dx = 0, dy = -bounce * 3, frame = bi % 2 ? 'run1' : 'run2', flip = false;
        switch (d.style) {
          case 'side': dx = Math.sin(b * Math.PI / 2) * 6; flip = (bi % 2) === 1; dy = -bounce * 2; break;
          case 'pogo': if (bar % 2 === 1) { dy = -bounce * 10; frame = 'jump'; } else { dy = 0; frame = 'idle'; } flip = true; break;
          case 'couple': {
            const twirl = ((bi >> 2) % 4) === 3;
            flip = d.side === 1;
            if (twirl) { dx = (d.side ? -1 : 1) * Math.sin(Math.PI * ((bi % 4) + f) / 4) * 12; flip = (bi % 2) === 1; if (bar === 3) { frame = 'jump'; dy = -bounce * 8; } }
            else frame = bar % 2 ? 'run1' : 'idle';
            break;
          }
          case 'sway':
            dx = Math.sin(b * Math.PI) * 3; dy = -Math.abs(Math.sin(b * Math.PI)) * 2;
            flip = ((bi >> 2) % 2) === 1; frame = bar % 2 ? 'run1' : 'idle';
            if (((bi >> 3) % 2) && bar === 3) { dy = -bounce * 9; frame = 'jump'; }
            break;
          case 'robot':
            dx = (Math.floor(b * 2) % 4 - 1.5) * 2; dy = (Math.floor(b * 2) % 2) ? -2 : 0;
            frame = ['idle', 'run1', 'idle', 'run2'][((Math.floor(b * 2) % 4) + 4) % 4]; flip = ((bi >> 1) % 2) === 0;
            break;
        }
        return { dx, dy, frame, flip };
      }

      /* ---------- state ---------- */
      let phase = 'reveal', rt = 0, song0 = 0, ct = 0, won = false;
      let lightsOn = 0, flash = 0, shake = 0, spark = 0.4, groove = 0, combo = 0, best = 0, hits = 0, perfects = 0;
      let rot = 0, spin = 0.5, motorA = 0, drag = null, joined = 0;
      const box = { y: -44, vy: 0, landed: false, bounced: 0, lid: 0, lidX: 0, gone: 0 };
      const ballPos = { x: BX, y: 230, s: 0.5, vis: false };
      let chainEnd = 36;
      let judge = null, banner = null, hintT = 0, nextFw = 0, lastBoom = 0;
      const padLit = [0, 0, 0];
      const P = [], FW = [], ROCK = [], HEARTS = [], SPARK = [];
      const DOTS = [];
      for (let i = 0; i < 90; i++) DOTS.push({ a: Math.random(), y: 28 + Math.random() * (STAGE_Y - 34), sp: 0.7 + Math.random() * 0.6, c: Math.random() < 0.5 ? -1 : (Math.random() * 6 | 0), s: Math.random() < 0.25 ? 2 : 1 });
      const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
      let lastHeartBeat = -1;

      const power = () => phase === 'climax' ? 6 : joined;
      const glowLvl = () => phase === 'climax' ? 1 : clamp(0.28 + 0.12 * joined + 0.25 * spark, 0, 1);

      function confetti(x, y, n, up) {
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, v = 30 + Math.random() * 90;
          P.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (up || 50), c: CONF[Math.random() * CONF.length | 0], life: 1.4 + Math.random(), ph: Math.random() * 6 });
        }
        if (P.length > 500) P.splice(0, P.length - 500);
      }
      function explode(x, y, col) {
        const n = 34 + (Math.random() * 14 | 0), c2 = LIGHTS[Math.random() * 6 | 0];
        for (let i = 0; i < n; i++) {
          const a = i / n * Math.PI * 2 + Math.random() * 0.1, v = 40 + Math.random() * 28;
          FW.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: i % 3 ? col : c2, life: 1 + Math.random() * 0.6 });
        }
        if (FW.length > 700) FW.splice(0, FW.length - 700);
        const now = performance.now();
        if (now - lastBoom > 900) { lastBoom = now; api.sfx('boom'); }
      }
      function rocket(tx, ty) {
        ROCK.push({ x: tx + (Math.random() - 0.5) * 30, y: STAGE_Y, tx, ty, c: LIGHTS[Math.random() * 6 | 0], tr: [] });
      }
      function sparkle(x, y, n) { for (let i = 0; i < n; i++) SPARK.push({ x: x + (Math.random() - 0.5) * 24, y: y + (Math.random() - 0.5) * 24, t: Math.random() * 0.3 }); }

      function joinNext() {
        if (joined >= FRIENDS.length) return;
        const f = FRIENDS[joined++];
        f.joined = true; f.jt = 0;
        if (f.who === 'niklas') { eva.tx = 76; banner = { s1: 'NIKLAS TANZT', s2: 'MIT EVA!', t: 0, c: '#ff8fb8' }; }
        else banner = { s1: f.name, s2: 'TANZT MIT!', t: 0, c: LIGHTS[joined % 6] };
        api.sfx('coin'); flash = Math.max(flash, 0.35); spin += 4;
        sparkle(f.x, f.y - 16, 10);
      }

      /* ---------- input ---------- */
      function hitLane(l) {
        if (phase !== 'dance') return;
        padLit[l] = 1;
        const s = beat - song0;
        let bestN = null, bd = 9;
        for (const n of NOTES) { if (n.done || n.l !== l) continue; const d = Math.abs(n.b - s); if (d < bd) { bd = d; bestN = n; } }
        if (!bestN || bd > 0.44) return; // stray tap: no penalty
        bestN.done = true; bestN.hit = true; bestN.ht = 0;
        const perfect = bd < 0.17;
        combo++; best = Math.max(best, combo); hits++;
        if (perfect) perfects++;
        groove += (perfect ? 1.25 : 1) + (combo >= 10 ? 0.4 : 0);
        spark = Math.min(1, spark + (perfect ? 0.16 : 0.1));
        spin += perfect ? 0.7 : 0.4;
        judge = { txt: perfect ? 'PERFEKT!' : 'GUT!', c: perfect ? '#ffe23f' : '#7cff4f', t: 0 };
        eva.mv = { l, t: 0 };
        sparkle(LANE_X[l], PAD_Y, perfect ? 6 : 3);
        api.sfx(perfect ? 'click' : 'step');
        while (joined < FRIENDS.length && groove >= THRESH[joined]) joinNext();
      }
      function miss() {
        combo = 0; spark = Math.max(0, spark - 0.22);
        judge = { txt: 'HOPPLA!', c: '#b45cff', t: 0 };
      }
      const laneOf = x => x < 63 ? 0 : x < 117 ? 1 : 2;
      const canSpin = () => phase !== 'reveal';
      const onDown = e => {
        e.preventDefault();
        const p = cv.pointer(e);
        if (phase === 'dance' && p.y >= STAGE_Y) { hitLane(laneOf(p.x)); return; }
        if (!drag) { drag = { id: e.pointerId, x0: p.x, y0: p.y, x: p.x, t: performance.now(), moved: 0 }; try { cv.canvas.setPointerCapture(e.pointerId); } catch (_) {} }
      };
      const onMove = e => {
        if (!drag || e.pointerId !== drag.id) return;
        const p = cv.pointer(e), dx = p.x - drag.x, now = performance.now(), dtm = Math.max(8, now - drag.t);
        drag.moved += Math.abs(dx); drag.x = p.x; drag.t = now;
        if (drag.moved > 6 && canSpin()) { spin = clamp(spin * 0.6 + (dx / dtm) * 1000 * 0.08, -40, 40); hintT = 0; }
      };
      const onUp = e => {
        if (!drag || e.pointerId !== drag.id) return;
        const d = drag; drag = null;
        if (d.moved <= 6) {
          if (phase === 'climax') { confetti(clamp(d.x0, 10, W - 10), clamp(d.y0, 10, H - 10), 40); flash = Math.max(flash, 0.3); api.sfx('coin'); if (d.y0 < STAGE_Y) rocket(clamp(d.x0, 20, W - 20), clamp(d.y0, 30, 150)); }
        } else if (Math.abs(spin) > 12 && canSpin()) api.sfx('launch');
      };
      const KEYS = { ArrowLeft: 0, KeyA: 0, ArrowUp: 1, KeyW: 1, Space: 1, ArrowRight: 2, KeyD: 2, ArrowDown: 1, KeyS: 1 };
      const onKey = e => {
        if (e.repeat) return;
        if (phase === 'dance' && e.code in KEYS) { e.preventDefault(); hitLane(KEYS[e.code]); return; }
        if (phase === 'climax') {
          if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); confetti(30 + Math.random() * 120, 120 + Math.random() * 100, 40); rocket(30 + Math.random() * 120, 40 + Math.random() * 80); api.sfx('coin'); }
          if (e.code === 'ArrowLeft') { e.preventDefault(); spin -= 8; }
          if (e.code === 'ArrowRight') { e.preventDefault(); spin += 8; }
        }
      };
      cv.canvas.addEventListener('pointerdown', onDown);
      cv.canvas.addEventListener('pointermove', onMove);
      cv.canvas.addEventListener('pointerup', onUp);
      cv.canvas.addEventListener('pointercancel', onUp);
      window.addEventListener('keydown', onKey);

      /* ---------- drawing helpers ---------- */
      function beam(x, y, ang, len, spread, color, alpha) {
        g.globalAlpha = alpha; g.fillStyle = color;
        g.beginPath(); g.moveTo(x, y);
        g.lineTo(x + Math.cos(ang - spread) * len, y + Math.sin(ang - spread) * len);
        g.lineTo(x + Math.cos(ang + spread) * len, y + Math.sin(ang + spread) * len);
        g.closePath(); g.fill();
      }
      function outlined(str, x, y, size, col, align) {
        g.save();
        g.font = size + 'px "Press Start 2P", monospace'; g.textAlign = align || 'center'; g.textBaseline = 'top';
        g.fillStyle = '#12061c';
        const o = size >= 16 ? 2 : 1;
        for (const [ox, oy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, o], [-o, o], [o, -o], [o, o + 1], [0, o + 1]]) g.fillText(str, x + ox, y + oy);
        g.fillStyle = col; g.fillText(str, x, y);
        g.restore();
      }
      // letter-by-letter drop-in, rainbow cycling with the beat
      function bigLine(str, y, size, t0) {
        const n = str.length, x0 = W / 2 - n * size / 2;
        for (let i = 0; i < n; i++) {
          const k = (ct - t0 - i * 0.05) / 0.35;
          if (k <= 0 || str[i] === ' ') continue;
          const dy = k < 1 ? -(1 - easeOut(k)) * 40 + Math.sin(k * Math.PI) * -6 : Math.sin(beat * Math.PI * 2 / 2 + i * 0.6) * 1.2;
          const col = LIGHTS[(i + Math.floor(beat)) % 6];
          outlined(str[i], x0 + i * size + size / 2, y + dy, size, k < 1 ? '#ffffff' : col);
        }
      }
      function drawBox(x, y) { // y = bottom
        const bw = 34, bh = 26;
        g.fillStyle = '#7a1e2a'; g.fillRect(x - bw / 2, y - bh, bw, bh);
        g.fillStyle = '#d94c3d'; g.fillRect(x - bw / 2 + 1, y - bh + 1, bw - 2, bh - 2);
        g.fillStyle = '#ef6a5a'; g.fillRect(x - bw / 2 + 1, y - bh + 1, bw - 2, 2);
        g.fillStyle = '#f5c542'; g.fillRect(x - 3, y - bh, 6, bh); g.fillStyle = '#c8962a'; g.fillRect(x + 2, y - bh, 1, bh);
        // dots pattern
        g.fillStyle = '#f2a7b8';
        for (let yy2 = 0; yy2 < 3; yy2++) for (let xx2 = 0; xx2 < 4; xx2++) { const px2 = x - 14 + xx2 * 8 + (xx2 > 1 ? 6 : 0) - (xx2 > 1 ? 4 : 0), py2 = y - 21 + yy2 * 8; if (Math.abs(px2 - x) > 4) g.fillRect(px2, py2, 2, 2); }
      }
      function drawLid(x, y) { // y = bottom of lid
        g.fillStyle = '#7a1e2a'; g.fillRect(x - 19, y - 8, 38, 8);
        g.fillStyle = '#e0584a'; g.fillRect(x - 18, y - 7, 36, 6);
        g.fillStyle = '#f5c542'; g.fillRect(x - 3, y - 8, 6, 8);
        api.drawPixels(g, ['.YY....YY.', 'YyYY..YYyY', 'YYYYYYYYYY', '.YYY..YYY.', '..Y....Y..'], { Y: '#f5c542', y: '#fff2a0' }, x - 10, y - 13, 2);
      }
      function drawMotor(t) {
        g.fillStyle = '#3a3346'; g.fillRect(BX - 11, 22, 22, 3);
        g.fillStyle = '#5a5568'; g.fillRect(BX - 9, 25, 18, 11);
        g.fillStyle = '#7a7590'; g.fillRect(BX - 9, 25, 18, 2);
        g.fillStyle = '#2a2636'; g.fillRect(BX - 7, 29, 14, 5);
        const ph = Math.floor(motorA) % 4;
        g.fillStyle = '#9a96b0'; for (let k = 0; k < 3; k++) g.fillRect(BX - 7 + ((k * 5 + ph) % 14), 29, 2, 5);
        g.fillStyle = (Math.floor(t * 4) % 2) ? '#5cff6a' : '#1d6a24'; g.fillRect(BX + 6, 26, 2, 2);
        if (Math.abs(spin) > 0.3) {
          g.fillStyle = 'rgba(220,220,255,0.6)';
          if (ph % 2) { g.fillRect(BX - 13, 28, 2, 1); g.fillRect(BX + 11, 32, 2, 1); } else { g.fillRect(BX - 14, 32, 2, 1); g.fillRect(BX + 12, 28, 2, 1); }
        }
        for (let y = 36; y < chainEnd; y += 3) {
          const alt = ((y / 3 | 0) + Math.floor(rot * 6)) % 2;
          g.fillStyle = alt ? '#c8c8d4' : '#7a7a88';
          g.fillRect(BX - (alt ? 1 : 0), y, alt ? 3 : 1, 2);
        }
        if (phase === 'reveal' && chainEnd > 40) { g.fillStyle = '#d8d8e4'; g.fillRect(BX - 2, chainEnd, 5, 2); g.fillRect(BX - 2, chainEnd, 1, 4); g.fillRect(BX + 2, chainEnd, 1, 4); }
      }

      /* ---------- main loop ---------- */
      const stop = api.loop((dt, t) => {
        updBeat(dt);
        const bi = Math.floor(beat), bf = beat - bi, bar = Math.floor(bi / 4);
        const pulse = (1 - bf) * (1 - bf);
        const pw = power(), glow = glowLvl();

        /* --- phase logic --- */
        if (phase === 'reveal') {
          rt += dt;
          if (rt > 1.0 && !box.landed) {
            box.vy += 620 * dt; box.y += box.vy * dt;
            if (box.y >= 240) {
              box.y = 240;
              if (box.vy > 80 && box.bounced < 2) { if (!box.bounced) { api.sfx('boom'); shake = 1; } else api.sfx('hit'); box.vy = -box.vy * 0.3; box.bounced++; }
              else { box.vy = 0; box.landed = true; }
            }
          }
          if (rt > 3.4 && !box.lid) { box.lid = 1; api.sfx('launch'); confetti(90, 205, 60, 90); flash = 0.5; }
          if (box.lid) { box.lidX -= 50 * dt; box.lid += dt; }
          if (rt > 3.4) {
            ballPos.vis = true;
            if (rt < 5.0) { ballPos.y = 236 - easeOut((rt - 3.4) / 1.6) * 64; ballPos.s = 0.5; }
            if (Math.random() < dt * 20) sparkle(ballPos.x, ballPos.y, 1);
          }
          if (rt > 3.6 && rt < 3.7 && !box.dinged) { box.dinged = true; api.sfx('ding'); }
          if (rt > 5.0 && rt < 6.2) { const tgt = ballPos.y - BR * ballPos.s - 1; chainEnd = 36 + ease((rt - 5.0) / 1.0) * (tgt - 36); if (rt > 6.0 && !box.click) { box.click = true; api.sfx('click'); } }
          if (rt >= 6.2) {
            const k = ease((rt - 6.2) / 1.8);
            ballPos.y = 172 + (BY - 172) * k; ballPos.s = 0.5 + 0.5 * k;
            chainEnd = ballPos.y - BR * ballPos.s;
            spin = 0.5 + k * 1.5;
          }
          if (rt >= 8.0) {
            phase = 'intro'; ballPos.y = BY; ballPos.s = 1; chainEnd = BY - BR;
            flash = 1; api.sfx('win'); box.gone = 1; confetti(90, 220, 50, 70);
            song0 = Math.ceil(beat) + 4; eva.tx = 90; hintT = 6;
          }
        } else {
          lightsOn = Math.min(1, lightsOn + dt * 3);
          if (box.gone > 0) box.gone = Math.max(0, box.gone - dt * 3);
        }
        const s = beat - song0;
        if (phase === 'intro' && s >= 0) phase = 'dance';
        if (phase === 'dance') {
          for (const n of NOTES) if (!n.done && s - n.b > 0.44) { n.done = true; miss(); }
          spark += (0.35 - spark) * dt * 0.15;
          if (s >= END_S) {
            phase = 'climax'; ct = 0; flash = 1; shake = 0.6; spin += 10; eva.tx = 76;
            while (joined < FRIENDS.length) joinNext();
            banner = null;
            if (!won) { won = true; api.win(); }
            for (let i = 0; i < 4; i++) rocket(30 + i * 40, 40 + Math.random() * 60);
            confetti(90, 120, 120, 80);
          }
        }
        if (phase === 'climax') {
          ct += dt;
          if (ct > nextFw) { rocket(20 + Math.random() * 140, 34 + Math.random() * 90); nextFw = ct + (ct < 8 ? 0.45 + Math.random() * 0.5 : 1.2 + Math.random() * 1.4); }
          if (Math.random() < dt * 6) P.push({ x: Math.random() * W, y: -4, vx: (Math.random() - 0.5) * 20, vy: 20, c: CONF[Math.random() * CONF.length | 0], life: 4, ph: Math.random() * 6 });
        }

        // ball momentum: decays back toward the motor speed, which rises with the party level
        const motor = phase === 'reveal' ? spin : 0.9 + pw * 0.45;
        if (!drag && phase !== 'reveal') spin += (motor - spin) * Math.min(1, dt * 0.6);
        rot += dt * spin; motorA += dt * (22 + Math.abs(spin) * 6);
        eva.x += (eva.tx - eva.x) * Math.min(1, dt * 3);

        /* --- render --- */
        g.save();
        if (shake > 0) { g.translate(Math.round((Math.random() - 0.5) * 6 * shake), Math.round((Math.random() - 0.5) * 6 * shake)); shake = Math.max(0, shake - dt * 2.5); }
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        g.drawImage(bg, 0, 0);

        // floor tiles
        const mode = ((bar % 4) + 4) % 4;
        const tileK = lightsOn * (0.35 + 0.65 * glow);
        for (let i = 0; i < tiles.length; i++) {
          const tl = tiles[i];
          let on, ci;
          if (mode === 0) { on = (tl.r + tl.c + bi) % 2 === 0; ci = bi + tl.r; }
          else if (mode === 1) { on = ((tl.c - bi % 7 + 7) % 7) < 2 || ((tl.r + bi) % 6) === 0; ci = tl.c + bi; }
          else if (mode === 2) { const dist = Math.abs(tl.c - 3) + Math.abs(tl.r - 4); on = dist % 3 === bi % 3; ci = dist + bi; }
          else { on = hash(tl.r * 7 + tl.c, bi) > 0.45; ci = Math.floor(hash(tl.c, tl.r + bi) * 6); }
          ci = ((ci % 6) + 6) % 6;
          g.fillStyle = '#0c0814'; g.fillRect(tl.x, tl.y, tl.w, tl.h);
          g.globalAlpha = (on ? 0.5 + 0.5 * pulse : 0.1) * tileK + 0.04;
          g.fillStyle = LIGHTS[ci]; g.fillRect(tl.x + 1, tl.y + 1, tl.w - 2, tl.h - 2);
          if (on && tileK > 0.3) { g.globalAlpha = (0.35 * pulse + 0.15) * tileK; g.fillStyle = '#fff'; g.fillRect(tl.x + 2, tl.y + 2, tl.w - 4, 1); }
          g.globalAlpha = 1;
        }

        // ceiling string lights
        for (let x = 8, k = 0; x < W; x += 12, k++) {
          const onL = lightsOn > 0 && (pw >= 2 ? (k + bi) % 3 !== 0 : k % 2 === 0);
          g.fillStyle = onL ? LIGHTS[(k + (pw >= 2 ? bi : 0)) % 6] : '#2a2236';
          g.globalAlpha = onL ? 0.6 + 0.4 * glow : 1;
          g.fillRect(x, 24 + (k % 2), 2, 2);
        }
        g.globalAlpha = 1;

        // additive light show
        g.globalCompositeOperation = 'lighter';
        if (lightsOn > 0) {
          const L = lightsOn;
          if (pw >= 1) {
            beam(4, 24, Math.PI * 0.32 + Math.sin(t * 0.9) * 0.45, 320, 0.07, LIGHTS[bi % 6], (0.1 + 0.08 * pulse) * L);
            beam(W - 4, 24, Math.PI * 0.68 + Math.sin(t * 1.1 + 1) * 0.45, 320, 0.07, LIGHTS[(bi + 3) % 6], (0.1 + 0.08 * pulse) * L);
          }
          if (pw >= 3) {
            beam(24, 24, Math.PI * 0.4 + Math.sin(t * 1.7 + 2) * 0.6, 320, 0.05, LIGHTS[(bi + 1) % 6], 0.09 * L);
            beam(W - 24, 24, Math.PI * 0.6 + Math.sin(t * 1.5 + 4) * 0.6, 320, 0.05, LIGHTS[(bi + 4) % 6], 0.09 * L);
          }
          const nRays = 3 + pw * 2 + (phase === 'climax' ? 4 : 0);
          for (let k = 0; k < nRays; k++) {
            const a = Math.PI / 2 + Math.sin(rot * 0.7 + k * 2.39996) * 1.7;
            beam(BX, BY, a, 300, 0.022 + 0.01 * glow, LIGHTS[(k + bi) % 6], (0.06 + 0.07 * glow) * L);
          }
          // reflection dots (move with the ball's rotation)
          const nDots = Math.min(DOTS.length, 14 + pw * 12 + (phase === 'climax' ? 10 : 0));
          for (let i = 0; i < nDots; i++) {
            const d = DOTS[i];
            const xx = ((((d.a + rot * 0.06 * d.sp) % 1) + 1) % 1) * (W + 20) - 10;
            g.globalAlpha = (0.45 + 0.4 * Math.sin(t * 6 + i)) * L * (0.5 + 0.5 * glow);
            g.fillStyle = d.c < 0 || pw < 2 ? '#ffffff' : LIGHTS[d.c];
            const fl = d.y > FLOOR_Y;
            g.fillRect(xx | 0, d.y | 0, d.s + (fl ? 2 : 1), d.s);
          }
          g.globalAlpha = 1;
        }
        g.globalCompositeOperation = 'source-over';

        // lights-off overlay + spotlight
        if (lightsOn < 1) { g.globalAlpha = (1 - lightsOn) * 0.82; g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
        {
          const spotA = phase === 'reveal' ? clamp(rt / 0.8, 0, 1) * 0.22 : 0.1 + 0.05 * pulse;
          const sx = phase === 'reveal' ? 78 : eva.x + (joined >= 5 ? 14 : 0);
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = spotA; g.fillStyle = '#fff6c8';
          g.beginPath(); g.moveTo(sx - 4, 0); g.lineTo(sx + 4, 0); g.lineTo(sx + 44, 242); g.lineTo(sx - 44, 242); g.closePath(); g.fill();
          g.globalAlpha = spotA * 1.6;
          g.beginPath(); g.ellipse(sx, 240, 44, 8, 0, 0, Math.PI * 2); g.fill();
          g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        }

        // motor, chain, ball
        drawMotor(t);
        if (ballPos.vis) {
          if (phase === 'reveal' && rt < 8) { // glow aura while it emerges
            g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.18 + 0.08 * Math.sin(t * 8); g.fillStyle = '#bfe8ff';
            g.beginPath(); g.arc(ballPos.x, ballPos.y, BR * ballPos.s + 8, 0, 7); g.fill();
            g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
          }
          renderBall(rot, phase === 'reveal' ? 0.4 : glow, phase === 'reveal' ? 0.15 : clamp(0.12 + pw * 0.06, 0, 0.5));
          const sz = BD * ballPos.s;
          g.imageSmoothingEnabled = false;
          g.drawImage(ballC, Math.round(ballPos.x - sz / 2), Math.round(ballPos.y - sz / 2), Math.round(sz), Math.round(sz));
          // main star glint + twinkles
          const gx = Math.round(ballPos.x - 13 * ballPos.s), gy = Math.round(ballPos.y - 15 * ballPos.s);
          const gs = Math.round((2 + 3 * pulse * (lightsOn ? 1 : 0.3)) * ballPos.s) + 1;
          g.fillStyle = '#fff'; g.fillRect(gx - gs, gy, gs * 2 + 1, 1); g.fillRect(gx, gy - gs, 1, gs * 2 + 1); g.fillRect(gx - 1, gy - 1, 3, 3);
          const nTw = 3 + pw;
          for (let k = 0; k < nTw; k++) {
            const sp = (t * 1.7 + k * 0.37) % 1;
            if (sp > 0.35) continue;
            const ssz = sp < 0.17 ? 2 + (sp * 18 | 0) % 3 : 2;
            const ang = k * 2.4 + Math.floor(t * 1.7 + k * 0.37) * 1.3, rr = BR * ballPos.s * (0.3 + (k * 0.17) % 0.6);
            const tx = ballPos.x + Math.cos(ang) * rr | 0, ty = ballPos.y + Math.sin(ang) * rr | 0;
            g.fillStyle = k % 3 === 0 && pw > 2 ? LIGHTS[(k + bi) % 6] : '#fff';
            g.fillRect(tx - ssz, ty, ssz * 2 + 1, 1); g.fillRect(tx, ty - ssz, 1, ssz * 2 + 1);
          }
        }

        // gift box
        if (phase === 'reveal' || box.gone > 0) {
          g.globalAlpha = phase === 'reveal' ? 1 : box.gone;
          let sx = 0;
          if (box.landed && rt > 2.3 && rt < 3.4) sx = Math.round(Math.sin(rt * 50) * (rt - 2.3) * 2);
          drawBox(90 + sx, box.y);
          if (!box.lid) drawLid(90 + sx, box.y - 26);
          else { g.save(); g.globalAlpha *= clamp(1.4 - box.lid, 0, 1); drawLid(90 + box.lidX * 0.6, box.y - 26 - box.lid * 120 + box.lid * box.lid * 30); g.restore(); }
          g.globalAlpha = 1;
        }

        // dancers (sorted by y)
        const list = [];
        const ev = { who: 'eva', x: eva.x, y: eva.y, eva: true };
        list.push(ev);
        FRIENDS.forEach(f => { if (f.joined) list.push(f); });
        list.sort((a, b) => a.y - b.y);
        for (const d of list) {
          let p, x = d.x;
          if (d.eva) {
            if (phase === 'reveal') p = { dx: 0, dy: rt > 3.4 && rt < 4.2 ? -Math.abs(Math.sin((rt - 3.4) * 8)) * 6 : 0, frame: rt > 3.4 && rt < 4.2 ? 'jump' : 'idle', flip: false };
            else if (joined >= 5) p = pose({ style: 'couple', side: 0 }, beat);
            else {
              const bb = beat, bi2 = Math.floor(bb), bounce = Math.sin(Math.PI * (bb - bi2));
              p = { dx: 0, dy: -bounce * 3, frame: bi2 % 2 ? 'run1' : 'run2', flip: ((bi2 >> 2) % 2) === 1 };
              if (Math.abs(eva.x - eva.tx) > 2) { p.frame = Math.floor(t * 8) % 2 ? 'run1' : 'run2'; p.flip = eva.tx < eva.x; }
            }
            if (eva.mv) {
              eva.mv.t += dt;
              const k = 1 - clamp(eva.mv.t / 0.35, 0, 1);
              if (eva.mv.l === 0) { p.dx -= 6 * k; p.flip = true; p.frame = 'run1'; }
              else if (eva.mv.l === 2) { p.dx += 6 * k; p.flip = false; p.frame = 'run1'; }
              else { p.dy -= 10 * Math.sin(Math.PI * (1 - k)); p.frame = 'jump'; }
              if (k <= 0) eva.mv = null;
            }
          } else {
            d.jt += dt;
            const k = clamp(d.jt / 1.1, 0, 1);
            if (k < 1) { x = d.from + (d.x - d.from) * easeOut(k); p = { dx: 0, dy: -Math.abs(Math.sin(d.jt * 12)) * 2, frame: Math.floor(d.jt * 10) % 2 ? 'run1' : 'run2', flip: d.from > d.x }; }
            else p = pose(d, beat);
            if (d.who === 'niklas') x = eva.x + 30 + (x - d.x);
          }
          g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(x - 10 + p.dx | 0, d.y - 2, 20, 3);
          api.drawChar(g, d.who, p.frame, Math.round(x - 12 + p.dx), Math.round(d.y - 32 + p.dy), 2, p.flip);
        }

        // hearts for Eva & Niklas
        if (joined >= 5 && bi !== lastHeartBeat) { lastHeartBeat = bi; HEARTS.push({ x: eva.x + 15 + (Math.random() - 0.5) * 10, y: eva.y - 36, t: 0, c: Math.random() < 0.5 ? '#ff3f7a' : '#ff8fb8' }); }
        for (let i = HEARTS.length - 1; i >= 0; i--) {
          const h = HEARTS[i]; h.t += dt; h.y -= 18 * dt; h.x += Math.sin(h.t * 4) * 0.3;
          if (h.t > 2.2) { HEARTS.splice(i, 1); continue; }
          g.globalAlpha = Math.min(1, (2.2 - h.t) * 1.5);
          api.drawPixels(g, HEART, { X: h.c }, h.x - 3 | 0, h.y | 0, 1);
          g.globalAlpha = 1;
        }

        // lanes, notes, pads
        if (phase === 'intro' || phase === 'dance') {
          for (let l = 0; l < 3; l++) {
            g.globalAlpha = 0.12; g.fillStyle = LANE_COL[l]; g.fillRect(LANE_X[l] - 1, FLOOR_Y + 4, 2, PAD_Y - FLOOR_Y - 14);
            g.globalAlpha = 1;
            padLit[l] = Math.max(0, padLit[l] - dt * 6);
            const beatPop = phase === 'dance' ? pulse * 0.25 : 0;
            g.drawImage(padLit[l] > 0.3 ? ARW[l].lit : ARW[l].pad, LANE_X[l] - 13, PAD_Y - 13, 26, 26);
            if (beatPop > 0.15) { g.globalAlpha = beatPop; g.strokeStyle = LANE_COL[l]; g.strokeRect(LANE_X[l] - 15.5, PAD_Y - 15.5, 31, 31); g.globalAlpha = 1; }
          }
          for (const n of NOTES) {
            const db = n.b - s;
            if (n.hit) { // explode ring
              n.ht += dt; if (n.ht > 0.3) continue;
              g.globalAlpha = 1 - n.ht / 0.3; g.strokeStyle = LANE_COL[n.l];
              const r = 10 + n.ht * 50; g.strokeRect(LANE_X[n.l] - r + 0.5, PAD_Y - r + 0.5, r * 2, r * 2); g.globalAlpha = 1;
              continue;
            }
            if (n.done || db > LEAD || db < -0.6) continue;
            const y = PAD_Y - db * SPEED;
            g.globalAlpha = clamp((LEAD - db) / 0.4, 0, 1);
            g.drawImage(ARW[n.l].note, LANE_X[n.l] - 13, Math.round(y - 13), 26, 26);
            g.globalAlpha = 1;
          }
          // progress HUD
          const nextT = THRESH[Math.min(joined, 4)], prevT = joined ? THRESH[joined - 1] : 0;
          const k = joined >= 5 ? 1 : clamp((groove - prevT) / (nextT - prevT), 0, 1);
          g.fillStyle = '#000'; g.fillRect(8, 306, 104, 8);
          g.fillStyle = '#2a1c3c'; g.fillRect(9, 307, 102, 6);
          g.fillStyle = LIGHTS[(joined + 1) % 6]; g.fillRect(9, 307, Math.round(102 * k), 6);
          g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(9, 307, Math.round(102 * k), 1);
          api.text(g, joined + '/5', 118, 306, 8, '#fff');
          const doneN = NOTES.filter(n => n.done).length;
          g.fillStyle = '#ffffff'; g.globalAlpha = 0.4; g.fillRect(8, 316, Math.round(164 * doneN / TOTAL), 1); g.globalAlpha = 1;
          if (combo >= 4) api.text(g, combo + 'x', 172, 306, 8, LIGHTS[bi % 6], 'right');
        }

        // fireworks
        g.globalCompositeOperation = 'lighter';
        for (let i = ROCK.length - 1; i >= 0; i--) {
          const r = ROCK[i];
          r.x += (r.tx - r.x) * Math.min(1, dt * 3); r.y -= 210 * dt;
          r.tr.push([r.x, r.y]); if (r.tr.length > 6) r.tr.shift();
          r.tr.forEach((q, j) => { g.globalAlpha = j / 6; g.fillStyle = '#ffd28a'; g.fillRect(q[0] | 0, q[1] | 0, 1, 2); });
          g.globalAlpha = 1; g.fillStyle = '#fff'; g.fillRect(r.x | 0, r.y | 0, 2, 2);
          if (r.y <= r.ty) { ROCK.splice(i, 1); explode(r.x, r.y, r.c); }
        }
        for (let i = FW.length - 1; i >= 0; i--) {
          const p = FW[i];
          p.vy += 40 * dt; p.vx *= 0.97; p.vy *= 0.97; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
          if (p.life <= 0) { FW.splice(i, 1); continue; }
          g.globalAlpha = Math.min(1, p.life * 1.5) * (p.life < 0.4 && Math.random() < 0.5 ? 0.3 : 1);
          g.fillStyle = p.c; g.fillRect(p.x | 0, p.y | 0, p.life > 0.9 ? 2 : 1, p.life > 0.9 ? 2 : 1);
        }
        for (let i = SPARK.length - 1; i >= 0; i--) {
          const sp = SPARK[i]; sp.t += dt;
          if (sp.t > 0.5) { SPARK.splice(i, 1); continue; }
          const ss = Math.round(3 * Math.sin(Math.PI * sp.t / 0.5));
          g.globalAlpha = 1; g.fillStyle = '#fff';
          g.fillRect(sp.x - ss | 0, sp.y | 0, ss * 2 + 1, 1); g.fillRect(sp.x | 0, sp.y - ss | 0, 1, ss * 2 + 1);
        }
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';

        // confetti
        for (let i = P.length - 1; i >= 0; i--) {
          const p = P[i];
          p.vy += 120 * dt; if (p.vy > 60) p.vy = 60 + (p.vy - 60) * 0.9; p.vx *= 0.985; p.x += p.vx * dt + Math.sin(p.ph) * 0.2; p.y += p.vy * dt; p.life -= dt; p.ph += dt * 10;
          if (p.life <= 0 || p.y > H + 4) { P.splice(i, 1); continue; }
          g.fillStyle = p.c; g.fillRect(p.x | 0, p.y | 0, Math.sin(p.ph) > 0 ? 2 : 1, 2);
        }

        /* --- texts --- */
        if (phase === 'reveal') {
          const blink = Math.floor(t * 2) % 2;
          if (rt < 1.6) { g.globalAlpha = clamp(rt * 2, 0, 1); outlined('LICHT AUS...', W / 2, 120, 8, '#fff6c8'); g.globalAlpha = 1; }
          else if (rt < 3.4) { outlined('EIN GESCHENK!', W / 2, 112, 8, '#f5c542'); if (box.landed) outlined('VON DEINEN FREUNDEN', W / 2, 124, 8, '#ffffff'); }
          else if (rt < 6.2) { outlined('EINE ECHTE', W / 2, 128, 8, '#fff'); outlined('DISCO-KUGEL!', W / 2, 140, 8, LIGHTS[Math.floor(t * 6) % 6]); }
          else { outlined('MIT MOTOR!', W / 2, 140, 8, blink ? '#7cff4f' : '#fff'); }
        }
        if (phase === 'intro') {
          const k = clamp((s + 4) / 0.5, 0, 1);
          outlined('DANCE-OFF!', W / 2, 128 - (1 - easeOut(k)) * 30, 16, LIGHTS[bi % 6]);
          outlined('TIPPE IM TAKT!', W / 2, 250, 8, '#ffffff');
        }
        if (phase === 'dance') {
          if (s < 4) { const cnt = ['3', '2', '1', 'LOS!'][Math.max(0, Math.floor(s))]; const ks = s - Math.floor(s); outlined(cnt, W / 2, 124 - (1 - ks) * 4, 16, Math.floor(s) === 3 ? '#7cff4f' : '#fff'); }
          if (banner) {
            banner.t += dt;
            if (banner.t > 1.8) banner = null;
            else { const k = easeOut(banner.t / 0.25); outlined(banner.s1, W / 2 + (1 - k) * 120, 124, 8, banner.c); outlined(banner.s2, W / 2 - (1 - k) * 120, 136, 8, '#ffffff'); }
          } else if (judge && s >= 4) {
            judge.t += dt;
            if (judge.t > 0.6) judge = null;
            else outlined(judge.txt, W / 2, 130 - Math.min(4, judge.t * 20), 8, judge.c);
          }
          if (hintT > 0 && s > 6 && s < 22 && joined === 0) { hintT -= dt; if (Math.floor(t * 2) % 2) outlined('KUGEL WISCHEN = DREHEN', W / 2, 142, 8, '#fff'); }
        }
        if (phase === 'climax') {
          bigLine('ALLES GUTE', 124, 16, 0.3);
          bigLine('ZUM', 142, 16, 0.9);
          bigLine('GEBURTSTAG,', 160, 16, 1.2);
          bigLine('EVA!', 179, 24, 2.0);
          if (ct > 3) {
            g.globalAlpha = clamp((ct - 3) / 0.6, 0, 1);
            outlined('von Laurenz, Enrico,', W / 2, 274, 8, '#f6e7c8');
            outlined('Hannah & Magnus', W / 2, 286, 8, '#f6e7c8');
            g.globalAlpha = 1;
            if (ct > 5) {
              const hint = Math.floor(ct / 2.5) % 2 ? 'TIPPEN = KONFETTI' : 'WISCHEN = DREHEN';
              outlined(hint, W / 2, 304, 8, LIGHTS[Math.floor(ct / 2.5) % 6]);
            }
          }
        }

        if (flash > 0) { g.globalAlpha = flash * 0.6; g.fillStyle = '#fff'; g.fillRect(-4, -4, W + 8, H + 8); g.globalAlpha = 1; flash = Math.max(0, flash - dt * 3); }
        g.restore();
      });

      // debug/test hook (harmless): window.__finaleDance
      window.__finaleDance = { get phase() { return phase; }, get joined() { return joined; }, get hits() { return hits; }, get spin() { return spin; }, notes: NOTES, skip() { rt = 7.99; }, end() { song0 = beat - END_S; NOTES.forEach(n => n.done = true); } };

      return function cleanup() {
        stop();
        cv.canvas.removeEventListener('pointerdown', onDown);
        cv.canvas.removeEventListener('pointermove', onMove);
        cv.canvas.removeEventListener('pointerup', onUp);
        cv.canvas.removeEventListener('pointercancel', onUp);
        window.removeEventListener('keydown', onKey);
        if (window.__finaleDance) delete window.__finaleDance;
        cv.destroy();
      };
    }
  };
})();

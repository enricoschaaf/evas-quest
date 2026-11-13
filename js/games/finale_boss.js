/* Finale-Variante „Geschenk-Boss“: Eva erreicht den Gipfel, das riesige Geschenk erwacht und will nicht ausgepackt werden.
   3 Phasen (hüpfen → Minions spucken → drehen + Schleifen lösen). Danach platzt es auf: die motorisierte Disco-Kugel
   steigt heraus und alles wird zur Disko. Kugel: wischen = drehen (mit Schwung), tippen = Konfetti. */
(function () {
  'use strict';

  GAMES['finale_boss'] = {
    title: 'Geschenk-Boss',
    intro: 'Das Geschenk ist erwacht und will nicht ausgepackt werden! Tippe, um Konfetti-Kracher und Zapfen zu werfen – leuchtende Schleifen tun extra weh. Unten tippen = laufen.',
    start(root, api) {
      const E = window.Engine;
      const W = 180, H = 320;
      const cv = api.makeCanvas(root, W, H);
      const g = cv.ctx;
      api.music('tense');
      const isDev = /dev\.html$/.test(location.pathname);

      /* ================= helpers ================= */
      const R = (c, x, y, w, h) => { c.fillRect(x | 0, y | 0, w | 0, h | 0); };
      const rnd = (a, b) => a + Math.random() * (b - a);
      const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
      const lerp = (a, b, k) => a + (b - a) * k;
      const ease = k => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
      const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
      const LIGHTS = ['#ff3fa4', '#3fe0ff', '#ffe23f', '#7cff4f', '#b45cff', '#ff8a2a'];
      const LRGB = LIGHTS.map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
      const CONF = ['#f5c542', '#d94c3d', '#6fae4f', '#4a7fd9', '#f2a7b8', '#8a5bd9', '#fff', '#3fe0ff'];

      function txt(str, x, y, color, align, shadow) { api.text(g, str, x, y, 8, color, align || 'center', shadow); }

      /* speech bubble pointing at (x, y) from above */
      function wrap(str, max) {
        const words = str.split(' '), lines = []; let cur = '';
        for (const w of words) { if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
        if (cur) lines.push(cur);
        return lines;
      }
      function bubble(str, x, y, alpha) {
        const lines = wrap(str, 13);
        const bw = Math.max(...lines.map(l => l.length)) * 8 + 8, bh = lines.length * 10 + 6;
        const bx = clamp(Math.round(x - bw / 2), 2, W - bw - 2), by = Math.max(24, Math.round(y - bh - 6));
        g.globalAlpha = alpha == null ? 1 : alpha;
        g.fillStyle = '#1b1420'; R(g, bx - 1, by - 1, bw + 2, bh + 2);
        g.fillStyle = '#fffaf0'; R(g, bx, by, bw, bh);
        const tx = clamp(x, bx + 4, bx + bw - 6);
        g.fillStyle = '#1b1420'; R(g, tx - 1, by + bh, 6, 2); R(g, tx, by + bh + 2, 4, 2); R(g, tx + 1, by + bh + 4, 2, 2);
        g.fillStyle = '#fffaf0'; R(g, tx, by + bh, 4, 1); R(g, tx + 1, by + bh + 2, 2, 1);
        lines.forEach((l, i) => api.text(g, l, bx + bw / 2, by + 4 + i * 10, 8, '#1b1420', 'center', false));
        g.globalAlpha = 1;
      }

      /* ================= day background (summit) ================= */
      const GROUND = 206, EVA_Y = 302;
      const day = document.createElement('canvas'); day.width = W; day.height = H;
      (function paintDay() {
        const c = day.getContext('2d');
        const sky = [[0, [52, 46, 110]], [0.45, [196, 96, 120]], [0.75, [240, 150, 90]], [1, [250, 205, 120]]];
        for (let y = 0; y < GROUND; y++) {
          const k = y / GROUND; let i = 0; while (i < sky.length - 2 && k > sky[i + 1][0]) i++;
          const a = sky[i], b = sky[i + 1], f = (k - a[0]) / (b[0] - a[0]);
          c.fillStyle = `rgb(${lerp(a[1][0], b[1][0], f) | 0},${lerp(a[1][1], b[1][1], f) | 0},${lerp(a[1][2], b[1][2], f) | 0})`;
          c.fillRect(0, Math.floor(y / 3) * 3, W, 3);
        }
        c.fillStyle = '#fff3c4'; for (let y = -12; y <= 12; y++) { const w = Math.sqrt(144 - y * y) | 0; R(c, 138 - w, 150 + y, w * 2, 1); }
        c.fillStyle = '#ffe9a8'; for (let y = -14; y <= 14; y += 4) R(c, 120, 150 + y, 36, 1);
        // clouds
        c.fillStyle = 'rgba(255,230,220,0.55)';
        [[20, 60, 30], [110, 44, 40], [60, 100, 26]].forEach(([x, y, w]) => { R(c, x, y, w, 4); R(c, x + 6, y - 3, w - 14, 3); });
        // mountains
        function ridge(col, base, amp, seed) {
          c.fillStyle = col;
          for (let x = 0; x < W; x++) {
            const h = amp * (0.5 + 0.5 * Math.sin(x * 0.045 + seed)) + amp * 0.5 * Math.abs(Math.sin(x * 0.11 + seed * 2));
            R(c, x, base - h, 1, GROUND - base + h);
          }
        }
        ridge('#8a5c88', 168, 28, 1); ridge('#5e3f6a', 186, 22, 4); ridge('#3d2c4a', 200, 12, 7);
        // trees on the far slopes
        for (let i = 0; i < 18; i++) { const x = hash(i, 3) * W | 0, y = 186 + hash(i, 5) * 14 | 0; c.fillStyle = ['#d9822b', '#b4452c', '#f2b33d'][i % 3]; R(c, x, y - 6, 3, 6); R(c, x - 1, y - 4, 5, 3); }
        // plateau
        for (let y = GROUND; y < H; y++) {
          const k = (y - GROUND) / (H - GROUND);
          c.fillStyle = `rgb(${lerp(126, 70, k) | 0},${lerp(104, 58, k) | 0},${lerp(84, 50, k) | 0})`;
          R(c, 0, y, W, 1);
        }
        c.fillStyle = '#6fae4f'; R(c, 0, GROUND - 2, W, 4);
        c.fillStyle = '#3e7a3a'; for (let x = 0; x < W; x += 3) R(c, x, GROUND + 2, 2, 1 + hash(x, 1) * 3);
        for (let i = 0; i < 40; i++) { c.fillStyle = hash(i, 9) > 0.5 ? '#5e4c3e' : '#9a8670'; R(c, hash(i, 7) * W, GROUND + 8 + hash(i, 8) * 100, 3 + hash(i, 6) * 4, 2); }
        for (let i = 0; i < 22; i++) { c.fillStyle = ['#d9822b', '#f2b33d', '#d94c3d'][i % 3]; R(c, hash(i, 11) * W, GROUND + 6 + hash(i, 12) * 108, 2, 1); }
        // summit cross
        c.fillStyle = '#3b2416'; R(c, 160, 160, 3, 46); R(c, 153, 170, 17, 3);
        c.fillStyle = '#f5c542'; R(c, 160, 168, 3, 1);
        // rocks for the friends
        function rock(x, y, w) { c.fillStyle = '#5a4c44'; R(c, x, y, w, 12); R(c, x + 3, y - 3, w - 6, 3); c.fillStyle = '#7a6a5c'; R(c, x + 3, y - 3, w - 10, 2); R(c, x + 1, y, w - 8, 2); }
        rock(-4, 262, 52); rock(132, 262, 54);
      })();

      /* ================= disco background ================= */
      const FLOOR_Y = 196;
      const disco = document.createElement('canvas'); disco.width = W; disco.height = H;
      (function paintDisco() {
        const c = disco.getContext('2d');
        for (let y = 0; y < FLOOR_Y; y++) { const k = y / FLOOR_Y; c.fillStyle = `rgb(${18 + k * 14 | 0},${8 + k * 6 | 0},${34 + k * 18 | 0})`; R(c, 0, y, W, 1); }
        c.fillStyle = '#07040c'; R(c, 0, FLOOR_Y, W, H - FLOOR_Y);
        c.fillStyle = 'rgba(255,255,255,0.035)'; for (let x = 6; x < W; x += 28) R(c, x, 32, 1, FLOOR_Y - 36);
        c.fillStyle = '#0a0612'; R(c, 0, 0, W, 28);
        c.fillStyle = '#1c1428'; R(c, 0, 26, W, 2);
        c.fillStyle = '#05030a'; R(c, 0, FLOOR_Y - 4, W, 4);
      })();
      const ROWS = [14, 17, 20, 23, 27, 23];
      const tiles = [];
      { let yy = FLOOR_Y; ROWS.forEach((rh, r) => { const cols = 7, rowW = 150 + r * 14 + (r === ROWS.length - 1 ? 30 : 0), tw = rowW / cols, x0 = (W - rowW) / 2;
        for (let c = 0; c < cols; c++) tiles.push({ r, c, x: Math.round(x0 + c * tw), y: yy, w: Math.round(x0 + (c + 1) * tw) - Math.round(x0 + c * tw), h: rh }); yy += rh; }); }

      /* ================= disco ball (big, faceted, specular) ================= */
      const BR = 36, BD = BR * 2 + 1;
      const ballC = document.createElement('canvas'); ballC.width = BD; ballC.height = BD;
      const ballG = ballC.getContext('2d');
      const bimg = ballG.createImageData(BD, BD);
      const LATN = 14, LONN = 28;
      const BPX = [];
      for (let y = 0; y < BD; y++) for (let x = 0; x < BD; x++) {
        const nx = (x - BR) / BR, ny = (y - BR) / BR, d = nx * nx + ny * ny;
        if (d > 1) continue;
        const nz = Math.sqrt(1 - d), lat = Math.asin(ny), lon = Math.atan2(nx, nz);
        const latf = (lat / Math.PI + 0.5) * LATN, fi = Math.min(LATN - 1, Math.floor(latf));
        const latc = ((fi + 0.5) / LATN - 0.5) * Math.PI;
        BPX.push({ i: (y * BD + x) * 4, x, y, fi, fr: latf - fi, lon, cosl: Math.cos(lat), clc: Math.cos(latc), slc: Math.sin(latc), nz });
      }
      const nrm = v => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
      const L1 = nrm([-0.5, -0.6, 0.62]), H1 = nrm([L1[0], L1[1], L1[2] + 1]);
      const H2 = nrm([0.55, 0.45, 1.6]);
      let glints = [];
      function renderBall(rot, beat, warm) {
        const d = bimg.data, bi = Math.floor(beat), tint = LRGB[((bi % 6) + 6) % 6];
        const best = new Map();
        for (let k = 0; k < BPX.length; k++) {
          const p = BPX[k];
          const ncols = Math.max(4, Math.round(LONN * p.clc * 0.5) * 2);
          const lf = ((p.lon + rot) / (Math.PI * 2)) * ncols;
          const fj = Math.floor(lf), fc = lf - fj, jj = ((fj % ncols) + ncols) % ncols;
          const lonc = (fj + 0.5) / ncols * Math.PI * 2 - rot;              // facet centre in view space
          const nx = p.clc * Math.sin(lonc), ny = p.slc, nz = p.clc * Math.cos(lonc);
          const dif = Math.max(0, nx * L1[0] + ny * L1[1] + nz * L1[2]);
          const s1 = Math.pow(Math.max(0, nx * H1[0] + ny * H1[1] + nz * H1[2]), 70);
          const s2 = Math.pow(Math.max(0, nx * H2[0] + ny * H2[1] + nz * H2[2]), 40);
          const h = hash(p.fi, jj);
          let v = 58 + 175 * (0.35 + 0.65 * dif) * (0.6 + 0.4 * h);
          let r = v * (warm ? 1.05 : 0.92), gg = v * (warm ? 0.95 : 0.92), b = v * (warm ? 0.85 : 1.12);
          if (h > 0.74) { r = r * 0.45 + tint[0] * 0.55 * (0.4 + dif); gg = gg * 0.45 + tint[1] * 0.55 * (0.4 + dif); b = b * 0.45 + tint[2] * 0.55 * (0.4 + dif); }
          r += s1 * 320 + s2 * tint[0] * 1.2; gg += s1 * 320 + s2 * tint[1] * 1.2; b += s1 * 330 + s2 * tint[2] * 1.2;
          const key = p.fi * 64 + jj, sp = Math.max(s1, s2 * 0.8);
          if (sp > 0.55 && (!best.has(key) || best.get(key).s < sp)) best.set(key, { s: sp, x: p.x, y: p.y, c: s1 >= s2 ? '#ffffff' : LIGHTS[((bi % 6) + 6) % 6] });
          const grout = p.fr < 0.13 || fc < 0.13 / Math.max(0.3, p.clc);
          if (grout) { r *= 0.3; gg *= 0.3; b *= 0.36; }
          const rim = p.nz < 0.3 ? 0.55 + p.nz * 1.5 : 1;
          r *= rim; gg *= rim; b *= rim;
          d[p.i] = r > 255 ? 255 : r; d[p.i + 1] = gg > 255 ? 255 : gg; d[p.i + 2] = b > 255 ? 255 : b; d[p.i + 3] = 255;
        }
        ballG.putImageData(bimg, 0, 0);
        glints = [...best.values()].sort((a, b) => b.s - a.s).slice(0, 4);
      }
      function drawBall(bx, by, t) {
        g.drawImage(ballC, bx - BR | 0, by - BR | 0);
        // glints follow the rotating facets
        for (let k = 0; k < glints.length; k++) {
          const q = glints[k], sz = 1 + Math.round(q.s * 4 * (0.7 + 0.3 * Math.sin(t * 9 + k)));
          const gx = (bx - BR | 0) + q.x, gy = (by - BR | 0) + q.y;
          g.fillStyle = q.c; g.globalAlpha = 0.95;
          R(g, gx - sz, gy, sz * 2 + 1, 1); R(g, gx, gy - sz, 1, sz * 2 + 1);
          if (sz > 3) { g.globalAlpha = 0.6; R(g, gx - 1, gy - 1, 3, 3); }
          g.globalAlpha = 1;
        }
      }

      /* ================= sprites ================= */
      const MINI = {
        gift: { rows: ['..Y.Y...', '...Y....', 'RRRYRRRR', 'RERYRERr', 'YYYYYYYY', 'RRRYRRRr', 'RMMMMMRr', 'RRRYRRRr', '.K....K.'],
                pal: { Y: '#f5c542', R: '#4a7fd9', r: '#2e5aa8', E: '#fff', M: '#1b1420', K: '#1b1420' } },
        sock: { rows: ['.WWWWW..', '.SSSSS..', '.SESES..', '.SSSSS..', '.SRRRS..', '.SSSSSS.', '.SSSSSSS', '.RRSSSSS', '..RRRRR.'],
                pal: { W: '#fff', S: '#8a5bd9', R: '#f2a7b8', E: '#fff' } },
        kerze: { rows: ['...F....', '..FYF...', '...F....', '...K....', '.PPPPP..', '.PEPEP..', '.PPPPP..', '.PWPPP..', '.PPPPP..', '.PPPPP..'],
                 pal: { F: '#ff8a2a', Y: '#fff36a', K: '#1b1420', P: '#f2a7b8', E: '#1b1420', W: '#fff' } }
      };
      const ITEM = {
        zapfen: ['.BB.', 'BbBb', 'bBbB', 'BbBb', '.bB.', '..b.'],
        kaffee: ['.WW.', 'CCCCc', 'CBBCc', 'CBBCc', 'CCCC.', '.CC..'],
        popper: ['.Y.P', 'PYP.', '.PRR', '.RRR', 'RRR.', 'RR..']
      };
      const ITEMPAL = { B: '#8a5a2a', b: '#5b3a24', W: '#ffffff', C: '#f6e7c8', c: '#f6e7c8', Y: '#f5c542', P: '#f2a7b8', R: '#d94c3d' };
      const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];

      /* ================= the gift-box boss (drawn into an offscreen sprite) ================= */
      const boxC = document.createElement('canvas'); boxC.width = 100; boxC.height = 100;
      const bc = boxC.getContext('2d');
      const OX = 50, OY = 96; // sprite origin = base centre
      const boss = { x: 90, z: 0, hp: 100, phase: 0, face: 'sleep', mouth: 0, sq: 0, spin: 0, look: 0, hitF: 0,
        hop: null, wait: 1, spitT: 1.5, sayStr: null, sayT: 0, inv: 0, loose: 0, shakeJ: 0, bow: true, visible: true };
      function say(s, dur) { boss.sayStr = s; boss.sayT = dur || 1.8; }
      function tailPts(side, t) {
        const pts = [], n = Math.round(16 * boss.loose);
        for (let i = 1; i <= n; i++) pts.push([OX + side * (3 + i * 2.6), 36 + i * 1.6 + Math.sin(t * 11 - i * 0.7) * i * 0.35]);
        return pts;
      }
      function weakSpots(t) {
        if (boss.phase === 0 || boss.inv > 0) return [];
        const w = [[OX, 34]];
        if (boss.phase >= 2) w.push([OX, 59]);
        if (boss.phase === 3) for (const s of [-1, 1]) { const p = tailPts(s, t); if (p.length) w.push(p[p.length - 1]); }
        return w;
      }
      function drawBoxSprite(t, front) {
        const c = bc;
        c.clearRect(0, 0, 100, 100);
        const red = boss.hitF > 0 ? '#ffffff' : (front ? '#d94c3d' : '#b23a30');
        const redD = boss.hitF > 0 ? '#ffd0d0' : '#9c2f26', redL = boss.hitF > 0 ? '#fff' : '#ef6f5f';
        // body
        c.fillStyle = red; R(c, 20, 50, 60, 46);
        c.fillStyle = redD; R(c, 72, 50, 8, 46); R(c, 20, 94, 60, 2);
        c.fillStyle = redL; R(c, 20, 50, 3, 44);
        c.fillStyle = '#f6e7c8';
        for (let y = 54; y < 92; y += 8) for (let x = 25 + ((y >> 3) % 2) * 4; x < 74; x += 8) if (x < 44 || x > 56) R(c, x, y, 2, 2);
        // ribbons
        c.fillStyle = '#f5c542'; R(c, 45, 50, 10, 46); R(c, 20, 56, 60, 7);
        c.fillStyle = '#c9962a'; R(c, 53, 50, 2, 46); R(c, 20, 61, 60, 2);
        // lid
        c.fillStyle = red; R(c, 16, 38, 68, 12);
        c.fillStyle = redD; R(c, 16, 48, 68, 2); R(c, 76, 38, 8, 12);
        c.fillStyle = redL; R(c, 16, 38, 68, 2);
        c.fillStyle = '#f5c542'; R(c, 45, 38, 10, 12);
        c.fillStyle = '#c9962a'; R(c, 53, 38, 2, 12);
        // bow
        if (boss.bow) {
          const wob = Math.sin(t * 6) * (boss.phase === 3 ? 2 : 1);
          c.fillStyle = '#f5c542';
          for (const s of [-1, 1]) {
            for (let i = 0; i < 13; i++) { const w = [5, 9, 12, 14, 15, 16, 16, 15, 14, 12, 9, 6, 3][i] + Math.round(wob); R(c, s < 0 ? OX - 3 - w : OX + 3, 22 + i + (i > 10 ? 1 : 0), w, 1); }
          }
          c.fillStyle = '#c9962a'; R(c, OX - 14, 27, 6, 6); R(c, OX + 8, 27, 6, 6); c.fillStyle = '#fff3b0'; R(c, OX - 15, 24, 4, 1); R(c, OX + 11, 24, 4, 1);
          c.fillStyle = '#ffe27a'; R(c, OX - 3, 30, 6, 7);
          c.fillStyle = '#c9962a'; R(c, OX - 3, 36, 6, 1);
          // loose tails
          if (boss.loose > 0) for (const s of [-1, 1]) for (const [x, y] of tailPts(s, t)) { c.fillStyle = '#f5c542'; R(c, x - 1, y - 1, 3, 3); c.fillStyle = '#c9962a'; R(c, x - 1, y + 1, 3, 1); }
        }
        if (!front) return;
        // eyes
        const lk = clamp(boss.look, -2, 2) | 0;
        for (const ex of [30, 60]) {
          if (boss.face === 'sleep') { c.fillStyle = '#1b1420'; R(c, ex, 70, 10, 2); continue; }
          if (boss.face === 'ouch') { c.fillStyle = '#1b1420'; const d = ex < 50 ? 1 : -1; R(c, ex + 2, 67, 6, 2); R(c, ex + 4 + d * 2, 69, 3, 2); R(c, ex + 2, 71, 6, 2); continue; }
          if (boss.face === 'dizzy') { c.fillStyle = '#1b1420'; for (let i = 0; i < 7; i++) { R(c, ex + 1 + i, 66 + i, 2, 1); R(c, ex + 7 - i, 66 + i, 2, 1); } continue; }
          c.fillStyle = '#fff'; R(c, ex + 1, 65, 8, 10); R(c, ex, 66, 10, 8);
          c.fillStyle = '#1b1420'; R(c, ex + 3 + lk, 68 + (boss.face === 'angry' ? 1 : 0), 4, 5);
          c.fillStyle = '#fff'; R(c, ex + 4 + lk, 69, 1, 1);
          if (boss.face === 'angry' || boss.phase >= 2) { c.fillStyle = '#1b1420'; const d = ex < 50 ? 1 : -1; for (let i = 0; i < 10; i++) R(c, ex + i, 63 + (d > 0 ? i : 9 - i) * 0.3, 1, 2); }
        }
        // mouth (toothy grin)
        const m = boss.mouth, mh = 4 + Math.round(m * 9);
        c.fillStyle = '#1b1420'; R(c, 29, 80, 42, mh); R(c, 27, 78, 3, 3); R(c, 70, 78, 3, 3);
        if (m > 0.2) { c.fillStyle = '#e0556a'; R(c, 38, 80 + mh - 4, 24, 3); }
        c.fillStyle = '#fff';
        for (let x = 31; x < 69; x += 5) R(c, x, 80, 3, 2);
        if (m > 0.2) for (let x = 33; x < 67; x += 5) R(c, x, 80 + mh - 2, 3, 2);
      }
      function bossScreen() {
        const spinC = Math.cos(boss.spin);
        let sx = Math.max(0.14, Math.abs(spinC)) * (1 + boss.sq * 0.18), sy = 1 - boss.sq * 0.16;
        if (boss.hop && boss.hop.t < boss.hop.dur) { sy *= 1.06; sx *= 0.96; }
        const jit = boss.shakeJ > 0 ? (Math.random() - 0.5) * 3 : 0;
        return { x: boss.x + jit, y: GROUND - boss.z, sx, sy, front: spinC >= 0, side: Math.sin(boss.spin) };
      }
      const toScreen = (bs, px, py) => [bs.x + (px - OX) * bs.sx, bs.y + (py - OY) * bs.sy];
      function drawBoss(t) {
        const bs = bossScreen();
        drawBoxSprite(t, bs.front);
        // shadow
        g.fillStyle = 'rgba(0,0,0,0.3)'; const sw = 34 - boss.z * 0.2; R(g, boss.x - sw, GROUND - 2, sw * 2, 4);
        // side face while spinning (fake 3D)
        if (boss.phase === 3 && Math.abs(bs.side) > 0.1) {
          const w = 30 * Math.abs(bs.side) * 0.9, dir = bs.side > 0 ? 1 : -1, ex = bs.x + dir * 30 * bs.sx;
          g.fillStyle = '#8a2a22'; R(g, dir > 0 ? ex : ex - w, bs.y - 46 * bs.sy, w, 46 * bs.sy);
          g.fillStyle = '#b8892a'; R(g, dir > 0 ? ex : ex - w, bs.y - 40 * bs.sy, w, 7 * bs.sy);
        }
        g.drawImage(boxC, bs.x - OX * bs.sx, bs.y - OY * bs.sy, 100 * bs.sx, 100 * bs.sy);
        // glowing weak spots
        const ws = weakSpots(t), pl = 0.5 + 0.5 * Math.sin(t * 8);
        g.globalCompositeOperation = 'lighter';
        for (const [px, py] of ws) {
          const [x, y] = toScreen(bs, px, py);
          g.globalAlpha = 0.35 + 0.35 * pl; g.fillStyle = '#fff3a0';
          R(g, x - 5, y - 2, 10, 4); R(g, x - 2, y - 5, 4, 10); R(g, x - 4, y - 4, 8, 8);
          g.globalAlpha = 0.9; g.fillStyle = '#fff'; R(g, x - 1, y - 1, 2, 2);
        }
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        return bs;
      }

      /* ================= state ================= */
      let mode = 'intro', mt = 0;           // mode time
      let fightT = 0, shake = 0, flash = 0, slow = 1;
      const eva = { x: -14, tx: 70, vx: 0, kb: 0, throwF: 0, cd: 0, flip: false, hurt: 0, say: null, sayT: 0 };
      const FRIENDS = [
        { who: 'laurenz', x: 4, y: 266, item: 'zapfen', name: 'Laurenz' },
        { who: 'enrico', x: 24, y: 268, item: 'kaffee', name: 'Enrico' },
        { who: 'hannah', x: 140, y: 268, item: 'popper', name: 'Hannah', flip: true },
        { who: 'magnus', x: 160, y: 266, item: 'zapfen', name: 'Magnus', flip: true }
      ];
      FRIENDS.forEach((f, i) => { f.off = i * 0.37; f.say = null; f.sayT = 0; });
      const CHEERS = ['Los, Eva!', 'Hau rein!', 'Pack es aus!', 'Wuhuu!', 'Du schaffst das!', 'Gib alles!', 'Nicht die Schleife!'];
      const ITEMSAY = { zapfen: 'Riesen-Zapfen! Fang!', kaffee: 'Kaffee-Turbo!', popper: 'Dreifach-Kracher!' };
      const TAUNT_HIT = ['Au!', 'Hey, das Papier!', 'Ich bin doppelt verpackt!', 'Das kitzelt!', 'Nicht knicken!', 'Hihi, daneben... ach nee.'];
      let cheerT = 3, itemT = 7, itemIdx = 0, tauntCd = 0;
      const shots = [], minis = [], items = [], P = [], POPT = [], pieces = [], HEARTS = [];
      const buff = { kind: null, t: 0, n: 0 };
      let bowFly = null, burstDone = false, won = false, winTimer = 0;
      let ballY = 0, ballOn = false, dark = 0, chainK = 0, discoT = 0, hintT = 6;
      let rot = 0, spin = 1.6, motorA = 0, drag = null, lastHeartBeat = -1;

      function confetti(x, y, n, sp) {
        for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = rnd(20, sp || 90); P.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, c: CONF[Math.random() * CONF.length | 0], life: rnd(0.8, 1.8), ph: Math.random() * 6 }); }
        if (P.length > 600) P.splice(0, P.length - 600);
      }
      function popText(s, x, y, c) { POPT.push({ s, x, y, c: c || '#fff', t: 0 }); }

      /* ---------- throwing ---------- */
      function throwAt(x, y, target) {
        if (mode !== 'fight' || eva.kb > 0 || eva.cd > 0) return;
        const turbo = buff.kind === 'kaffee' && buff.t > 0;
        eva.cd = turbo ? 0.11 : 0.3; eva.throwF = 0.15; eva.flip = x < eva.x;
        const hx = eva.x + (eva.flip ? -6 : 6), hy = EVA_Y - 22;
        const mega = buff.kind === 'zapfen' && buff.n > 0;
        const triple = buff.kind === 'popper' && buff.t > 0;
        const offs = triple ? [-12, 0, 12] : [0];
        offs.forEach((o, i) => {
          const tx = x + o, ty = y + Math.abs(o) * 0.3;
          const dur = clamp(Math.hypot(tx - hx, ty - hy) / 260, 0.18, 0.45);
          shots.push({ x0: hx, y0: hy, tx, ty, t: 0, dur, target: i === 1 || !triple ? target : null, kind: mega ? 'mega' : (Math.random() < 0.5 ? 'popper' : 'zapfen'), dmg: mega ? 4 : 1, x: hx, y: hy });
        });
        if (mega) buff.n--;
        api.sfx('flap');
      }
      function damage(n, x, y, weak) {
        if (boss.inv > 0 || mode !== 'fight') { popText('BLOCK', x, y - 6, '#ccc'); return; }
        const mul = 1 + Math.max(0, fightT - 70) / 20;
        boss.hp = Math.max(0, boss.hp - n * mul);
        boss.hitF = 0.08; shake = Math.max(shake, weak ? 2.5 : 1.2);
        if (weak) { popText('KRITISCH!', x, y - 8, '#fff36a'); api.sfx('ding'); confetti(x, y, 26, 110); }
        else { api.sfx('coin'); confetti(x, y, 12, 70); }
        if (tauntCd <= 0 && Math.random() < 0.35) { say(TAUNT_HIT[Math.random() * TAUNT_HIT.length | 0], 1.2); tauntCd = 3; boss.face = 'ouch'; setTimeout(() => { if (boss.face === 'ouch') boss.face = 'open'; }, 350); }
        if (boss.phase === 1 && boss.hp <= 67) { boss.hp = 67; toPhase(2); }
        else if (boss.phase === 2 && boss.hp <= 34) { boss.hp = 34; toPhase(3); }
        else if (boss.phase === 3 && boss.hp <= 0) startDefeat();
      }
      function toPhase(p) {
        boss.phase = p; boss.inv = 2.2; boss.shakeJ = 2.2; boss.hop = null; boss.wait = 2.4; boss.spitT = 2.6;
        shake = 4; api.sfx('boom');
        if (p === 2) { say('Jetzt wird es ernst! Socken, Angriff!', 2.4); popText('PHASE 2', 90, 120, '#ff8a2a'); eva.say = 'Socken?!'; eva.sayT = 1.4; }
        if (p === 3) { say('Ich dreh gleich durch!!', 2.4); popText('PHASE 3', 90, 120, '#ff3fa4'); }
      }
      function spawnMini() {
        if (minis.length >= 5) return;
        const bs = bossScreen(), [mx, my] = toScreen(bs, OX, 84);
        const kinds = ['gift', 'sock', 'kerze'];
        minis.push({ kind: kinds[Math.random() * 3 | 0], x: mx, y: my, x0: mx, y0: my, x1: rnd(36, 144), y1: rnd(236, 262), t: 0, fly: 0.8, ph: Math.random() * 6 });
        boss.mouth = 1; api.sfx('jump');
      }

      /* ---------- defeat → disco ---------- */
      function startDefeat() {
        mode = 'defeat'; mt = 0; boss.inv = 99; boss.face = 'dizzy'; boss.mouth = 1; boss.shakeJ = 1.6;
        say('NEEEIIIN! Meine Schleife!', 1.6); shake = 5; api.sfx('boom');
        minis.forEach(m => confetti(m.x, m.y - 5, 14, 60)); minis.length = 0;
        shots.length = 0; items.length = 0;
      }
      function burstBox() {
        burstDone = true; boss.visible = false; flash = 1; shake = 7; api.sfx('boom'); setTimeout(() => api.sfx('launch'), 180);
        const bs = bossScreen();
        const mk = (x, y, w, h, vx, vy, vr, c) => pieces.push({ x, y, w, h, vx, vy, r: 0, vr, c });
        mk(bs.x, bs.y - 44, 68, 12, rnd(-20, 20), -260, rnd(-6, 6), '#e0574a');
        mk(bs.x - 24, bs.y - 23, 14, 46, -150, -120, -4, '#d94c3d');
        mk(bs.x + 24, bs.y - 23, 14, 46, 150, -120, 4, '#c8443a');
        mk(bs.x - 10, bs.y - 12, 26, 22, -70, -200, -3, '#d94c3d');
        mk(bs.x + 10, bs.y - 12, 26, 22, 70, -200, 3, '#c8443a');
        confetti(bs.x, bs.y - 30, 160, 170);
        ballOn = true; ballY = bs.y - 26; spin = 9;
      }
      const DANCE = {
        magnus: { x: 30, y: 246, style: 'side', off: 1 }, laurenz: { x: 150, y: 246, style: 'pogo', off: 0 },
        eva: { x: 78, y: 280, style: 'couple', side: 0 }, niklas: { x: 102, y: 280, style: 'couple', side: 1 },
        hannah: { x: 38, y: 306, style: 'sway', off: 2 }, enrico: { x: 142, y: 306, style: 'robot', off: 3 }
      };
      let dancers = null;
      function makeDancers() {
        const all = FRIENDS.map(f => ({ who: f.who, x: f.x + 12, y: f.y }));
        all.push({ who: 'eva', x: eva.x, y: EVA_Y });
        all.push({ who: 'niklas', x: 196, y: 286, late: 0.8 });
        dancers = all.map(d => Object.assign(d, DANCE[d.who], { cx: d.x, cy: d.y, arrived: false, delay: d.late || Math.random() * 0.4 }));
        dancers.sort((a, b) => a.y - b.y);
      }
      function startDisco() {
        mode = 'disco'; discoT = 0; dark = 1; chainK = 1;
        api.music('disco');
        if (!isDev) { won = true; api.win(); }
        else winTimer = 90; // dev harness restarts the game on win → let the party run first
      }

      /* ---------- dance poses (as in disco.js) ---------- */
      function pose(d, beat) {
        const b = beat, bi = Math.floor(b), f = b - bi, bar = ((bi % 4) + 4) % 4, bounce = Math.sin(Math.PI * f);
        let dx = 0, dy = -bounce * 3, frame = bi % 2 ? 'run1' : 'run2', flip = false;
        switch (d.style) {
          case 'side': dx = Math.sin(b * Math.PI / 2) * 6; flip = (bi % 2) === 1; dy = -bounce * 2; break;
          case 'pogo': if (bar % 2 === 1) { dy = -bounce * 10; frame = 'jump'; } else { dy = 0; frame = 'idle'; } flip = true; break;
          case 'couple': {
            const twirl = ((bi >> 2) % 4) === 3; flip = d.side === 1;
            if (twirl) { dx = (d.side ? -1 : 1) * Math.sin(Math.PI * ((bi % 4) + f) / 4) * 12; flip = (bi % 2) === 1; if (bar === 3) { frame = 'jump'; dy = -bounce * 8; } }
            else frame = bar % 2 ? 'run1' : 'idle';
            break;
          }
          case 'sway': dx = Math.sin(b * Math.PI) * 3; dy = -Math.abs(Math.sin(b * Math.PI)) * 2; flip = ((bi >> 2) % 2) === 1; frame = bar % 2 ? 'run1' : 'idle';
            if (((bi >> 3) % 2) && bar === 3) { dy = -bounce * 9; frame = 'jump'; } break;
          case 'robot': dx = (Math.floor(b * 2) % 4 - 1.5) * 2; dy = (Math.floor(b * 2) % 2) ? -2 : 0; frame = ['idle', 'run1', 'idle', 'run2'][Math.floor(b * 2) % 4]; flip = ((bi >> 1) % 2) === 0; break;
        }
        return { dx, dy, frame, flip };
      }
      const tStart = performance.now();
      function beatNow() {
        const b = E.Audio.beat && E.Audio.beat();
        if (mode === 'disco' && b != null && E.Audio.bpm && E.Audio.bpm() === 120) return Math.max(0, b);
        return (performance.now() - tStart) / 500;
      }

      /* ================= input ================= */
      const keys = {};
      function onDown(e) {
        e.preventDefault();
        const p = cv.pointer(e);
        if (mode === 'disco' || mode === 'defeat') {
          drag = { x0: p.x, y0: p.y, x: p.x, t: performance.now(), moved: 0, v: 0 };
          try { cv.canvas.setPointerCapture(e.pointerId); } catch (_) {}
          return;
        }
        if (mode !== 'fight') return;
        // tap on a minion?
        let best = null, bd = 18;
        for (const m of minis) { const d = Math.hypot(p.x - m.x, p.y - (m.y - 9)); if (d < bd) { bd = d; best = m; } }
        if (best) return throwAt(best.x, best.y - 9, best);
        if (p.y > 284) { eva.tx = clamp(p.x, 40, 140); return; }
        throwAt(p.x, p.y, null);
      }
      function onMove(e) {
        if (!drag) return;
        const p = cv.pointer(e), dx = p.x - drag.x, now = performance.now(), dtm = Math.max(8, now - drag.t);
        drag.moved += Math.abs(dx); drag.x = p.x; drag.t = now;
        if (drag.moved > 6 && ballOn) {
          rot += dx / BR;                          // surface follows the finger
          drag.v = drag.v * 0.5 + (dx / dtm * 1000 / BR) * 0.5;
          spin = drag.v; hintT = 0;
        }
      }
      function onUp() {
        if (!drag) return;
        const d = drag; drag = null;
        spin = clamp(spin, -45, 45);
        if (d.moved <= 6) {
          if (ballOn && Math.hypot(d.x0 - 90, d.y0 - ballY) < BR + 2) { spin += spin >= 0 ? 6 : -6; api.sfx('ding'); flash = 0.25; }
          else { confetti(clamp(d.x0, 6, W - 6), clamp(d.y0, 6, H - 6), 46, 110); POPT.push({ s: '🎉', x: d.x0, y: d.y0, c: null, t: 0 }); api.sfx('coin'); flash = 0.5; }
        } else if (Math.abs(spin) > 12) api.sfx('launch');
      }
      function onKey(e) {
        const k = e.code;
        if (['Space', 'Enter', 'ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'ArrowUp'].includes(k)) e.preventDefault();
        if (e.type === 'keyup') { keys[k] = false; return; }
        keys[k] = true;
        if (k === 'Space' || k === 'Enter' || k === 'ArrowUp') {
          if (mode === 'fight') {
            const mm = minis.find(m => m.t >= m.fly && Math.abs(m.x - eva.x) < 50 && m.y > 255);
            if (mm) throwAt(mm.x, mm.y - 5, mm);
            else { const bs = bossScreen(), ws = weakSpots(fightT); const [x, y] = ws.length ? toScreen(bs, ...ws[Math.random() * ws.length | 0]) : [bs.x, bs.y - 30]; throwAt(x, y, null); }
          } else if (mode === 'disco') { confetti(rnd(30, 150), rnd(150, 260), 46, 110); api.sfx('coin'); flash = 0.4; }
        }
        if (mode === 'disco' && (k === 'ArrowLeft' || k === 'ArrowRight')) { spin += k === 'ArrowLeft' ? -8 : 8; hintT = 0; }
      }
      cv.canvas.addEventListener('pointerdown', onDown);
      cv.canvas.addEventListener('pointermove', onMove);
      cv.canvas.addEventListener('pointerup', onUp);
      cv.canvas.addEventListener('pointercancel', onUp);
      window.addEventListener('keydown', onKey);
      window.addEventListener('keyup', onKey);

      /* ================= update ================= */
      function updateBoss(dt, t) {
        boss.look = (eva.x - boss.x) / 20;
        boss.mouth = Math.max(0, boss.mouth - dt * 2.2);
        boss.sq = Math.max(0, boss.sq - dt * 5);
        boss.hitF -= dt; boss.inv -= dt; boss.shakeJ -= dt; tauntCd -= dt;
        if (boss.sayT > 0) boss.sayT -= dt;
        if (mode === 'defeat') { boss.spin *= 0.9; return; }
        if (boss.phase === 0) return;
        if (boss.inv > 0) { boss.z = Math.max(0, boss.z - dt * 120); boss.spin = boss.phase === 3 ? boss.spin + dt * 10 : 0; return; }
        if (boss.phase === 3) {
          boss.spin += dt * 7.5;
          boss.loose = Math.min(1, boss.loose + dt * 0.4 * (boss.hp < 18 ? 2 : 1));
          boss.x = 90 + Math.sin(t * 0.9) * 32;
          boss.z = Math.abs(Math.sin(t * 3.2)) * 7;
          boss.spitT -= dt; if (boss.spitT <= 0) { boss.spitT = 3.4; spawnMini(); }
          if (boss.hp < 18 && !boss._s3) { boss._s3 = 1; say('Meine Schleife löst sich!', 2); }
          return;
        }
        boss.spin = 0;
        if (boss.hop) {
          const h = boss.hop; h.t += dt;
          const k = Math.min(1, h.t / h.dur);
          boss.x = lerp(h.x0, h.x1, k); boss.z = 4 * h.hh * k * (1 - k);
          if (k >= 1) { boss.hop = null; boss.z = 0; boss.sq = 1; shake = Math.max(shake, boss.phase === 1 ? 4 : 2.5); api.sfx(boss.phase === 1 ? 'boom' : 'step'); confetti(boss.x - 30, GROUND, 4, 30); boss.wait = boss.phase === 1 ? rnd(0.5, 0.9) : rnd(1.8, 2.6); }
          return;
        }
        boss.wait -= dt;
        if (boss.phase === 2) { boss.spitT -= dt; if (boss.spitT <= 0) { boss.spitT = rnd(1.3, 1.9); spawnMini(); } }
        if (boss.wait <= 0) {
          let x1; do { x1 = rnd(52, 128); } while (Math.abs(x1 - boss.x) < 22);
          boss.hop = { x0: boss.x, x1, t: 0, dur: boss.phase === 1 ? 0.75 : 0.6, hh: boss.phase === 1 ? 40 : 18 };
          api.sfx('jump');
        }
      }
      function updateFight(dt, t) {
        fightT += dt;
        // Eva
        eva.cd -= dt; eva.throwF -= dt; eva.hurt -= dt;
        if (eva.sayT > 0) eva.sayT -= dt;
        if (keys.ArrowLeft || keys.KeyA) eva.tx = clamp(eva.x - 20, 40, 140);
        if (keys.ArrowRight || keys.KeyD) eva.tx = clamp(eva.x + 20, 40, 140);
        if (eva.kb > 0) { eva.kb -= dt; eva.x = clamp(eva.x + eva.vx * dt, 40, 140); eva.vx *= 0.9; eva.tx = eva.x; }
        else { const d = eva.tx - eva.x; if (Math.abs(d) > 1) { eva.x += Math.sign(d) * Math.min(Math.abs(d), 70 * dt); eva.flip = d < 0; } }
        // buffs
        if (buff.t > 0) { buff.t -= dt; if (buff.t <= 0 && buff.kind !== 'zapfen') buff.kind = null; }
        if (buff.kind === 'zapfen' && buff.n <= 0) buff.kind = null;
        // shots
        const bs = bossScreen();
        for (let i = shots.length - 1; i >= 0; i--) {
          const s = shots[i]; s.t += dt;
          if (s.target && minis.includes(s.target)) { s.tx = s.target.x; s.ty = s.target.y - 9; }
          const k = Math.min(1, s.t / s.dur);
          s.x = lerp(s.x0, s.tx, k); s.y = lerp(s.y0, s.ty, k) - Math.sin(Math.PI * k) * 18;
          if (s.kind !== 'zapfen' && Math.random() < 0.6) P.push({ x: s.x, y: s.y, vx: rnd(-10, 10), vy: rnd(-10, 10), c: CONF[Math.random() * 8 | 0], life: 0.4, ph: 0 });
          if (k < 1) continue;
          shots.splice(i, 1);
          // minions first
          let hitM = null;
          for (const m of minis) if (Math.hypot(m.x - s.tx, m.y - 9 - s.ty) < 15) { hitM = m; break; }
          if (hitM) { minis.splice(minis.indexOf(hitM), 1); confetti(hitM.x, hitM.y - 5, 22, 80); popText('PLOPP!', hitM.x, hitM.y - 16, '#fff'); api.sfx('coin'); continue; }
          // weak spots
          let weak = false;
          for (const w of weakSpots(t)) { const [x, y] = toScreen(bs, w[0], w[1]); if (Math.hypot(x - s.tx, y - s.ty) < 10) { weak = true; break; } }
          const sx = OX + (s.tx - bs.x) / bs.sx, sy = OY + (s.ty - bs.y) / bs.sy;
          const inBody = sx > 14 && sx < 86 && sy > 34 && sy < 99, inBow = sx > 30 && sx < 70 && sy > 18 && sy <= 36;
          const tail = boss.phase === 3 && Math.abs(s.ty - (bs.y - 50)) < 16 && Math.abs(s.tx - bs.x) < 60;
          if (weak) damage(3 * s.dmg, s.tx, s.ty, true);
          else if (inBody || inBow || tail) damage(s.dmg, s.tx, s.ty, false);
          else { confetti(s.tx, s.ty, 5, 30); }
        }
        // minions
        for (let i = minis.length - 1; i >= 0; i--) {
          const m = minis[i]; m.t += dt; m.ph += dt * 8;
          if (m.t < m.fly) { const k = m.t / m.fly; m.x = lerp(m.x0, m.x1, k); m.y = lerp(m.y0, m.y1, k) - Math.sin(Math.PI * k) * 40; continue; }
          const dx = eva.x - m.x, dy = (EVA_Y - 2) - m.y, d = Math.hypot(dx, dy) || 1, sp = 20 + boss.phase * 2;
          m.x += dx / d * sp * dt; m.y += dy / d * sp * dt;
          if (Math.abs(dx) < 13 && Math.abs(dy) < 8) {
            minis.splice(i, 1); confetti(m.x, m.y - 5, 10, 50);
            if (eva.kb <= 0) { eva.kb = 0.55; eva.vx = (dx > 0 ? 1 : -1) * 150; eva.hurt = 0.7; eva.say = ['Uff!', 'Hey!', 'Igitt, Socke!'][Math.random() * 3 | 0]; eva.sayT = 0.9; api.sfx('hit'); shake = Math.max(shake, 2); }
          }
        }
        // friends cheer + throw items
        cheerT -= dt; itemT -= dt;
        if (cheerT <= 0) { cheerT = rnd(4, 7); const f = FRIENDS[Math.random() * 4 | 0]; f.say = CHEERS[Math.random() * CHEERS.length | 0]; f.sayT = 1.6; }
        if (itemT <= 0) {
          itemT = rnd(10, 13);
          const order = [1, 2, 0, 3], f = FRIENDS[order[itemIdx++ % 4]];
          const kind = f.who === 'magnus' ? 'popper' : f.item;
          f.say = f.who === 'magnus' ? 'Mega-Kracher!' : ITEMSAY[kind]; f.sayT = 1.6;
          items.push({ kind, x0: f.x + 12, y0: f.y - 24, t: 0, dur: 1.0, x: f.x, y: f.y });
          api.sfx('jump');
        }
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i]; it.t += dt; const k = Math.min(1, it.t / it.dur);
          it.x = lerp(it.x0, eva.x, k); it.y = lerp(it.y0, EVA_Y - 20, k) - Math.sin(Math.PI * k) * 50;
          if (k >= 1) {
            items.splice(i, 1); api.sfx('pour');
            if (it.kind === 'zapfen') { buff.kind = 'zapfen'; buff.n = 4; buff.t = 0; popText('RIESEN-ZAPFEN x4', eva.x, EVA_Y - 46, '#f5c542'); }
            else { buff.kind = it.kind; buff.t = 6; buff.n = 0; popText(it.kind === 'kaffee' ? 'TURBO!' : 'DREIFACH!', eva.x, EVA_Y - 46, '#f5c542'); }
          }
        }
      }

      /* ================= drawing ================= */
      function drawEva(t) {
        let frame = 'idle';
        if (eva.throwF > 0) frame = 'jump';
        else if (Math.abs(eva.tx - eva.x) > 1 || eva.kb > 0) frame = Math.floor(t * 10) % 2 ? 'run1' : 'run2';
        if (eva.hurt > 0 && Math.floor(t * 20) % 2) return;
        g.fillStyle = 'rgba(0,0,0,0.3)'; R(g, eva.x - 9, EVA_Y - 2, 18, 3);
        api.drawChar(g, 'eva', frame, Math.round(eva.x - 12), EVA_Y - 32 - (frame === 'jump' ? 2 : 0), 2, eva.flip);
      }
      function drawFriends(t) {
        for (const f of FRIENDS) {
          const k = Math.sin(t * 7 + f.off * 10), jump = mode === 'fight' && k > 0.6;
          api.drawChar(g, f.who, jump ? 'jump' : (k > 0 ? 'run1' : 'idle'), f.x, f.y - 32 - (jump ? 4 : 0), 2, f.flip);
        }
      }
      function drawShot(s) {
        if (s.kind === 'zapfen' || s.kind === 'mega') {
          const sc = s.kind === 'mega' ? 2 : 1;
          api.drawPixels(g, ITEM.zapfen, ITEMPAL, s.x - 2 * sc | 0, s.y - 3 * sc | 0, sc);
        } else api.drawPixels(g, ITEM.popper, ITEMPAL, s.x - 2 | 0, s.y - 3 | 0, 1);
      }
      function drawMini(m) {
        const sp = MINI[m.kind], bob = m.t >= m.fly ? Math.abs(Math.sin(m.ph)) * 2 : 0;
        g.fillStyle = 'rgba(0,0,0,0.3)'; R(g, m.x - 7, m.t >= m.fly ? m.y : m.y1, 14, 3);
        api.drawPixels(g, sp.rows, sp.pal, Math.round(m.x - 8), Math.round(m.y - sp.rows.length * 2 - bob), 2);
      }
      function drawHud(t) {
        if (mode !== 'fight' && mode !== 'intro') return;
        g.fillStyle = 'rgba(20,10,30,0.7)'; R(g, 0, 0, W, 24);
        api.text(g, 'GESCHENK', 4, 3, 8, '#f5c542', 'left');
        api.text(g, (boss.phase || 1) + '/3', W - 4, 3, 8, '#fff', 'right');
        g.fillStyle = '#1b1420'; R(g, 3, 13, W - 6, 8);
        const w = (W - 8) * boss.hp / 100;
        g.fillStyle = boss.inv > 0 && Math.floor(t * 10) % 2 ? '#fff' : '#d94c3d'; R(g, 4, 14, w, 6);
        g.fillStyle = '#ef8f7f'; R(g, 4, 14, w, 2);
        g.fillStyle = '#f5c542'; R(g, 4 + (W - 8) * 0.67, 13, 1, 8); R(g, 4 + (W - 8) * 0.34, 13, 1, 8);
        if (buff.kind && (buff.t > 0 || buff.n > 0)) {
          api.drawPixels(g, ITEM[buff.kind], ITEMPAL, 4, 27, 2);
          if (buff.kind === 'zapfen') api.text(g, 'x' + buff.n, 16, 29, 8, '#fff', 'left');
          else { g.fillStyle = '#f5c542'; R(g, 16, 31, buff.t * 6, 3); }
        }
      }
      function beam(x, y, ang, len, spread, color, alpha) {
        g.globalAlpha = alpha; g.fillStyle = color;
        g.beginPath(); g.moveTo(x, y);
        g.lineTo(x + Math.cos(ang - spread) * len, y + Math.sin(ang - spread) * len);
        g.lineTo(x + Math.cos(ang + spread) * len, y + Math.sin(ang + spread) * len);
        g.closePath(); g.fill();
      }
      function neon(str, y, col, glow, k) {
        g.save(); g.font = '8px "Press Start 2P", monospace'; g.textAlign = 'center'; g.textBaseline = 'top';
        g.globalAlpha = 0.35 + 0.4 * k; g.fillStyle = glow;
        for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-2, 0], [2, 0], [0, 2], [0, -2]]) g.fillText(str, W / 2 + ox, y + oy);
        g.globalAlpha = 1; g.fillStyle = col; g.fillText(str, W / 2, y); g.restore();
      }
      const DOTS = [];
      for (let i = 0; i < 60; i++) DOTS.push({ a: Math.random(), y: 30 + Math.random() * (H - 40), sp: 0.7 + Math.random() * 0.6, c: Math.random() < 0.6 ? -1 : (Math.random() * 6 | 0), s: Math.random() < 0.25 ? 2 : 1 });
      const BX = 90, BALL_Y = 98;

      function drawDisco(t, beat, alpha) {
        const bi = Math.floor(beat), bf = beat - bi, bar = Math.floor(bi / 4);
        const pulse = Math.pow(1 - bf, 2);
        g.globalAlpha = alpha; g.drawImage(disco, 0, 0);
        const md = ((bar % 4) + 4) % 4;
        for (const tl of tiles) {
          let on, ci;
          if (md === 0) { on = (tl.r + tl.c + bi) % 2 === 0; ci = bi + tl.r; }
          else if (md === 1) { on = ((tl.c - bi % 7 + 7) % 7) < 2 || ((tl.r + bi) % 6) === 0; ci = tl.c + bi; }
          else if (md === 2) { const dd = Math.abs(tl.c - 3) + Math.abs(tl.r - 4); on = dd % 3 === bi % 3; ci = dd + bi; }
          else { on = hash(tl.r * 7 + tl.c, bi) > 0.45; ci = Math.floor(hash(tl.c, tl.r + bi) * 6); }
          ci = ((ci % 6) + 6) % 6;
          g.globalAlpha = alpha; g.fillStyle = '#0c0814'; R(g, tl.x, tl.y, tl.w, tl.h);
          g.globalAlpha = alpha * (on ? 0.55 + 0.45 * pulse : 0.12); g.fillStyle = LIGHTS[ci]; R(g, tl.x + 1, tl.y + 1, tl.w - 2, tl.h - 2);
          if (on) { g.globalAlpha = alpha * (0.35 * pulse + 0.2); g.fillStyle = '#fff'; R(g, tl.x + 2, tl.y + 2, tl.w - 4, 1); }
        }
        g.globalAlpha = 1;
        if (!ballOn) return pulse;
        // beams + reflection dots follow the ball's rotation
        g.globalCompositeOperation = 'lighter';
        const c1 = LIGHTS[bi % 6], c2 = LIGHTS[(bi + 3) % 6];
        beam(4, 28, Math.PI * 0.32 + Math.sin(t * 0.9) * 0.45, 300, 0.07, c1, alpha * (0.12 + 0.07 * pulse));
        beam(W - 4, 28, Math.PI * 0.68 + Math.sin(t * 1.1 + 1) * 0.45, 300, 0.07, c2, alpha * (0.12 + 0.07 * pulse));
        for (let k = 0; k < 6; k++) {
          const a = rot * 1.0 + k * Math.PI / 3;
          beam(BX, ballY, Math.PI / 2 + Math.sin(a) * 1.35, 280, 0.022, LIGHTS[(k + bi) % 6], alpha * 0.1 * Math.max(0.2, Math.cos(a) + 0.6));
        }
        const streak = Math.min(12, Math.abs(spin) * 0.3);
        for (let i = 0; i < DOTS.length; i++) {
          const d = DOTS[i];
          const xx = ((((d.a + rot * 0.08 * d.sp) % 1) + 1) % 1) * (W + 20) - 10;
          g.globalAlpha = alpha * (0.55 + 0.4 * Math.sin(t * 6 + i));
          g.fillStyle = d.c < 0 ? '#ffffff' : LIGHTS[d.c];
          const len = d.s + 1 + streak * d.sp;
          R(g, spin >= 0 ? xx - len + d.s + 1 : xx, d.y, len, d.s);
        }
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        return pulse;
      }
      function drawMotor(t) {
        const top = 28, len = chainK * (ballY - BR - 40);
        if (chainK <= 0) return;
        g.globalAlpha = Math.min(1, chainK * 2);
        g.fillStyle = '#3a3346'; R(g, BX - 10, top - 2, 20, 3);
        g.fillStyle = '#5a5568'; R(g, BX - 8, top + 1, 16, 11);
        g.fillStyle = '#7a7590'; R(g, BX - 8, top + 1, 16, 2);
        g.fillStyle = '#2a2636'; R(g, BX - 6, top + 5, 12, 5);
        const ph = Math.floor(motorA) % 4;
        g.fillStyle = '#9a96b0'; for (let k = 0; k < 3; k++) R(g, BX - 6 + ((k * 4 + ph) % 12), top + 5, 2, 5);
        g.fillStyle = (Math.floor(t * 4) % 2) ? '#5cff6a' : '#1d6a24'; R(g, BX + 5, top + 2, 2, 2);
        g.fillStyle = 'rgba(220,220,255,0.7)';
        const wl = Math.min(4, 1 + Math.abs(spin) / 8);
        if (ph % 2) { R(g, BX - 11 - wl, top + 4, wl, 1); R(g, BX + 11, top + 8, wl, 1); } else { R(g, BX - 11 - wl, top + 8, wl, 1); R(g, BX + 11, top + 4, wl, 1); }
        for (let y = top + 12; y < top + 12 + len; y += 3) {
          const alt = ((y / 3 | 0) + Math.floor(rot * 6)) % 2;
          g.fillStyle = alt ? '#c8c8d4' : '#7a7a88'; R(g, BX - (alt ? 1 : 0), y, alt ? 3 : 1, 2);
        }
        g.globalAlpha = 1;
      }

      /* ================= main loop ================= */
      const stop = api.loop((dtR, t) => {
        mt += dtR;
        const dt = dtR * slow;
        const beat = beatNow();

        if (mode === 'intro') {
          eva.x = Math.min(eva.tx, eva.x + 50 * dtR);
          if (mt > 1.6 && boss.face === 'sleep') { boss.face = 'open'; boss.sq = 1; shake = 5; api.sfx('boom'); boss.mouth = 1; }
          if (mt > 1.9 && mt < 2.0) say('Du willst mich auspacken?!', 1.8);
          if (mt > 3.8 && boss.sayStr !== 'Niemals!') { say('Niemals!', 1.4); boss.face = 'angry'; boss.mouth = 1; shake = 3; }
          if (mt > 1.6 && mt < 3.8) boss.z = Math.abs(Math.sin((mt - 1.6) * 6)) * (mt < 2.2 ? 14 : 3);
          if (mt > 5.0) { mode = 'fight'; boss.phase = 1; boss.face = 'open'; boss.z = 0; eva.tx = eva.x; hintT = 3.5; }
        } else if (mode === 'fight') {
          updateFight(dt, t);
        } else if (mode === 'defeat') {
          slow = mt < 2.4 ? 0.35 : 1;
          if (mt > 0.9 && boss.bow) {
            boss.bow = false; const bs = bossScreen(); bowFly = { x: bs.x, y: bs.y - 66, vx: rnd(-30, 30), vy: -90, r: 0 };
            api.sfx('launch'); popText('Die Schleife!', bs.x, bs.y - 80, '#f5c542');
          }
          if (mt > 1.9 && !burstDone) burstBox();
          if (burstDone) {
            const k = ease((mt - 2.1) / 2.2);
            ballY = lerp(GROUND - 26, BALL_Y, k);
            chainK = clamp((mt - 3.2) / 1.0, 0, 1);
            dark = clamp((mt - 2.0) / 1.8, 0, 1);
            if (mt > 2.6 && !dancers) makeDancers();
          }
          if (mt > 4.6) startDisco();
        } else if (mode === 'disco') {
          discoT += dtR;
          if (winTimer > 0) { winTimer -= dtR; if (winTimer <= 0 && !won) { won = true; api.win(); } }
        }
        updateBoss(dt, t);

        // ball spin with momentum; motor pulls it back to its cruising speed
        if (ballOn) {
          if (!drag) { spin += (1.6 - spin) * Math.min(1, dtR * 0.45); rot += dtR * spin; }
          motorA += dtR * (22 + Math.abs(spin) * 6);
        }
        // dancers walk to their spots, then dance
        if (dancers) for (const d of dancers) {
          if (d.delay > 0) { d.delay -= dtR; continue; }
          const dx = d.x - d.cx, dy = d.y - d.cy, dist = Math.hypot(dx, dy);
          if (dist > 1) { const s = Math.min(dist, 60 * dtR); d.cx += dx / dist * s; d.cy += dy / dist * s; d.walk = true; d.flipW = dx < 0; }
          else { d.cx = d.x; d.cy = d.y; d.walk = false; d.arrived = true; }
        }

        /* ---------- draw ---------- */
        g.save();
        if (shake > 0) { g.translate(Math.round((Math.random() - 0.5) * shake), Math.round((Math.random() - 0.5) * shake)); shake = Math.max(0, shake - dtR * 12); }
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        if (dark < 1) g.drawImage(day, 0, 0);
        let pulse = 0;
        if (dark > 0) pulse = drawDisco(t, beat, dark);

        if (!dancers) drawFriends(t);
        // light column from the opened box
        if (burstDone && mt < 4.5 && mode === 'defeat') {
          g.globalCompositeOperation = 'lighter';
          const a = clamp(1 - (mt - 2.0) / 2.5, 0, 1);
          beam(90, GROUND + 4, -Math.PI / 2, 260, 0.22, '#fff6c8', 0.35 * a);
          beam(90, GROUND + 4, -Math.PI / 2, 260, 0.08, '#ffffff', 0.4 * a);
          g.globalCompositeOperation = 'source-over';
        }
        if (boss.visible) drawBoss(t);
        // flying pieces
        for (let i = pieces.length - 1; i >= 0; i--) {
          const p = pieces[i]; p.vy += 260 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
          if (p.y > H + 60) { pieces.splice(i, 1); continue; }
          g.save(); g.translate(p.x, p.y); g.rotate(p.r);
          g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          g.fillStyle = '#f5c542'; g.fillRect(-3, -p.h / 2, 6, p.h);
          g.restore();
        }
        if (bowFly) {
          bowFly.vy += 30 * dt; bowFly.x += bowFly.vx * dt; bowFly.y += bowFly.vy * dt; bowFly.r += dt * 7;
          g.save(); g.translate(bowFly.x, bowFly.y); g.rotate(bowFly.r);
          g.fillStyle = '#f5c542'; g.fillRect(-12, -5, 10, 10); g.fillRect(2, -5, 10, 10);
          g.fillStyle = '#ffe27a'; g.fillRect(-3, -3, 6, 6); g.restore();
          if (bowFly.y < -40) bowFly = null;
        }
        if (ballOn) {
          drawMotor(t);
          renderBall(rot, beat, mode !== 'disco');
          drawBall(BX, ballY, t);
        }
        for (const m of minis) drawMini(m);
        if (dancers) {
          for (const d of dancers) {
            let p = { dx: 0, dy: 0, frame: 'idle', flip: d.flipW };
            if (d.walk) p.frame = Math.floor(t * 10) % 2 ? 'run1' : 'run2';
            else if (d.arrived) p = pose(d, beat + (d.off || 0) * 0);
            g.fillStyle = 'rgba(0,0,0,0.45)'; R(g, d.cx - 10 + p.dx, d.cy - 2, 20, 3);
            api.drawChar(g, d.who, p.frame, Math.round(d.cx - 12 + p.dx), Math.round(d.cy - 32 + p.dy), 2, p.flip);
          }
          // hearts from Eva & Niklas
          const ev = dancers.find(d => d.who === 'eva'), nk = dancers.find(d => d.who === 'niklas');
          if (mode === 'disco' && ev.arrived && nk.arrived && Math.floor(beat) !== lastHeartBeat) { lastHeartBeat = Math.floor(beat); HEARTS.push({ x: 90 + rnd(-5, 5), y: 246, t: 0, c: Math.random() < 0.5 ? '#ff3f7a' : '#ff8fb8' }); }
        } else drawEva(t);
        for (let i = HEARTS.length - 1; i >= 0; i--) {
          const h = HEARTS[i]; h.t += dtR; h.y -= 18 * dtR; h.x += Math.sin(h.t * 4) * 0.3;
          if (h.t > 2.2) { HEARTS.splice(i, 1); continue; }
          g.globalAlpha = Math.min(1, (2.2 - h.t) * 1.5); api.drawPixels(g, HEART, { X: h.c }, h.x - 3 | 0, h.y | 0, 1); g.globalAlpha = 1;
        }
        for (const it of items) api.drawPixels(g, ITEM[it.kind], ITEMPAL, it.x - 4 | 0, it.y - 6 | 0, 2);
        for (const s of shots) drawShot(s);
        // confetti
        for (let i = P.length - 1; i >= 0; i--) {
          const p = P[i];
          p.vy += 120 * dt; p.vx *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.ph += dt * 10;
          if (p.life <= 0 || p.y > H + 4) { P.splice(i, 1); continue; }
          g.fillStyle = p.c; R(g, p.x, p.y, Math.sin(p.ph) > 0 ? 2 : 1, 2);
        }
        // speech bubbles
        if (boss.sayT > 0 && boss.sayStr && boss.visible) { const bs = bossScreen(); bubble(boss.sayStr, bs.x, bs.y - 72 * bs.sy, Math.min(1, boss.sayT * 4)); }
        if (mode === 'fight' || mode === 'intro') {
          for (const f of FRIENDS) if (f.sayT > 0) { f.sayT -= dtR; bubble(f.say, f.x + 12, f.y - 36, Math.min(1, f.sayT * 4)); }
          if (eva.sayT > 0) bubble(eva.say, eva.x, EVA_Y - 34, Math.min(1, eva.sayT * 4));
        }
        // pop texts
        for (let i = POPT.length - 1; i >= 0; i--) {
          const p = POPT[i]; p.t += dtR;
          if (p.t > 1) { POPT.splice(i, 1); continue; }
          g.globalAlpha = Math.min(1, (1 - p.t) * 3);
          if (p.c === null) { g.save(); g.font = (12 + Math.min(1, p.t * 6) * 10 | 0) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.s, p.x, p.y - p.t * 30); g.restore(); }
          else txt(p.s, p.x, p.y - p.t * 16, p.c);
          g.globalAlpha = 1;
        }
        g.restore();

        // HUD + texts (unshaken)
        drawHud(t);
        if (mode === 'intro' && mt < 1.6) txt('GIPFEL ERREICHT!', W / 2, 60, '#fff36a');
        if (mode === 'fight' && hintT > 0) { hintT -= dtR; if (Math.floor(t * 2) % 2) { txt('TIPPEN = WERFEN', W / 2, 112, '#fff'); txt('UNTEN = LAUFEN', W / 2, 312, '#fff'); } }
        if (mode === 'defeat' && mt < 1.9) txt('SLOW-MO!', W / 2, 40, '#fff36a');
        if (mode === 'disco' || (mode === 'defeat' && mt > 3.6)) {
          const bi = Math.floor(beat), k = mode === 'disco' ? Math.min(1, discoT * 1.5) : 0;
          const nc = (bi % 2) ? ['#ffd1ef', '#ff3fa4'] : ['#d4fbff', '#3fe0ff'];
          g.globalAlpha = k;
          neon('ALLES GUTE ZUM', 4, nc[0], nc[1], pulse);
          neon('GEBURTSTAG, EVA!', 15, '#fff6c8', '#ff8a2a', 1 - pulse);
          g.globalAlpha = clamp(discoT - 1.2, 0, 1);
          api.text(g, 'von Laurenz, Enrico,', W / 2, 160, 8, '#ffe9f3', 'center');
          api.text(g, 'Hannah & Magnus', W / 2, 171, 8, '#ffe9f3', 'center');
          g.globalAlpha = 1;
          if (mode === 'disco' && hintT > 0 && discoT > 2) { hintT -= dtR; if (Math.floor(t * 2) % 2) txt('WISCHEN = DREHEN', W / 2, 140, '#fff'); }
        }
        if (flash > 0) { g.globalAlpha = Math.min(1, flash) * 0.7; g.fillStyle = '#fff'; R(g, 0, 0, W, H); g.globalAlpha = 1; flash = Math.max(0, flash - dtR * 2.5); }
      });

      cv.canvas._fb = { boss, get mode() { return mode; }, damage: (n) => damage(n, 90, 160, false), get spin() { return spin; } };

      return function cleanup() {
        stop();
        cv.canvas.removeEventListener('pointerdown', onDown);
        cv.canvas.removeEventListener('pointermove', onMove);
        cv.canvas.removeEventListener('pointerup', onUp);
        cv.canvas.removeEventListener('pointercancel', onUp);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('keyup', onKey);
        cv.destroy();
      };
    }
  };
})();

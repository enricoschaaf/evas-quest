/* Disko-Flug – variant of Ballonflug: Eva flies through the beech forest, which turns into a disco the further she gets.
   Niklas hangs from a rotating disco ball and bobs up and down between some gaps. */
(function () {
  'use strict';

  GAMES['flappy_disco'] = {
    title: 'Disko-Flug',
    intro: 'Tippe, um mit den Ballons zu flattern, und flieg durch 10 Lücken. Niklas schaukelt an seiner Disko-Kugel – flieg unten durch, wenn er oben ist!',
    start(root, api) {
      const W = 180, H = 320, GROUND = 296, GOAL = 10;
      const cv = api.makeCanvas(root, W, H);
      const ctx = cv.ctx;
      api.music('game');

      /* ---------- tuning (gentle) ---------- */
      const GRAV = 400, FLAP = -150, MAXFALL = 190, SPEED = 58, SPACING = 118, OB_W = 28;
      const BASE_GAP = 118, MERCY_STEP = 14, MERCY_MAX = 3;
      const EVA_X = 46; // left of Eva sprite (scale 2 => 24x32)
      const E = window.Engine;
      const LIGHTS = ['#ff3fa4', '#3fe0ff', '#ffe23f', '#7cff4f', '#b45cff', '#ff8a2a'];
      const LRGB = LIGHTS.map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
      const NIK_AT = [2, 4, 6, 8];          // Niklas swings in the lane after gap 3, 5, 7, 9
      const NIK_EXTRA = 60;                 // lanes with Niklas are wider
      const NIK_OFF = OB_W + (SPACING + NIK_EXTRA - OB_W) / 2; // centred between two columns
      const NIK_W = 2.0;                    // bob speed (rad/s) -> ~3.1 s period
      const LINES = [['Hallo', 'Schatz!'], ['Tanzen', 'wir?'], ['Komm', 'tanzen!'], ['Disko', 'Zeit!']];
      const LINES2 = [['Duck', 'dich!'], ['Huiii!'], ['Hab', 'dich', 'lieb!'], ['Fast', 'da!']];

      /* ---------- beat clock: audio clock of the playing track, else wall clock @120bpm ---------- */
      const t0 = performance.now();
      function beatNow() {
        const b = E && E.Audio && E.Audio.beat ? E.Audio.beat() : null;
        if (b != null) return Math.max(0, b);
        return (performance.now() - t0) / 500;
      }
      const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };

      /* ---------- disco ball (adapted from js/disco.js, small) ---------- */
      const BR = 11, BD = BR * 2 + 1;
      const ball = document.createElement('canvas'); ball.width = BD; ball.height = BD;
      const ballG = ball.getContext('2d');
      const bimg = ballG.createImageData(BD, BD);
      const bpx = [];
      for (let yy = 0; yy < BD; yy++) for (let xx = 0; xx < BD; xx++) {
        const nx = (xx - BR) / BR, ny = (yy - BR) / BR, d = nx * nx + ny * ny;
        if (d > 1) continue;
        const nz = Math.sqrt(1 - d), lat = Math.asin(ny), lon = Math.atan2(nx, nz);
        const light = 0.35 + 0.65 * Math.max(0, -nx * 0.45 - ny * 0.55 + nz * 0.7);
        bpx.push({ i: (yy * BD + xx) * 4, latf: (lat / Math.PI + 0.5) * 6, lon, cosl: Math.cos(lat), light, edge: d > 0.8 });
      }
      let ballRenderedAt = -1;
      function renderBall(rot, beat) {
        const d = bimg.data, tint = LRGB[Math.floor(beat) % LRGB.length];
        for (let k = 0; k < bpx.length; k++) {
          const p = bpx[k];
          const fi = Math.floor(p.latf), fr = p.latf - fi;
          const ncols = Math.max(4, Math.round(12 * p.cosl * 0.5) * 2);
          const lf = ((p.lon + rot) / (Math.PI * 2)) * ncols;
          const fj = Math.floor(lf), fc = lf - fj, jj = ((fj % ncols) + ncols) % ncols;
          const grout = fr < 0.14 || fc < 0.14 / Math.max(0.3, p.cosl);
          const h = hash(fi, jj);
          const v = (0.45 + h * 0.55) * p.light * 255;
          let r = v, g = v, b = v * 1.06;
          if (h > 0.68) { r = r * 0.5 + tint[0] * 0.5 * p.light; g = g * 0.5 + tint[1] * 0.5 * p.light; b = b * 0.5 + tint[2] * 0.5 * p.light; }
          if (((h * 97 + beat * 0.5) % 1) < 0.05) { r = g = b = 255; }
          if (grout) { r *= 0.4; g *= 0.4; b *= 0.45; }
          if (p.edge) { r *= 0.7; g *= 0.7; b *= 0.8; }
          d[p.i] = r > 255 ? 255 : r; d[p.i + 1] = g > 255 ? 255 : g; d[p.i + 2] = b > 255 ? 255 : b; d[p.i + 3] = 255;
        }
        ballG.putImageData(bimg, 0, 0);
      }

      /* ---------- reflection dots ---------- */
      const DOTS = [];
      for (let i = 0; i < 40; i++) DOTS.push({ a: Math.random(), y: 4 + Math.random() * (H - 8), sp: 0.6 + Math.random() * 0.8, c: Math.random() < 0.5 ? -1 : (Math.random() * LIGHTS.length | 0), s: Math.random() < 0.25 ? 2 : 1 });

      /* ---------- pre-rendered parallax layers ---------- */
      function layer(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g); return c; }
      function rnd(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

      const sky = layer(W, H, g => {
        const bands = ['#7fb7d6', '#8cc0d8', '#9cc8d6', '#b4cfcf', '#cfd5c2', '#e6d6aa', '#f0cf92'];
        const bh = Math.ceil(GROUND / bands.length);
        bands.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * bh, W, bh); });
      });
      // far hills + far trees (slow)
      const farW = 240;
      const far = layer(farW, H, g => {
        const r = rnd(7);
        g.fillStyle = '#8a9a8a';
        for (let x = 0; x < farW; x++) { const y = 210 + Math.round(Math.sin(x / farW * Math.PI * 4) * 10 + Math.sin(x / 17) * 3); g.fillRect(x, y, 1, GROUND - y); }
        const cols = ['#a0684a', '#b98a4e', '#7d7a52'];
        for (let i = 0; i < 26; i++) {
          const x = Math.floor(r() * farW), top = 190 + Math.floor(r() * 30), c = cols[i % 3];
          g.fillStyle = '#6f6a5e'; g.fillRect(x, top + 10, 2, GROUND - top);
          g.fillStyle = c;
          for (let k = -6; k <= 6; k++) { const hh = Math.round(Math.sqrt(36 - k * k) * 1.6); g.fillRect((x + k + farW) % farW, top + 10 - hh, 1, hh * 2); }
        }
      });
      // mid trunks (medium)
      const midW = 300;
      const mid = layer(midW, H, g => {
        const r = rnd(42);
        for (let i = 0; i < 7; i++) {
          const x = Math.floor(i * midW / 7 + r() * 20), w = 5 + Math.floor(r() * 4);
          g.fillStyle = '#a3aba0'; g.fillRect(x, 0, w, GROUND);
          g.fillStyle = '#b3bab0'; g.fillRect(x, 0, 1, GROUND);
          g.fillStyle = '#929a90'; for (let y = 20; y < GROUND; y += 23 + Math.floor(r() * 18)) g.fillRect(x + 2, y, w - 4, 1);
        }
        // undergrowth
        const ub = ['#8a5a2a', '#a8642c', '#6b5a2a'];
        for (let x = 0; x < midW; x += 3) { const hgt = 6 + Math.floor(r() * 12); g.fillStyle = ub[x % 3]; g.fillRect(x, GROUND - hgt, 3, hgt); }
      });
      // canopy (top, medium-fast)
      const canW = 240;
      const canopy = layer(canW, 60, g => {
        const r = rnd(99);
        const cols = ['#c9562c', '#e08a2e', '#f2b33d', '#b33a2a', '#d9a03a', '#8a7a2a'];
        for (let i = 0; i < 70; i++) {
          const cx = Math.floor(r() * canW), cy = Math.floor(r() * 26), rad = 5 + Math.floor(r() * 9);
          g.fillStyle = cols[Math.floor(r() * cols.length)];
          for (let dy = -rad; dy <= rad; dy++) { const hw = Math.round(Math.sqrt(rad * rad - dy * dy)); for (let ox = -canW; ox <= canW; ox += canW) g.fillRect(cx - hw + ox, cy + dy, hw * 2, 1); }
        }
        g.fillStyle = '#a8401f'; g.fillRect(0, 0, canW, 6);
      });
      // ground strip (fast, scrolls with obstacles)
      const grW = 64;
      const ground = layer(grW, H - GROUND, g => {
        const r = rnd(5);
        g.fillStyle = '#6b4226'; g.fillRect(0, 0, grW, H - GROUND);
        g.fillStyle = '#4a2c1a'; for (let i = 0; i < 40; i++) g.fillRect(Math.floor(r() * grW), 6 + Math.floor(r() * 18), 2, 1);
        const lc = ['#d9822b', '#f2b33d', '#b33a2a', '#a8642c'];
        for (let x = 0; x < grW; x += 2) { g.fillStyle = lc[Math.floor(r() * 4)]; g.fillRect(x, 0, 2, 2 + Math.floor(r() * 3)); }
        for (let i = 0; i < 14; i++) { g.fillStyle = lc[i % 4]; g.fillRect(Math.floor(r() * (grW - 3)), 5 + Math.floor(r() * 16), 3, 2); }
      });

      function tile(img, off, y) {
        const iw = img.width; let x = -(((off % iw) + iw) % iw);
        for (; x < W; x += iw) ctx.drawImage(img, Math.floor(x), y);
      }

      /* ---------- falling leaves ---------- */
      const LEAF_C = ['#d9822b', '#f2b33d', '#c9562c', '#b33a2a', '#e8a83a'];
      const leaves = [];
      for (let i = 0; i < 22; i++) leaves.push({ x: Math.random() * W, y: Math.random() * GROUND, vy: 10 + Math.random() * 14, ph: Math.random() * 6, c: LEAF_C[i % LEAF_C.length], far: i % 3 === 0 });

      /* ---------- balloons ---------- */
      const BAL = ['.ccc.', 'cwccc', 'cwccc', 'ccccc', 'ccccc', '.ccc.', '..d..'];
      const BCOL = [
        { c: '#d94c3d', d: '#a8342a' }, { c: '#f5d442', d: '#c9a52a' }, { c: '#4a7fd9', d: '#2f5aa8' },
        { c: '#f2a7b8', d: '#d27a90' }, { c: '#8a5bd9', d: '#6440a8' }
      ];
      // offsets (in canvas px, relative to Eva's hand) of balloon top-left at scale 2
      const BPOS = [[-14, -40], [-2, -46], [8, -38], [-8, -30], [4, -28]];

      function drawFlyer(ex, ey, t, frame) {
        const hx = ex + 17, hy = ey + 16; // Eva's hand (sprite px 8.5, 8)
        BPOS.forEach((p, i) => {
          const wx = Math.round(Math.sin(t * 2.6 + i * 1.7) * 1.5), wy = Math.round(Math.sin(t * 3.3 + i) * 1.2);
          const bx = hx + p[0] + wx, by = hy + p[1] + wy;
          // string: pixel line from knot to hand
          const kx = bx + 5, ky = by + 14;
          ctx.fillStyle = '#e9e1d0';
          const steps = Math.max(Math.abs(kx - hx), Math.abs(ky - hy));
          for (let s = 0; s <= steps; s++) ctx.fillRect(Math.round(kx + (hx - kx) * s / steps), Math.round(ky + (hy - ky) * s / steps), 1, 1);
        });
        BPOS.forEach((p, i) => {
          const wx = Math.round(Math.sin(t * 2.6 + i * 1.7) * 1.5), wy = Math.round(Math.sin(t * 3.3 + i) * 1.2);
          const col = BCOL[i];
          api.drawPixels(ctx, BAL, { c: col.c, d: col.d, w: '#ffffff' }, hx + p[0] + wx, hy + p[1] + wy, 2);
        });
        api.drawChar(ctx, 'eva', frame, ex, ey, 2, false);
      }

      /* ---------- obstacles ---------- */
      function drawTrunk(x, top) {
        const w = OB_W;
        ctx.fillStyle = '#9b9a90'; ctx.fillRect(x, top, w, GROUND - top);
        ctx.fillStyle = '#bdbcb0'; ctx.fillRect(x + 3, top, 5, GROUND - top);
        ctx.fillStyle = '#d2d1c6'; ctx.fillRect(x + 4, top, 2, GROUND - top);
        ctx.fillStyle = '#6f6e66'; ctx.fillRect(x + w - 5, top, 5, GROUND - top);
        ctx.fillStyle = '#4e4d47'; ctx.fillRect(x, top, 1, GROUND - top); ctx.fillRect(x + w - 1, top, 1, GROUND - top);
        // beech "eyes" marks
        for (let y = top + 14; y < GROUND - 6; y += 26) { ctx.fillStyle = '#5e5d56'; ctx.fillRect(x + 10, y, 9, 2); ctx.fillRect(x + 13, y + 2, 3, 1); }
        // broken top with a tuft of leaves
        ctx.fillStyle = '#7a7970'; ctx.fillRect(x - 2, top, w + 4, 4);
        ctx.fillStyle = '#4e4d47'; ctx.fillRect(x - 2, top + 4, w + 4, 1);
        ctx.fillStyle = '#e08a2e'; ctx.fillRect(x + 2, top - 3, 5, 3); ctx.fillStyle = '#f2b33d'; ctx.fillRect(x + 6, top - 4, 4, 4);
        ctx.fillStyle = '#c9562c'; ctx.fillRect(x + w - 9, top - 2, 6, 2);
        // roots
        ctx.fillStyle = '#7a7970'; ctx.fillRect(x - 4, GROUND - 4, 5, 4); ctx.fillRect(x + w - 1, GROUND - 3, 5, 3);
      }
      const CLUMP = ['#c9562c', '#e08a2e', '#f2b33d', '#b33a2a'];
      function drawBranch(x, bottom, seed) {
        const w = OB_W;
        // branch wood from the top
        ctx.fillStyle = '#5b3a24'; ctx.fillRect(x + 9, 0, 10, Math.max(0, bottom - 18));
        ctx.fillStyle = '#7a5134'; ctx.fillRect(x + 10, 0, 3, Math.max(0, bottom - 18));
        ctx.fillStyle = '#3b2416'; ctx.fillRect(x + 17, 0, 2, Math.max(0, bottom - 18));
        // side twigs with small leaf clusters along the branch
        for (let y = 26 + (seed % 3) * 6; y < bottom - 34; y += 34) {
          const left = ((y / 34) | 0) % 2 === 0;
          ctx.fillStyle = '#5b3a24';
          if (left) ctx.fillRect(x + 2, y, 8, 3); else ctx.fillRect(x + 18, y, 8, 3);
          ctx.fillStyle = CLUMP[(y + seed) % 4]; ctx.fillRect(left ? x - 1 : x + 23, y - 4, 7, 7);
          ctx.fillStyle = CLUMP[(y + seed + 1) % 4]; ctx.fillRect(left ? x + 1 : x + 25, y - 2, 3, 3);
        }
        // big leafy clump at the end (fills x-3..x+w+3, bottom-30..bottom)
        const cy = bottom - 15;
        const blobs = [[w / 2, 0, 15], [5, -5, 9], [w - 5, -5, 9], [w / 2, -9, 10], [4, 5, 8], [w - 4, 5, 8]];
        blobs.forEach((b, i) => {
          const r = b[2];
          ctx.fillStyle = i === 0 ? '#c9562c' : CLUMP[(i + seed) % 4];
          for (let dy = -r; dy <= r; dy++) {
            const hw = Math.round(Math.sqrt(r * r - dy * dy));
            const yy = cy + b[1] + dy;
            if (yy > bottom) continue;
            ctx.fillRect(Math.round(x + b[0] - hw), yy, hw * 2, 1);
          }
        });
        // highlights / leaf details
        ctx.fillStyle = '#f5d442';
        for (let k = 0; k < 7; k++) ctx.fillRect(x + ((k * 7 + seed * 3) % (w - 2)), cy - 10 + ((k * 11 + seed) % 20), 2, 2);
        ctx.fillStyle = '#8a2e1f';
        for (let k = 0; k < 6; k++) ctx.fillRect(x + 1 + ((k * 9 + seed * 5) % (w - 3)), cy - 6 + ((k * 13 + seed * 2) % 18), 2, 1);
      }

      /* ---------- Niklas on the disco ball ---------- */
      // geometry: ball centre (bx, by); Niklas sprite top = by + BR - 3; his feet ≈ by + BR + 29
      function nikPos(o, ahead) {
        const n = o.nik, m = mercy();
        const hi = n.c - 75, lo = n.c + 5 - 8 * m;            // bottom of Niklas' feet: highest / lowest
        const mid = (hi + lo) / 2, amp = (lo - hi) / 2;
        const bottom = mid + amp * Math.sin((frameT + (ahead || 0)) * NIK_W * (1 - 0.08 * m) + n.ph);
        return { bx: Math.round(o.x + NIK_OFF), by: Math.round(bottom - BR - 29) };
      }
      function nikHit(o, hb) {
        const p = nikPos(o);
        const { bx, by } = p;
        if (hb.r < bx - 13 || hb.l > bx + 13) return false;
        // chain
        if (hb.r > bx - 1 && hb.l < bx + 2 && hb.t < by - BR) return true;
        // ball (circle vs rect)
        const cx = Math.max(hb.l, Math.min(bx, hb.r)), cy = Math.max(hb.t, Math.min(by, hb.b));
        if ((cx - bx) * (cx - bx) + (cy - by) * (cy - by) < (BR - 1) * (BR - 1)) return true;
        // Niklas' body
        return hb.r > bx - 7 && hb.l < bx + 7 && hb.b > by + BR && hb.t < by + BR + 27;
      }
      function bubble(lines, x, y, tailRight) {
        const w = Math.max(...lines.map(l => l.length)) * 8 + 8, h = lines.length * 10 + 6;
        x = Math.max(2, Math.min(W - w - 2, Math.round(x))); y = Math.max(2, Math.round(y));
        ctx.fillStyle = '#1b1426'; ctx.fillRect(x - 1, y, w + 2, h); ctx.fillRect(x, y - 1, w, h + 2);
        ctx.fillStyle = '#fff8ec'; ctx.fillRect(x, y, w, h);
        const tx = tailRight ? x + w - 1 : x - 4;
        ctx.fillStyle = '#fff8ec'; ctx.fillRect(tx, y + h - 7, 5, 3); ctx.fillRect(tailRight ? tx + 4 : tx - 1, y + h - 5, 2, 2);
        lines.forEach((l, i) => api.text(ctx, l, x + w / 2, y + 4 + i * 10, 8, '#b02a6a', 'center', false));
      }
      function drawNiklas(o, beat, rot) {
        const { bx, by } = nikPos(o), n = o.nik;
        const top = by + BR - 3, sx = bx - 12;
        // chain from the top of the screen (spinning links)
        for (let yy = -2; yy < by - BR; yy += 3) {
          const alt = (((yy + 3) / 3 | 0) + Math.floor(rot * 6)) % 2;
          ctx.fillStyle = alt ? '#c8c8d4' : '#7a7a88';
          ctx.fillRect(bx - (alt ? 1 : 0), yy, alt ? 3 : 1, 2);
        }
        // light cone below the ball (telegraphs his reach) in disco mode
        if (dk > 0.05) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.06 + 0.08 * dk;
          ctx.fillStyle = LIGHTS[(Math.floor(beat) + n.ph * 3 | 0) % LIGHTS.length];
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - 26, GROUND); ctx.lineTo(bx + 26, GROUND); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        // Niklas hanging with his left arm up, waving with the right
        api.drawChar(ctx, 'niklas', 'idle', sx, top, 2, true);
        ctx.fillStyle = '#93a4b8'; ctx.fillRect(bx - 10, by + BR - 2, 3, top + 18 - (by + BR - 2));
        ctx.fillStyle = '#f0c39c'; ctx.fillRect(bx - 10, by + BR - 3, 3, 3);
        const wave = Math.floor(frameT * 5) % 2;
        ctx.fillStyle = '#93a4b8';
        if (wave) { ctx.fillRect(bx + 8, top + 8, 3, 10); ctx.fillStyle = '#f0c39c'; ctx.fillRect(bx + 8, top + 5, 3, 3); }
        else { ctx.fillRect(bx + 8, top + 15, 7, 3); ctx.fillStyle = '#f0c39c'; ctx.fillRect(bx + 14, top + 12, 3, 3); }
        // the ball
        if (ballRenderedAt !== frameT) { renderBall(rot, beat); ballRenderedAt = frameT; }
        ctx.drawImage(ball, bx - BR, by - BR);
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(bx - 6, by - 7, 2, 2);
        const s = (frameT * 1.7 + n.ph) % 1;
        if (s < 0.3) { const gx = bx + Math.round(Math.cos(n.ph + frameT) * 6), gy = by + Math.round(Math.sin(n.ph * 2 + frameT) * 6); ctx.fillStyle = '#fff'; ctx.fillRect(gx - 2, gy, 5, 1); ctx.fillRect(gx, gy - 2, 1, 5); }
        // speech bubbles (only while he is still ahead of Eva)
        if (state === 'dead' && n.hit) bubble(['Hoppla!'], bx + 14, top + 2, false);
        else if (state === 'play' || state === 'ready') {
          // first line left of him while he is far ahead, second line to his right (never over Eva)
          if (bx > 146 && bx < W + 6) bubble(LINES[n.li], bx - 16 - 64, top - 2, true);
          else if (bx > 86 && bx <= 146) bubble(LINES2[n.li], bx + 14, top + 2, false);
        }
      }

      /* ---------- disco drawing helpers ---------- */
      function beamTri(x, y, ang, len, spread, color, alpha) {
        ctx.globalAlpha = alpha; ctx.fillStyle = color;
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(ang - spread) * len, y + Math.sin(ang - spread) * len);
        ctx.lineTo(x + Math.cos(ang + spread) * len, y + Math.sin(ang + spread) * len);
        ctx.closePath(); ctx.fill();
      }
      function neonRect(x, y, w, h, col, a) {
        ctx.globalAlpha = a; ctx.fillStyle = col;
        ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
        ctx.globalAlpha = a * 0.35; ctx.fillRect(x - 1, y - 1, w + 2, 1); ctx.fillRect(x - 1, y + h, w + 2, 1); ctx.fillRect(x - 1, y, 1, h); ctx.fillRect(x + w, y, 1, h);
        ctx.globalAlpha = 1;
      }
      function discoObstacle(o, bi, pulse, k) {
        const x = Math.round(o.x);
        if (k.mid > 0.02) { // neon outlines
          const c = LIGHTS[(bi + o.seed) % LIGHTS.length], c2 = LIGHTS[(bi + o.seed + 3) % LIGHTS.length], a = k.mid * (0.7 + 0.3 * pulse);
          neonRect(x - 2, o.bot - 4, OB_W + 4, GROUND - o.bot + 4, c, a);
          neonRect(x + 8, -1, 12, Math.max(0, o.top - 30), c2, a);
          neonRect(x - 4, o.top - 31, OB_W + 8, 32, c2, a);
        }
        if (k.full > 0.02) { // dance-floor lights on the trunk and leaf clump
          for (let yy = o.bot + 6, r = 0; yy < GROUND - 4; yy += 12, r++) for (let cc = 0; cc < 2; cc++) {
            const on = hash(o.seed + r * 3 + cc, bi) > 0.4;
            ctx.globalAlpha = k.full * (on ? 0.3 + 0.35 * pulse : 0.08);
            ctx.fillStyle = LIGHTS[(r + cc + bi) % LIGHTS.length];
            ctx.fillRect(x + 2 + cc * 12, yy, 11, 10);
          }
          ctx.globalAlpha = k.full * (0.15 + 0.25 * pulse); ctx.fillStyle = LIGHTS[(bi + o.seed + 1) % LIGHTS.length];
          ctx.fillRect(x - 2, o.top - 28, OB_W + 4, 26);
          ctx.globalAlpha = 1;
        }
      }

      /* ---------- state ---------- */
      let crashes = 0, state = 'ready', y = 140, vy = 0, passed = 0, scroll = 0, obs = [], spawned = 0, nextSpawnAt = 0;
      let toastTimer = 0, deadT = 0, shake = 0, flashT = 0, winT = 0, won = false, frameT = 0, popT = 0;
      let dk = 0, rot = 0, track = 'game';
      const mercy = () => Math.min(MERCY_MAX, Math.floor(crashes / 3));
      const gapSize = () => BASE_GAP + MERCY_STEP * mercy();
      const discoTarget = () => (state === 'won' || passed >= 6) ? 1 : passed >= 3 ? 0.5 : 0;
      function setTrack(name) { if (track !== name) { track = name; api.music(name); } }

      function reset() {
        state = 'ready'; y = 140; vy = 0; passed = 0; obs = []; spawned = 0; nextSpawnAt = scroll + 150; deadT = 0; planned = null;
        setTrack('game');
      }
      let lastGapY = 150, planned = null;
      function nextCenter(g) {
        const minC = 40 + g / 2, maxC = GROUND - 30 - g / 2;
        let c = lastGapY + (Math.random() * 2 - 1) * 60;
        if (spawned === 0) c = 150 + (Math.random() * 2 - 1) * 20;
        c = Math.max(minC, Math.min(maxC, c));
        lastGapY = c;
        return c;
      }
      function spawn() {
        const g = gapSize();
        const c = planned != null ? planned : nextCenter(g);
        planned = null;
        const o = { x: W + 4, top: Math.round(c - g / 2), bot: Math.round(c + g / 2), passed: false, seed: (Math.random() * 97) | 0, nik: null };
        if (NIK_AT.includes(spawned)) {
          // next gap stays close in height so there is time to dip under Niklas
          planned = Math.max(40 + g / 2, Math.min(GROUND - 30 - g / 2, c + (Math.random() * 2 - 1) * 30)); lastGapY = planned;
          // Niklas' bob is centred between this gap and the next one, but never above where Eva can comfortably fly
          o.nik = { c: Math.max(115, (c + planned) / 2), ph: Math.random() * Math.PI * 2, li: NIK_AT.indexOf(spawned) % LINES.length, hit: false };
        }
        obs.push(o);
        spawned++;
      }

      function hitbox() { return { l: EVA_X + 6, r: EVA_X + 19, t: y - 12, b: y + 30 }; }

      function crash() {
        state = 'dead'; deadT = 0; shake = 0.3; flashT = 0.12; crashes++;
        api.sfx('hit');
        if (crashes % 3 === 0 && crashes / 3 <= MERCY_MAX) toastTimer = setTimeout(() => api.toast('Die Lücken werden etwas größer!', 2000), 400);
      }

      function flap() {
        if (state === 'won') return;
        if (state === 'dead') { if (deadT < 0.35) return; reset(); }
        if (state === 'ready') { state = 'play'; nextSpawnAt = scroll + 60; }
        vy = FLAP; popT = 0.12;
        api.sfx('flap');
      }

      /* ---------- input ---------- */
      function onPointer(e) { e.preventDefault(); flap(); }
      function onKey(e) {
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Enter') {
          e.preventDefault(); if (!e.repeat) flap();
        }
      }
      root.addEventListener('pointerdown', onPointer);
      window.addEventListener('keydown', onKey);

      /* ---------- loop ---------- */
      const stop = api.loop((dt, t) => {
        frameT += dt;
        const tgt = discoTarget();
        dk += Math.sign(tgt - dk) * Math.min(Math.abs(tgt - dk), dt * 0.6);
        const k = { mid: Math.min(1, dk * 2), full: Math.max(0, Math.min(1, (dk - 0.5) * 2)) };
        if (state !== 'dead' && passed >= 6) setTrack('disco');
        const beat = beatNow(), bi = Math.floor(beat), pulse = Math.pow(1 - (beat - bi), 2);
        rot += dt * 1.8;

        const moving = state === 'ready' || state === 'play' || state === 'won';
        const spd = moving ? SPEED * (1 + 0.14 * k.full) : 0;
        scroll += spd * dt;

        if (state === 'ready') {
          y = 140 + Math.sin(frameT * 3) * 4;
        } else if (state === 'play' || state === 'won') {
          vy = Math.min(MAXFALL, vy + GRAV * dt);
          y += vy * dt;
          if (y < 14) { y = 14; if (vy < 0) vy = 0; } // ceiling: clamp only
          if (state === 'won') {
            if (y > 150 && vy > 0) vy = FLAP * 0.7;
            winT += dt;
          }
          if (state === 'play' && spawned < GOAL && scroll >= nextSpawnAt) { spawn(); nextSpawnAt = scroll + SPACING + (obs[obs.length - 1].nik ? NIK_EXTRA : 0); }
          obs.forEach(o => { o.x -= spd * dt; });
          obs = obs.filter(o => o.x > -OB_W - 10 - (o.nik ? NIK_OFF + 20 : 0));
          if (state === 'play') {
            const hb = hitbox();
            for (const o of obs) {
              if (hb.r > o.x + 1 && hb.l < o.x + OB_W - 1 && (hb.t < o.top - 2 || hb.b > o.bot)) { crash(); break; }
              if (o.nik && nikHit(o, hb)) { o.nik.hit = true; crash(); break; }
              if (!o.passed && o.x + OB_W < hb.l) {
                o.passed = true; passed++; api.sfx('coin');
                if (passed === 3) api.toast('Es wird Abend… Disko-Licht!', 1600);
                if (passed === 6) api.toast('Disko-Fieber!', 1600);
                if (passed >= GOAL) { state = 'won'; winT = 0; if (!won) { won = true; api.win(); } break; }
              }
            }
            if (state === 'play' && y + 32 >= GROUND) { y = GROUND - 32; crash(); }
          }
        } else if (state === 'dead') {
          deadT += dt;
          vy = Math.min(260, vy + GRAV * 1.3 * dt);
          y = Math.min(GROUND - 32, y + vy * dt);
        }
        shake = Math.max(0, shake - dt); flashT = Math.max(0, flashT - dt); popT = Math.max(0, popT - dt);

        // leaves
        leaves.forEach(l => {
          l.y += l.vy * dt; l.x += (Math.sin(frameT * 1.5 + l.ph) * 8 - spd * (l.far ? 0.3 : 0.8)) * dt;
          if (l.y > GROUND) { l.y = -4; l.x = Math.random() * (W + 40); }
          if (l.x < -4) l.x += W + 8;
        });

        /* ---------- draw ---------- */
        ctx.save();
        if (shake > 0) ctx.translate(Math.round((Math.random() * 2 - 1) * 3), Math.round((Math.random() * 2 - 1) * 2));
        ctx.drawImage(sky, 0, 0);
        tile(far, scroll * 0.15, 0);
        leaves.forEach(l => { if (l.far) { ctx.fillStyle = l.c; ctx.fillRect(Math.round(l.x), Math.round(l.y), 2, 1); } });
        tile(mid, scroll * 0.45, 0);
        // dusk -> night
        ctx.globalAlpha = 0.1 + 0.4 * k.mid; ctx.fillStyle = '#4a1f5a'; ctx.fillRect(0, 0, W, GROUND);
        ctx.globalAlpha = 0.6 * k.full; ctx.fillStyle = '#0a0614'; ctx.fillRect(0, 0, W, GROUND);
        ctx.globalAlpha = 1;
        // sweeping light beams
        if (k.mid > 0) {
          ctx.globalCompositeOperation = 'lighter';
          const a = (0.07 + 0.05 * k.full * pulse) * k.mid;
          beamTri(2, 0, Math.PI * 0.3 + Math.sin(frameT * 0.9) * 0.45, 380, 0.08, LIGHTS[bi % 6], a);
          beamTri(W - 2, 0, Math.PI * 0.7 + Math.sin(frameT * 1.1 + 1) * 0.45, 380, 0.08, LIGHTS[(bi + 3) % 6], a);
          if (k.full > 0) beamTri(W / 2, 0, Math.PI / 2 + Math.sin(frameT * 1.6) * 0.8, 380, 0.05, LIGHTS[(bi + 1) % 6], a * k.full);
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        }
        obs.forEach(o => { drawBranch(Math.round(o.x), o.top, o.seed); drawTrunk(Math.round(o.x), o.bot); discoObstacle(o, bi, pulse, k); });
        tile(canopy, scroll * 0.6, -4);
        tile(ground, scroll, GROUND);
        if (k.mid > 0) {
          ctx.globalAlpha = 0.45 * k.mid; ctx.fillStyle = '#1a0c26'; ctx.fillRect(0, 0, W, 58); ctx.fillRect(0, GROUND, W, H - GROUND);
          ctx.globalAlpha = 1;
        }
        if (k.full > 0) { // dance floor on the forest ground
          const off = Math.floor(scroll) % 12;
          for (let gx = -off, c = Math.floor(scroll / 12); gx < W; gx += 12, c++) for (let r = 0; r < 3; r++) {
            const on = (c + r + bi) % 2 === 0;
            ctx.globalAlpha = k.full * (on ? 0.35 + 0.45 * pulse : 0.1);
            ctx.fillStyle = LIGHTS[((c + r * 2 + bi) % 6 + 6) % 6];
            ctx.fillRect(gx + 1, GROUND + 2 + r * 8, 10, 7);
          }
          ctx.globalAlpha = 1;
        }
        // reflection dots from the disco balls
        if (k.mid > 0) {
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < DOTS.length; i++) {
            const d = DOTS[i];
            const xx = W + 10 - (((d.a + rot * 0.06 * d.sp) % 1) * (W + 20));
            ctx.globalAlpha = k.mid * (0.45 + 0.35 * Math.sin(frameT * 6 + i));
            ctx.fillStyle = d.c < 0 ? '#ffffff' : LIGHTS[d.c];
            ctx.fillRect(xx | 0, d.y | 0, d.s + 1, d.s);
          }
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        }
        obs.forEach(o => { if (o.nik) drawNiklas(o, beat, rot); });

        drawFlyer(EVA_X, Math.round(y), frameT, state === 'dead' ? 'idle' : 'jump');
        if (popT > 0) {
          ctx.fillStyle = 'rgba(255,255,255,.7)';
          ctx.fillRect(EVA_X + 6, Math.round(y) + 34, 3, 2); ctx.fillRect(EVA_X + 14, Math.round(y) + 35, 3, 2);
        }
        leaves.forEach(l => {
          if (l.far) return;
          ctx.fillStyle = l.c; const lx = Math.round(l.x), ly = Math.round(l.y);
          ctx.fillRect(lx, ly, 3, 2); if (Math.sin(frameT * 4 + l.ph) > 0) ctx.fillRect(lx + 1, ly + 2, 1, 1);
        });
        ctx.restore();

        // beat pulse in full disco
        if (k.full > 0) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = k.full * pulse * 0.09; ctx.fillStyle = LIGHTS[bi % 6]; ctx.fillRect(0, 0, W, H);
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        }
        if (flashT > 0) { ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(0, 0, W, H); }

        // HUD
        if (state === 'won') {
          const p = 1 + Math.round(Math.sin(winT * 6));
          api.text(ctx, GOAL + '/' + GOAL, W / 2, 110 - p, 32, LIGHTS[bi % 6], 'center');
          api.text(ctx, 'Geschafft!', W / 2, 152, 16, '#ffffff', 'center');
        } else {
          api.text(ctx, passed + '/' + GOAL, W / 2, 14, 16, k.full > 0.5 ? LIGHTS[bi % 6] : '#ffffff', 'center');
        }
        if (state === 'ready') {
          ctx.fillStyle = 'rgba(13,21,17,.55)'; ctx.fillRect(14, 222, W - 28, 22);
          api.text(ctx, 'Tippen zum', W / 2, 225, 8, '#f6e7c8', 'center');
          api.text(ctx, 'Fliegen', W / 2, 235, 8, '#f6e7c8', 'center');
        } else if (state === 'dead' && deadT > 0.35) {
          ctx.fillStyle = 'rgba(13,21,17,.6)'; ctx.fillRect(14, 120, W - 28, 34);
          api.text(ctx, 'Autsch!', W / 2, 124, 8, '#f5c542', 'center');
          if (Math.floor(deadT * 2.5) % 2 === 0) api.text(ctx, 'Tippen = nochmal', W / 2, 140, 8, '#f6e7c8', 'center');
        }
      });

      api.music('game');
      reset();

      return function cleanup() {
        stop(); clearTimeout(toastTimer);
        root.removeEventListener('pointerdown', onPointer);
        window.removeEventListener('keydown', onKey);
        cv.destroy();
      };
    }
  };
})();

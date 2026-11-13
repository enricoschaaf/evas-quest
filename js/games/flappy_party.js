/* Disko-Sturm – merged balloon flight (Disko + Foto + Sturm): Eva floats through a night club between speaker towers and
   light rigs. Niklas swings on a disco ball, friends dance on floating podiums (photo subjects), BASS-DROP gusts push her
   around, glow sticks fall from the rigs. Win = 7 gaps AND 4 photos, then a short photo album. */
(function () {
  'use strict';

  GAMES['flappy_party'] = {
    title: 'Disko-Sturm',
    intro: 'Tippe zum Fliegen und flieg durch 7 Lücken. Tanzt jemand im Sucher vor Eva? Drück 📸 (oder F) – du brauchst 4 Fotos! Bei BASS-DROP! gegensteuern.',
    start(root, api) {
      const W = 180, H = 320, GROUND = 296, GOAL = 7, PGOAL = 4, HUD_H = 36;
      const cv = api.makeCanvas(root, W, H);
      const ctx = cv.ctx;
      const E = window.Engine;
      api.music('disco');

      /* ---------- tuning (gentle, a bit spicy later) ---------- */
      const GRAV = 400, FLAP = -150, MAXFALL = 190, SPEED = 58, SPACING = 130, OB_W = 28;
      const BASE_GAP = 120, MERCY_STEP = 12, MERCY_MAX = 3, STORM_NARROW = 8, ENC_GAP = 140, HAZ_G = 260, HAZ_V = 95;
      const EVA_X = 46; // left of Eva sprite (scale 2 => 24x32)
      const LIGHTS = ['#ff3fa4', '#3fe0ff', '#ffe23f', '#7cff4f', '#b45cff', '#ff8a2a'];
      const LRGB = LIGHTS.map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
      const NIK_AT = [2, 5];                 // Niklas swings in the lane after gap 3 and 6
      const NIK_EXTRA = 60;                  // lanes with Niklas are wider
      const NIK_OFF = OB_W + (SPACING + NIK_EXTRA - OB_W) / 2;
      const NIK_W = 2.0;                     // bob speed (rad/s)
      const LINES = [['Hallo', 'Schatz!'], ['Tanzen', 'wir?']];
      const LINES2 = [['Duck', 'dich!'], ['Huiii!']];
      const FRIENDS = ['magnus', 'laurenz', 'hannah', 'enrico'];
      const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

      /* ---------- beat clock: audio clock of the playing track, else wall clock @120bpm ---------- */
      const t0 = performance.now();
      function beatNow() {
        const b = E && E.Audio && E.Audio.beat ? E.Audio.beat() : null;
        if (b != null) return Math.max(0, b);
        return (performance.now() - t0) / 500;
      }
      const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };

      function layer(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; draw(g); return c; }
      function rnd(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

      /* ---------- rotating disco balls (rendered per pixel) ---------- */
      function makeBall(R) {
        const D = R * 2 + 1, c = document.createElement('canvas'); c.width = D; c.height = D;
        const g = c.getContext('2d'), img = g.createImageData(D, D), px = [];
        const rows = R >= 16 ? 10 : 6;
        for (let yy = 0; yy < D; yy++) for (let xx = 0; xx < D; xx++) {
          const nx = (xx - R) / R, ny = (yy - R) / R, d = nx * nx + ny * ny;
          if (d > 1) continue;
          const nz = Math.sqrt(1 - d), lat = Math.asin(ny), lon = Math.atan2(nx, nz);
          const light = 0.35 + 0.65 * Math.max(0, -nx * 0.45 - ny * 0.55 + nz * 0.7);
          px.push({ i: (yy * D + xx) * 4, latf: (lat / Math.PI + 0.5) * rows, lon, cosl: Math.cos(lat), light, edge: d > 0.8 });
        }
        let at = -1;
        return {
          c, R,
          render(rot, beat, stamp) {
            if (at === stamp) return; at = stamp;
            const d = img.data, tint = LRGB[Math.floor(beat) % LRGB.length];
            for (let k = 0; k < px.length; k++) {
              const p = px[k];
              const fi = Math.floor(p.latf), fr = p.latf - fi;
              const ncols = Math.max(4, Math.round(rows * p.cosl) * 2);
              const lf = ((p.lon + rot) / (Math.PI * 2)) * ncols;
              const fj = Math.floor(lf), fc = lf - fj, jj = ((fj % ncols) + ncols) % ncols;
              const grout = fr < 0.14 || fc < 0.14 / Math.max(0.3, p.cosl);
              const h = hash(fi, jj);
              const v = (0.45 + h * 0.55) * p.light * 255;
              let r = v, gg = v, b = v * 1.06;
              if (h > 0.68) { r = r * 0.5 + tint[0] * 0.5 * p.light; gg = gg * 0.5 + tint[1] * 0.5 * p.light; b = b * 0.5 + tint[2] * 0.5 * p.light; }
              if (((h * 97 + beat * 0.5) % 1) < 0.05) { r = gg = b = 255; }
              if (grout) { r *= 0.4; gg *= 0.4; b *= 0.45; }
              if (p.edge) { r *= 0.7; gg *= 0.7; b *= 0.8; }
              d[p.i] = r > 255 ? 255 : r; d[p.i + 1] = gg > 255 ? 255 : gg; d[p.i + 2] = b > 255 ? 255 : b; d[p.i + 3] = 255;
            }
            g.putImageData(img, 0, 0);
          }
        };
      }
      const BR = 11;
      const nikBall = makeBall(BR), bigBall = makeBall(17), subBall = makeBall(8);
      const BIG_X = 140, BIG_Y = 62;

      /* ---------- small pixel painters (also used for thumbnails) ---------- */
      function paintBall(g, cx, cy, r) {
        for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) {
          if (xx * xx + yy * yy > r * r + r * 0.6) continue;
          const chk = (((xx + 20) >> 1) + ((yy + 20) >> 1)) % 2, shade = (xx + yy) / (2 * r);
          g.fillStyle = chk ? (shade > 0.3 ? '#6a6a84' : '#c4c4d8') : (shade > 0.3 ? '#4a4a60' : '#8a8aa4');
          g.fillRect(cx + xx, cy + yy, 1, 1);
        }
        g.fillStyle = '#ffffff'; g.fillRect(cx - Math.ceil(r / 2), cy - Math.ceil(r / 2), 1, 1);
      }
      // confetti cannon, 13x11 units; muzzle at unit (11, 1)
      function paintCannon(g, x, y, s) {
        const R = (a, b, w, h, c) => { g.fillStyle = c; g.fillRect(x + a * s, y + b * s, w * s, h * s); };
        for (let i = 0; i < 4; i++) R(2 + i * 2, 7 - i * 2, 3, 3, i % 2 ? '#ffe23f' : '#ff3fa4');
        R(3 + 0, 9, 1, 1, '#c02478'); R(5, 7, 1, 1, '#c9a52a'); R(7, 5, 1, 1, '#c02478'); R(9, 3, 1, 1, '#c9a52a');
        R(10, 0, 3, 3, '#f6f1e4'); R(11, 1, 1, 1, '#2a1a3a');
        R(0, 8, 8, 3, '#3a2f52'); R(0, 8, 8, 1, '#5a4a7a');
        R(1, 10, 2, 1, '#8a8aa4'); R(5, 10, 2, 1, '#8a8aa4');
      }
      function disc(cx, cy, r, col) {
        ctx.fillStyle = col;
        for (let dy = -r; dy <= r; dy++) { const hw = Math.round(Math.sqrt(r * r - dy * dy)); ctx.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1); }
      }

      /* ---------- pre-rendered parallax layers ---------- */
      const sky = layer(W, H, g => {
        const bands = ['#07040d', '#0a0514', '#0e071c', '#130924', '#190b2d', '#200d37', '#291042'];
        const bh = Math.ceil(GROUND / bands.length);
        bands.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * bh, W, bh); });
        const r = rnd(3);
        for (let i = 0; i < 30; i++) { g.fillStyle = r() < 0.7 ? '#3a2a5a' : '#6a5a8a'; g.fillRect(Math.floor(r() * W), Math.floor(r() * 150), 1, 1); }
      });
      const cityW = 240;
      const city = layer(cityW, GROUND, g => {
        const r = rnd(7); let x = 0;
        while (x < cityW) {
          let bw = 14 + Math.floor(r() * 20); if (x + bw > cityW) bw = cityW - x;
          const top = 170 + Math.floor(r() * 60);
          g.fillStyle = '#140b22'; g.fillRect(x, top, bw, GROUND - top);
          g.fillStyle = '#1c1130'; g.fillRect(x, top, 2, GROUND - top);
          for (let wy = top + 5; wy < GROUND - 24; wy += 7) for (let wx = x + 4; wx < x + bw - 3; wx += 5) {
            const v = r(); if (v < 0.55) continue;
            if (v > 0.9) { g.globalAlpha = 0.5; g.fillStyle = LIGHTS[Math.floor(r() * 6)]; } else g.fillStyle = '#271a40';
            g.fillRect(wx, wy, 2, 3); g.globalAlpha = 1;
          }
          if (r() < 0.3 && bw > 6) { g.fillStyle = '#140b22'; g.fillRect(x + (bw >> 1), top - 8, 1, 8); g.fillStyle = '#ff3f6a'; g.fillRect(x + (bw >> 1), top - 9, 1, 1); }
          x += bw + Math.floor(r() * 4);
        }
      });
      const crowdW = 300;
      const crowd = layer(crowdW, 44, g => {
        const r = rnd(42);
        const put = (x, yy, w, h) => { g.fillRect(x, yy, w, h); g.fillRect(x - crowdW, yy, w, h); };
        for (let pass = 0; pass < 2; pass++) {
          g.fillStyle = pass ? '#07040c' : '#0e0818';
          for (let x = pass * 4; x < crowdW; x += 8 + Math.floor(r() * 5)) {
            const hgt = (pass ? 16 : 24) + Math.floor(r() * 9);
            put(x, 44 - hgt + 6, 9, hgt); put(x + 2, 44 - hgt, 5, 7); put(x + 1, 44 - hgt + 1, 7, 4);
            if (r() < 0.4) { const side = r() < 0.5; put(side ? x - 2 : x + 9, 44 - hgt - 7, 2, 13); put(side ? x - 3 : x + 9, 44 - hgt - 9, 3, 3); }
          }
        }
      });
      function tile(img, off, yy) {
        const iw = img.width; let x = -(((off % iw) + iw) % iw);
        for (; x < W; x += iw) ctx.drawImage(img, Math.floor(x), yy);
      }

      /* ---------- reflection dots + confetti particles ---------- */
      const DOTS = [];
      for (let i = 0; i < 40; i++) DOTS.push({ a: Math.random(), y: HUD_H + Math.random() * (GROUND - HUD_H), sp: 0.6 + Math.random() * 0.8, c: Math.random() < 0.5 ? -1 : (Math.random() * LIGHTS.length | 0), s: Math.random() < 0.25 ? 2 : 1 });
      let confetti = [];
      function burst(x, yy, n, vx0, vx1, vy0, vy1) {
        for (let i = 0; i < n && confetti.length < 160; i++) confetti.push({ x, y: yy, vx: vx0 + Math.random() * (vx1 - vx0), vy: vy0 + Math.random() * (vy1 - vy0), c: LIGHTS[(Math.random() * 6) | 0], life: 1 + Math.random() * 0.6, ph: Math.random() * 6 });
      }

      /* ---------- balloons (disco colours, soft glow on the beat) ---------- */
      const BAL = ['.ccc.', 'cwccc', 'cwccc', 'ccccc', 'ccccc', '.ccc.', '..d..'];
      const BCOL = [{ c: '#ff3fa4', d: '#c02478' }, { c: '#3fe0ff', d: '#1f9ec0' }, { c: '#ffe23f', d: '#c9a52a' }, { c: '#7cff4f', d: '#4ab82a' }, { c: '#b45cff', d: '#7a34c0' }];
      const BPOS = [[-14, -40], [-2, -46], [8, -38], [-8, -30], [4, -28]];
      function drawFlyer(ex, ey, t, frame, pulse) {
        const hx = ex + 17, hy = ey + 16;
        const wob = i => [Math.round(Math.sin(t * 2.6 + i * 1.7) * 1.5), Math.round(Math.sin(t * 3.3 + i) * 1.2)];
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        BPOS.forEach((p, i) => { const [wx, wy] = wob(i); ctx.globalAlpha = 0.07 + 0.13 * pulse; disc(hx + p[0] + wx + 5, hy + p[1] + wy + 6, 8, BCOL[i].c); });
        ctx.restore();
        BPOS.forEach((p, i) => {
          const [wx, wy] = wob(i), bx = hx + p[0] + wx, by = hy + p[1] + wy, kx = bx + 5, ky = by + 14;
          ctx.fillStyle = '#e9e1d0';
          const steps = Math.max(Math.abs(kx - hx), Math.abs(ky - hy));
          for (let s = 0; s <= steps; s++) ctx.fillRect(Math.round(kx + (hx - kx) * s / steps), Math.round(ky + (hy - ky) * s / steps), 1, 1);
        });
        BPOS.forEach((p, i) => { const [wx, wy] = wob(i); api.drawPixels(ctx, BAL, { c: BCOL[i].c, d: BCOL[i].d, w: '#ffffff' }, hx + p[0] + wx, hy + p[1] + wy, 2); });
        api.drawChar(ctx, 'eva', frame, ex, ey, 2, false);
      }

      /* ---------- obstacles: speaker towers (bottom) + light rigs (top). No outlines – shading only. ---------- */
      function drawSpeakerTower(x, top, o, pump, bi, warnFlash) {
        const CH = 30;
        for (let yy = top, i = 0; yy < GROUND; yy += CH, i++) {
          const h = Math.min(CH, GROUND - yy);
          ctx.fillStyle = '#272036'; ctx.fillRect(x, yy, OB_W, h);
          ctx.fillStyle = '#383049'; ctx.fillRect(x, yy, 3, h);              // lit left side
          ctx.fillStyle = '#1a1524'; ctx.fillRect(x + OB_W - 3, yy, 3, h);   // shaded right side
          ctx.fillStyle = '#100d16'; ctx.fillRect(x + 1, yy + h - 1, OB_W - 2, 1); // seam to next cabinet
          if (i === 0) { ctx.fillStyle = '#433a57'; ctx.fillRect(x, yy, OB_W, 2); }
          // horn tweeter
          ctx.fillStyle = '#110e18'; ctx.fillRect(x + 8, yy + 4, 12, 4);
          ctx.fillStyle = '#2c2638'; ctx.fillRect(x + 10, yy + 5, 8, 2);
          ctx.fillStyle = '#4a4360'; ctx.fillRect(x + 13, yy + 5, 2, 1);
          // woofer
          const cx = x + 14, cy = yy + 18, push = pump > 0.55 ? 1 : 0;
          disc(cx, cy, 9, '#3a3349');
          disc(cx, cy, 8, '#0f0c15');
          disc(cx, cy, 7, '#221d2c');
          disc(cx - 1, cy - 1, 5, '#2a2436');
          disc(cx, cy, 4 - push, '#1d1926');
          disc(cx, cy, 2 + push, '#3d3650');
          ctx.fillStyle = '#7a7092'; ctx.fillRect(cx - 2, cy - 2, 2, 1);
          // light spilling out of the cone on the beat
          const glow = Math.max(pump * 0.8, warnFlash);
          if (glow > 0.05) {
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const col = warnFlash > 0.05 ? '#ff4a6a' : LIGHTS[(bi + o.seed + i) % 6];
            ctx.globalAlpha = 0.12 * glow; disc(cx, cy, 8, col);
            ctx.globalAlpha = 0.22 * glow; disc(cx, cy, 5, col);
            ctx.globalAlpha = 0.3 * glow; disc(cx, cy, 2, '#ffffff');
            ctx.restore();
          }
          // LED strip on the front face
          if (h > 28) for (let k = 0; k < 6; k++) {
            const on = (k + bi + i) % 3 === 0;
            ctx.globalAlpha = on ? 1 : 0.25; ctx.fillStyle = LIGHTS[(k + bi) % 6];
            ctx.fillRect(x + 5 + k * 3 + (k > 2 ? 1 : 0), yy + h - 3, 2, 1);
          }
          ctx.globalAlpha = 1;
        }
      }
      function drawRig(x, bottom, o, bi, k, pulse) {
        const trussB = bottom - 15;
        if (trussB > 0) {
          ctx.fillStyle = '#56566a'; ctx.fillRect(x + 3, 0, 2, trussB); ctx.fillRect(x + 23, 0, 2, trussB);
          ctx.fillStyle = '#a4a4b8'; ctx.fillRect(x + 3, 0, 1, trussB); ctx.fillRect(x + 23, 0, 1, trussB);
          ctx.fillStyle = '#6e6e84';
          for (let yy = (trussB % 16) - 16; yy < trussB; yy += 16) for (let s = 0; s < 18; s++) {
            const a = yy + Math.round(s * 8 / 17), b = yy + 8 + Math.round(s * 8 / 17);
            if (a >= 0 && a < trussB) ctx.fillRect(x + 5 + s, a, 1, 1);
            if (b >= 0 && b < trussB) ctx.fillRect(x + 22 - s, b, 1, 1);
          }
        }
        // horizontal truss bar
        ctx.fillStyle = '#8e8ea4'; ctx.fillRect(x - 1, trussB, OB_W + 2, 2);
        ctx.fillStyle = '#c0c0d2'; ctx.fillRect(x - 1, trussB, OB_W + 2, 1);
        ctx.fillStyle = '#4c4c5e'; ctx.fillRect(x - 1, trussB + 5, OB_W + 2, 1);
        ctx.fillStyle = '#66667a'; for (let j = 0; j < OB_W + 2; j += 4) ctx.fillRect(x - 1 + j, trussB + 2, 1, 3);
        for (let j = 0; j < 6; j++) { const on = (j + bi) % 3 === 0; ctx.globalAlpha = on ? 1 : 0.3; ctx.fillStyle = LIGHTS[(j + o.seed) % 6]; ctx.fillRect(x + 2 + j * 4, trussB + 3, 2, 1); }
        ctx.globalAlpha = 1;
        // two moving-head spots hanging below
        for (let s = 0; s < 2; s++) {
          const sx = x + 2 + s * 16, sy = trussB + 6, col = LIGHTS[(bi + s * 2 + o.seed) % 6];
          ctx.fillStyle = '#3a3948'; ctx.fillRect(sx + 1, sy, 6, 2); ctx.fillRect(sx, sy + 1, 1, 5); ctx.fillRect(sx + 7, sy + 1, 1, 5);
          ctx.fillStyle = '#25242f'; ctx.fillRect(sx + 1, sy + 2, 6, 5);
          ctx.fillStyle = '#3e3d4e'; ctx.fillRect(sx + 1, sy + 2, 2, 4);
          ctx.fillStyle = col; ctx.fillRect(sx + 1, sy + 7, 6, 2);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(sx + 3, sy + 7, 2, 1);
          // soft light cone from the lens
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          const ang = Math.PI / 2 + Math.sin(frameT * 1.3 + s * 2 + o.seed) * 0.35;
          beamTri(sx + 4, sy + 9, ang, 80, 0.13, col, (0.05 + 0.05 * pulse) * (0.5 + 0.5 * k));
          ctx.restore();
        }
      }
      function beamTri(x, yy, ang, len, spread, color, alpha) {
        ctx.globalAlpha = alpha; ctx.fillStyle = color;
        ctx.beginPath(); ctx.moveTo(x, yy);
        ctx.lineTo(x + Math.cos(ang - spread) * len, yy + Math.sin(ang - spread) * len);
        ctx.lineTo(x + Math.cos(ang + spread) * len, yy + Math.sin(ang + spread) * len);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
      }

      /* ---------- Niklas on the disco ball ---------- */
      function nikPos(o) {
        const n = o.nik, m = mercy();
        const hi = n.c - 75, lo = n.c + 5 - 8 * m;           // bottom of his feet: highest / lowest
        const mid = (hi + lo) / 2, amp = (lo - hi) / 2;
        const bottom = mid + amp * Math.sin(frameT * NIK_W * (1 - 0.08 * m) + n.ph);
        return { bx: Math.round(o.x + NIK_OFF), by: Math.round(bottom - BR - 29) };
      }
      function nikHit(o, hb) {
        const { bx, by } = nikPos(o);
        if (hb.r < bx - 13 || hb.l > bx + 13) return false;
        if (hb.r > bx - 1 && hb.l < bx + 2 && hb.t < by - BR) return true; // chain
        const cx = Math.max(hb.l, Math.min(bx, hb.r)), cy = Math.max(hb.t, Math.min(by, hb.b));
        if ((cx - bx) * (cx - bx) + (cy - by) * (cy - by) < (BR - 1) * (BR - 1)) return true;
        return hb.r > bx - 7 && hb.l < bx + 7 && hb.b > by + BR && hb.t < by + BR + 27;
      }
      function bubble(lines, x, yy, tailRight) {
        const w = Math.max(...lines.map(l => l.length)) * 8 + 8, h = lines.length * 10 + 6;
        x = Math.max(2, Math.min(W - w - 2, Math.round(x))); yy = Math.max(HUD_H + 2, Math.round(yy));
        ctx.fillStyle = '#1b1426'; ctx.fillRect(x - 1, yy, w + 2, h); ctx.fillRect(x, yy - 1, w, h + 2);
        ctx.fillStyle = '#fff8ec'; ctx.fillRect(x, yy, w, h);
        const tx = tailRight ? x + w - 1 : x - 4;
        ctx.fillRect(tx, yy + h - 7, 5, 3); ctx.fillRect(tailRight ? tx + 4 : tx - 1, yy + h - 5, 2, 2);
        lines.forEach((l, i) => api.text(ctx, l, x + w / 2, yy + 4 + i * 10, 8, '#b02a6a', 'center', false));
      }
      function drawNiklas(o, beat, rot, k) {
        const { bx, by } = nikPos(o), n = o.nik;
        const top = by + BR - 3, sx = bx - 12;
        for (let yy = -2; yy < by - BR; yy += 3) {
          const alt = (((yy + 3) / 3 | 0) + Math.floor(rot * 6)) % 2;
          ctx.fillStyle = alt ? '#c8c8d4' : '#7a7a88';
          ctx.fillRect(bx - (alt ? 1 : 0), yy, alt ? 3 : 1, 2);
        }
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.05 + 0.06 * k;
        ctx.fillStyle = LIGHTS[(Math.floor(beat) + n.ph * 3 | 0) % LIGHTS.length];
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - 26, GROUND); ctx.lineTo(bx + 26, GROUND); ctx.closePath(); ctx.fill();
        ctx.restore();
        api.drawChar(ctx, 'niklas', 'idle', sx, top, 2, true);
        ctx.fillStyle = '#93a4b8'; ctx.fillRect(bx - 10, by + BR - 2, 3, top + 18 - (by + BR - 2));
        ctx.fillStyle = '#f0c39c'; ctx.fillRect(bx - 10, by + BR - 3, 3, 3);
        const wave = Math.floor(frameT * 5) % 2;
        ctx.fillStyle = '#93a4b8';
        if (wave) { ctx.fillRect(bx + 8, top + 8, 3, 10); ctx.fillStyle = '#f0c39c'; ctx.fillRect(bx + 8, top + 5, 3, 3); }
        else { ctx.fillRect(bx + 8, top + 15, 7, 3); ctx.fillStyle = '#f0c39c'; ctx.fillRect(bx + 14, top + 12, 3, 3); }
        nikBall.render(rot, beat, frameT);
        ctx.drawImage(nikBall.c, bx - BR, by - BR);
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(bx - 6, by - 7, 2, 2);
        if (state === 'dead' && n.hit) bubble(['Hoppla!'], bx + 14, top + 2, false);
        else if (state === 'play' || state === 'ready') {
          if (bx > 150 && bx < W + 6) bubble(LINES[n.li % LINES.length], bx - 16 - 64, top - 2, true);
          else if (bx > 92 && bx <= 150) bubble(LINES2[n.li % LINES2.length], bx + 14, top + 2, false);
        }
      }

      /* ---------- photo subjects (friends on podiums, sparkly ball, confetti cannon) ---------- */
      const subY = s => s.y + Math.round(Math.sin(frameT * 2 + s.ph) * 2);
      function drawPodium(cx, top, bi) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let dy = 0; dy < 6; dy++) { ctx.globalAlpha = 0.16 - dy * 0.02; ctx.fillStyle = LIGHTS[bi % 6]; const hw = 12 - dy * 2; ctx.fillRect(cx - hw, top + 7 + dy, hw * 2, 1); }
        ctx.restore();
        ctx.fillStyle = '#4a3d66'; ctx.fillRect(cx - 11, top, 22, 1);
        ctx.fillStyle = '#3a2f52'; ctx.fillRect(cx - 13, top + 1, 26, 2);
        ctx.fillStyle = '#241c36'; ctx.fillRect(cx - 13, top + 3, 26, 3);
        ctx.fillStyle = '#1a1428'; ctx.fillRect(cx - 11, top + 6, 22, 1);
        for (let j = 0; j < 6; j++) { ctx.globalAlpha = (j + bi) % 2 ? 1 : 0.3; ctx.fillStyle = LIGHTS[(j + bi) % 6]; ctx.fillRect(cx - 11 + j * 4, top + 4, 2, 1); }
        ctx.globalAlpha = 1;
      }
      function drawSubject(s, bi, beat, rot) {
        const sx = Math.round(s.x), sy = subY(s);
        if (FRIENDS.includes(s.kind)) {
          drawPodium(sx, sy + 16, bi);
          const fr = ['run1', 'idle', 'run2', 'jump'][bi % 4], hop = fr === 'jump' ? 2 : 0;
          api.drawChar(ctx, s.kind, fr, sx - 12, sy - 16 - hop, 2, Math.floor(beat / 2) % 2 === 0);
        } else if (s.kind === 'ball') {
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.08; disc(sx, sy, 13, LIGHTS[bi % 6]); ctx.restore();
          ctx.fillStyle = '#8a8aa0'; ctx.fillRect(sx, sy - 14, 1, 5);
          subBall.render(-rot * 1.4, beat, frameT);
          ctx.drawImage(subBall.c, sx - 8, sy - 8);
          for (let j = 0; j < 3; j++) {
            const a = frameT * 1.6 + j * 2.1, gx = sx + Math.round(Math.cos(a) * 14), gy = sy + Math.round(Math.sin(a) * 11);
            if ((Math.floor(frameT * 6) + j) % 3 === 0) continue;
            ctx.fillStyle = j === 1 ? '#ffe23f' : '#ffffff'; ctx.fillRect(gx - 2, gy, 5, 1); ctx.fillRect(gx, gy - 2, 1, 5);
          }
        } else {
          drawPodium(sx, sy + 11, bi);
          paintCannon(ctx, sx - 13, sy - 11, 2);
        }
      }

      /* ---------- thumbnails for the photo strip / album ---------- */
      const thumbCache = {};
      function thumb(kind) {
        if (thumbCache[kind]) return thumbCache[kind];
        let c;
        if (FRIENDS.includes(kind)) c = layer(12, 16, g => api.drawChar(g, kind, 'run1', 0, 0, 1, false));
        else if (kind === 'niklas') c = layer(12, 24, g => { g.fillStyle = '#8a8aa0'; g.fillRect(6, 0, 1, 1); paintBall(g, 6, 4, 3); api.drawChar(g, 'niklas', 'idle', 0, 8, 1, true); });
        else if (kind === 'ball') c = layer(11, 11, g => paintBall(g, 5, 5, 5));
        else c = layer(13, 11, g => paintCannon(g, 0, 0, 1));
        return (thumbCache[kind] = c);
      }
      const CAPS = {
        magnus: ['Magnus legt eine Sohle hin!', 'Magnus im Disko-Fieber', 'Magnus, leicht verwackelt'],
        laurenz: ['Laurenz, König der Tanzfläche', 'Laurenz groovt', 'Laurenz – nur Locken im Bild'],
        hannah: ['Hannah strahlt heller als die Kugel', 'Hannah tanzt', 'Hannah, halb im Bild'],
        enrico: ['Enrico mit Mega-Moves', 'Enrico am Grooven', 'Enrico, ziemlich verwackelt'],
        niklas: ['Niklas: „Hallo Schatz!“', 'Niklas schaukelt vorbei', 'Niklas, viel zu schnell'],
        ball: ['Die Glitzer-Kugel funkelt!', 'Glitzer, Glitzer!', 'Kugel mit Wackel-Effekt'],
        cannon: ['Konfetti-Kanone: BUMM!', 'Konfetti im Anflug', 'Nur Konfetti, kein Motiv']
      };

      /* ---------- state ---------- */
      let crashes = 0, state = 'ready', y = 140, vy = 0, passed = 0, scroll = 0, obs = [], subs = [], hazards = [];
      let spawned = 0, nextSpawnAt = 0, gapsDone = false, lastGapY = 150, planned = null;
      let toastTimer = 0, deadT = 0, shake = 0, flashT = 0, winT = 0, won = false, frameT = 0, popT = 0, playT = 0;
      let photos = [], flying = [], pops = [], shotCD = 0, albumEl = null, albumT = 0;
      let gust = { phase: 'none', t: 0, dir: -1, next: 0, n: 0 }, nextHazard = 2.5, banner = { lines: [], sub: '', t: 0 }, stageShown = 0, dk = 0.4, rot = 0;
      const mercy = () => Math.min(MERCY_MAX, Math.floor(crashes / 2));
      const stageOf = n => n < 2 ? 1 : n < 5 ? 2 : 3;
      const stage = () => gapsDone ? 3 : stageOf(passed);
      const stageKey = () => gapsDone ? 4 : stageOf(passed);
      const gustPower = () => [0, 0, 190, 260][stage()] * (1 - 0.22 * mercy());
      const speed = () => SPEED + Math.min(passed, GOAL) * 1.6;
      const nikNear = () => obs.some(o => o.nik && o.x + NIK_OFF > EVA_X - 24 && o.x + NIK_OFF < EVA_X + 150);

      function showBanner(key) {
        const left = PGOAL - photos.length;
        const B = [null, [['WARM-UP'], 'Aufwärmen!'], [['PARTY'], 'Achtung Bass-Drops!'], [['DISKO-', 'STURM!'], "Jetzt geht's ab!"],
          [['ZUGABE!'], 'Noch ' + left + (left === 1 ? ' Foto!' : ' Fotos!')]][key];
        banner = { lines: B[0], sub: B[1], t: 2.0 };
        stageShown = key;
      }

      function reset() {
        state = 'ready'; y = 140; vy = 0; if (!gapsDone) passed = 0;
        obs = []; subs = []; hazards = []; spawned = 0; planned = null; deadT = 0; playT = 0;
        gust = { phase: 'none', t: 0, dir: -1, next: 0, n: 0 }; nextHazard = 2.5; stageShown = 0;
        nextSpawnAt = scroll + 150;
      }

      function nextKind() {
        const have = new Set(photos.map(p => p.kind)); subs.forEach(s => have.add(s.kind));
        let pool = FRIENDS.filter(k => !have.has(k));
        if (!pool.length || Math.random() < 0.3) pool = pool.concat(['ball', 'cannon'].filter(k => !have.has(k)));
        if (!pool.length) pool = FRIENDS.concat(['ball', 'cannon']).filter(k => !subs.some(s => s.kind === k));
        return pool[(Math.random() * pool.length) | 0];
      }
      function placeObs(o) {
        const c = o.c + Math.sin(frameT * o.w + o.ph) * o.amp;
        o.top = Math.round(c - o.g / 2); o.bot = Math.round(c + o.g / 2);
      }
      function spawn() {
        const idx = spawned, enc = gapsDone || idx >= GOAL, st = enc ? 1 : stageOf(idx), m = mercy();
        const g = enc ? ENC_GAP + 6 * m : BASE_GAP + MERCY_STEP * m - (st === 3 ? STORM_NARROW : 0);
        const moves = !enc && (idx === 3 || idx === 4 || idx === 6);
        const amp = moves ? (idx === 6 ? 18 : 13) * (1 - 0.25 * m) : 0;
        const minC = 56 + g / 2 + amp, maxC = GROUND - 30 - g / 2 - amp;
        let c = planned != null ? planned : (idx === 0 ? 150 + (Math.random() * 2 - 1) * 16 : lastGapY + (Math.random() * 2 - 1) * (st === 1 ? 45 : 58));
        planned = null;
        c = clamp(c, minC, maxC); lastGapY = c;
        const o = { x: W + 4, c, g, amp, ph: Math.random() * 6.28, w: 1.5 + Math.random() * 0.5, top: 0, bot: 0, passed: false, seed: (Math.random() * 97) | 0, nik: null, enc };
        if (!enc && NIK_AT.includes(idx)) {
          planned = clamp(c + (Math.random() * 2 - 1) * 28, 56 + g / 2 + 14, GROUND - 30 - g / 2 - 14); lastGapY = planned;
          o.nik = { c: Math.max(115, (c + planned) / 2), ph: Math.random() * Math.PI * 2, li: NIK_AT.indexOf(idx), hit: false, taken: false };
        }
        placeObs(o); obs.push(o); spawned++;
        if (!o.nik) subs.push({ kind: nextKind(), x: o.x + OB_W + (SPACING - OB_W) / 2, y: clamp(c + 6 + (Math.random() * 2 - 1) * 12, 72, 228), ph: Math.random() * 6, taken: false, fb: -1 });
        return o;
      }

      function spawnHazard() {
        const WARN = 1.0, dist = Math.max(40, y + 10 - 40), d1 = HAZ_V * HAZ_V / (2 * HAZ_G);
        const fallT = dist < d1 ? Math.sqrt(2 * dist / HAZ_G) : HAZ_V / HAZ_G + (dist - d1) / HAZ_V;
        const x = EVA_X + 12 + speed() * (WARN + fallT);
        if (x > W + 30 || nikNear()) return;
        for (const o of obs) if (x > o.x - 10 && x < o.x + OB_W + 10) return;
        hazards.push({ x, y: 40, vy: 0, warn: WARN, kind: Math.random() < 0.7 ? 'stick' : 'popper', rot: 0, c: LIGHTS[(Math.random() * 6) | 0] });
      }

      function hitbox() { return { l: EVA_X + 6, r: EVA_X + 19, t: y - 12, b: y + 30 }; }

      function crash() {
        state = 'dead'; deadT = 0; shake = 0.3; flashT = 0.12; crashes++;
        api.sfx('hit');
        if (crashes % 2 === 0 && crashes / 2 <= MERCY_MAX) toastTimer = setTimeout(() => api.toast('Mehr Platz, weniger Bass!', 2000), 400);
      }

      function flap() {
        if (state === 'won') return;
        if (state === 'dead') { if (deadT < 0.35) return; reset(); }
        if (state === 'ready') { state = 'play'; nextSpawnAt = scroll + 60; }
        vy = FLAP; popT = 0.12;
        api.sfx('flap');
      }

      function checkWin() {
        if (state === 'play' && gapsDone && photos.length >= PGOAL) {
          state = 'won'; winT = 0; hazards = []; gust.phase = 'none';
          burst(W / 2, 150, 60, -80, 80, -140, -40);
        }
      }

      /* ---------- photo ---------- */
      const VF_L = 80, VF_W = 60, VF_H = 62;
      function viewfinder() { const t = Math.round(y) - 14; return { l: VF_L, r: VF_L + VF_W, t, b: t + VF_H, cx: VF_L + VF_W / 2, cy: t + VF_H / 2 }; }
      function targets() {
        const out = [];
        subs.forEach(s => { if (!s.taken) out.push({ ref: s, kind: s.kind, x: s.x, y: subY(s) }); });
        obs.forEach(o => { if (o.nik && !o.nik.taken) { const p = nikPos(o); out.push({ ref: o.nik, kind: 'niklas', x: p.bx, y: p.by + BR + 12 }); } });
        return out;
      }
      const inFrame = (t, vf) => t.x > vf.l && t.x < vf.r && t.y > vf.t && t.y < vf.b;
      const SLOT_W = 18, SLOT_H = 21, SLOT_GAP = 4, SLOT_X0 = W - 6 - (PGOAL * SLOT_W + (PGOAL - 1) * SLOT_GAP), SLOT_Y = 3;
      function takePhoto() {
        if (state === 'ready' || state === 'dead') { flap(); return; }
        if (state !== 'play' || shotCD > 0) return;
        shotCD = 0.35; flashT = Math.max(flashT, 0.16);
        api.sfx('click'); setTimeout(() => api.sfx('step'), 70);
        const vf = viewfinder();
        let best = null, bd = 9;
        targets().forEach(t => {
          if (!inFrame(t, vf)) return;
          const d = Math.max(Math.abs(t.x - vf.cx) / (VF_W / 2), Math.abs(t.y - vf.cy) / (VF_H / 2));
          if (d < bd) { bd = d; best = t; }
        });
        if (!best) { pops.push({ txt: 'Nichts im Sucher', x: vf.cx, y: vf.t - 6, t: 0, c: '#f6e7c8' }); return; }
        best.ref.taken = true;
        const q = bd < 0.38 ? 0 : bd < 0.72 ? 1 : 2;
        const idx = photos.length;
        photos.push({ kind: best.kind, q });
        setTimeout(() => api.sfx(q === 0 ? 'ding' : 'coin'), 140);
        pops.push({ txt: ['PERFEKT!', 'SCHARF!', 'Verwackelt!'][q], x: vf.cx, y: vf.t - 6, t: 0, c: q === 0 ? '#ffe23f' : '#ffffff' });
        burst(best.x, best.y, 14, -40, 40, -70, -10);
        if (idx < PGOAL) flying.push({ kind: best.kind, x0: best.x - 15, y0: best.y - 18, idx, t: 0 });
        if (photos.length === PGOAL && !gapsDone) api.toast('Album voll! Jetzt noch die Lücken.', 1800);
        checkWin();
      }
      function drawPolaroid(kind, x, yy, s) {
        const w = Math.round(SLOT_W * s), h = Math.round(SLOT_H * s);
        ctx.fillStyle = '#f6f1e4'; ctx.fillRect(x, yy, w, h);
        const iw = w - Math.round(4 * s), ih = h - Math.round(8 * s), ix = x + Math.round(2 * s), iy = yy + Math.round(2 * s);
        ctx.fillStyle = '#1e0d36'; ctx.fillRect(ix, iy, iw, ih);
        ctx.fillStyle = '#ff3fa4'; ctx.fillRect(ix, iy + ih - Math.max(1, Math.round(2 * s)), iw, Math.max(1, Math.round(2 * s)));
        const sp = thumb(kind), k = Math.min(iw / sp.width, ih / sp.height);
        const dw = sp.width * k, dh = sp.height * k;
        ctx.drawImage(sp, Math.round(ix + (iw - dw) / 2), Math.round(iy + (ih - dh) / 2), Math.round(dw), Math.round(dh));
      }

      /* ---------- album (DOM overlay, one tap to close) ---------- */
      function showAlbum() {
        if (albumEl) return;
        albumEl = document.createElement('div');
        albumEl.style.cssText = 'position:absolute;inset:0;z-index:5;background:rgba(16,6,30,.95);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:12px 16px;box-sizing:border-box;overflow:auto;';
        albumEl.innerHTML = '<div style="font-family:\'Press Start 2P\',monospace;font-size:15px;color:#ffe23f;text-shadow:2px 2px 0 #ff3fa4">Fotoalbum</div>' +
          '<div style="font-family:VT323,monospace;font-size:18px;color:#f6e7c8">Evas Disko-Nacht 📸</div>';
        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,150px));gap:12px;width:100%;justify-content:center;';
        photos.slice(0, PGOAL).forEach((p, i) => {
          const card = document.createElement('div');
          const rt = (i % 2 ? 1 : -1) * (1 + (i % 3));
          card.style.cssText = 'background:#f6f1e4;padding:6px 6px 4px;box-shadow:4px 4px 0 rgba(0,0,0,.45);transform:rotate(' + rt + 'deg);';
          const c2 = document.createElement('canvas'); c2.width = 40; c2.height = 30;
          c2.style.cssText = 'width:100%;aspect-ratio:4/3;display:block;image-rendering:pixelated;';
          const g = c2.getContext('2d'); g.imageSmoothingEnabled = false;
          g.fillStyle = '#160a29'; g.fillRect(0, 0, 40, 30);
          g.globalAlpha = 0.18; g.fillStyle = LIGHTS[i % 6]; g.beginPath(); g.moveTo(4, 0); g.lineTo(22, 26); g.lineTo(30, 26); g.closePath(); g.fill();
          g.fillStyle = LIGHTS[(i + 3) % 6]; g.beginPath(); g.moveTo(36, 0); g.lineTo(10, 26); g.lineTo(16, 26); g.closePath(); g.fill(); g.globalAlpha = 1;
          for (let k = 0; k < 5; k++) { g.fillStyle = LIGHTS[(k + i) % 6]; g.globalAlpha = k % 2 ? 0.9 : 0.4; g.fillRect(k * 8, 26, 8, 4); }
          g.globalAlpha = 1;
          for (let k = 0; k < 6; k++) { g.fillStyle = '#ffffff'; g.fillRect((k * 13 + i * 5) % 38, (k * 7 + i * 3) % 20, 1, 1); }
          const sp = thumb(p.kind), sc = Math.max(1, Math.floor(Math.min(34 / sp.width, 24 / sp.height)));
          const dx = Math.round((40 - sp.width * sc) / 2) + (p.q === 2 ? 2 : 0), dy = Math.max(0, 27 - sp.height * sc);
          if (p.q === 2) { g.globalAlpha = 0.45; g.drawImage(sp, dx - 3, dy, sp.width * sc, sp.height * sc); g.globalAlpha = 1; }
          g.drawImage(sp, dx, dy, sp.width * sc, sp.height * sc);
          const cap = document.createElement('div');
          cap.textContent = CAPS[p.kind][p.q];
          cap.style.cssText = 'font-family:VT323,monospace;font-size:16px;line-height:1;color:#2b1c12;text-align:center;margin-top:4px;min-height:32px;display:flex;align-items:center;justify-content:center;';
          card.appendChild(c2); card.appendChild(cap); grid.appendChild(card);
        });
        albumEl.appendChild(grid);
        const btn = document.createElement('button');
        btn.className = 'btn'; btn.textContent = 'Weiter ✓';
        btn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); finish(); });
        albumEl.appendChild(btn);
        albumEl.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (albumT > 1) finish(); });
        root.appendChild(albumEl); camBtn.style.display = 'none';
        api.sfx('ding');
      }
      function finish() { if (won) return; won = true; api.win(); }

      /* ---------- input ---------- */
      const camBtn = document.createElement('button');
      camBtn.textContent = '📸';
      camBtn.setAttribute('aria-label', 'Foto machen');
      camBtn.style.cssText = 'position:absolute;right:14px;bottom:14px;z-index:4;width:76px;height:76px;border-radius:50%;border:4px solid #1b1b1b;background:#ffe23f;font-size:36px;line-height:1;box-shadow:inset -4px -4px 0 rgba(0,0,0,.25),0 4px 0 #000;touch-action:none;cursor:pointer;padding:0;';
      camBtn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); camBtn.style.transform = 'translateY(3px)'; takePhoto(); });
      const camUp = () => { camBtn.style.transform = ''; };
      camBtn.addEventListener('pointerup', camUp); camBtn.addEventListener('pointerleave', camUp);
      root.appendChild(camBtn);

      function onPointer(e) { e.preventDefault(); flap(); }
      function onKey(e) {
        if (albumEl) { if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') { e.preventDefault(); finish(); } return; }
        if (e.code === 'KeyF' || e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); if (!e.repeat) takePhoto(); }
        else if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); if (!e.repeat) flap(); }
      }
      root.addEventListener('pointerdown', onPointer);
      window.addEventListener('keydown', onKey);

      /* ---------- pixel sprites for HUD / hazards ---------- */
      const ARROW_UP = ['...a...', '..aaa..', '.aaaaa.', 'aaaaaaa', '..aaa..', '..aaa..', '..aaa..'];
      const ARROW_DN = ARROW_UP.slice().reverse();
      const STICK = [
        ['.c.', 'cwc', 'cwc', 'cwc', 'cwc', 'cwc', '.c.'],
        ['....cw', '...cwc', '..cwc.', '.cwc..', 'cwc...', 'wc....'],
        ['.ccccc.', 'cwwwwwc', '.ccccc.'],
        ['wc....', 'cwc...', '.cwc..', '..cwc.', '...cwc', '....cw']];
      const POPPER = ['p.y.c', '.c.p.', '.gGg.', '.gGg.', '..g..'];

      /* ---------- loop ---------- */
      const stop = api.loop((dt) => {
        frameT += dt;
        const beat = beatNow(), bi = Math.floor(beat), pulse = Math.pow(1 - (beat - bi), 2);
        rot += dt * 1.8;
        const moving = state === 'ready' || state === 'play' || state === 'won';
        const spd = moving ? speed() : 0;
        scroll += spd * dt;
        shotCD = Math.max(0, shotCD - dt);
        if (albumEl) albumT += dt;
        if (state === 'play' && stageKey() !== stageShown) showBanner(stageKey());
        banner.t = Math.max(0, banner.t - dt);
        const tgt = state === 'ready' ? 0.4 : state === 'won' ? 1 : [0, 0.45, 0.75, 1][stage()];
        dk += (tgt - dk) * Math.min(1, dt * 1.5);

        // ----- BASS-DROP gusts (from PARTY on) -----
        let gustAcc = 0;
        if (state === 'play') {
          playT += dt; gust.t += dt;
          const st = stage(), allowed = st >= 2 && !gapsDone;
          if (gust.phase === 'none') {
            if (allowed && gust.next === 0) gust.next = playT + 1.2;
            if (allowed && playT > gust.next && !nikNear()) {
              gust = { phase: 'warn', t: 0, dir: gust.n === 0 ? 1 : (Math.random() < 0.5 ? 1 : -1), next: 0, n: gust.n + 1 };
              api.sfx('launch');
            }
          } else if (gust.phase === 'warn' && gust.t >= 1.0) { gust.phase = 'push'; gust.t = 0; shake = Math.max(shake, 0.15); api.sfx('boom'); }
          else if (gust.phase === 'push' && gust.t >= 0.9) {
            const gt = st === 3 ? [2.6, 3.6] : [3.4, 4.8];
            gust = { phase: 'none', t: 0, dir: gust.dir, n: gust.n, next: playT + gt[0] + Math.random() * (gt[1] - gt[0]) + mercy() * 0.7 };
          }
          if (gust.phase === 'push') gustAcc = gust.dir * gustPower() * (0.55 + 0.45 * Math.sin(Math.min(1, gust.t / 0.9) * Math.PI));
        } else if (state !== 'won') gust.phase = 'none';
        const gustVis = gust.phase === 'push' ? 1 : gust.phase === 'warn' ? gust.t : 0;
        const warnFlash = gust.phase === 'warn' ? (Math.floor(gust.t * 10) % 2 ? 1 : 0.3) : gust.phase === 'push' ? 1 : 0;
        const pump = Math.max(pulse * (0.4 + 0.6 * dk), warnFlash);

        if (state === 'ready') {
          y = 140 + Math.sin(frameT * 3) * 4;
        } else if (state === 'play' || state === 'won') {
          vy = Math.min(MAXFALL + (gustAcc > 0 ? 50 : 0), vy + (GRAV + gustAcc) * dt);
          y += vy * dt;
          if (y < 34) { y = 34; if (vy < 0) vy = 0; }
          if (state === 'won') {
            if (y > 150 && vy > 0) vy = FLAP * 0.7;
            winT += dt;
            if (winT > 1.4 && !flying.length) showAlbum();
          }
          if (state === 'play' && (spawned < GOAL || photos.length < PGOAL) && scroll >= nextSpawnAt) {
            const o = spawn(); nextSpawnAt = scroll + SPACING + (o.nik ? NIK_EXTRA : 0);
          }
          obs.forEach(o => { o.x -= spd * dt; placeObs(o); });
          subs.forEach(s => { s.x -= spd * dt; });
          obs = obs.filter(o => o.x > -OB_W - 10 - (o.nik ? NIK_OFF + 20 : 0));
          subs = subs.filter(s => s.x > -30);

          // falling glow sticks (from gap 3, not in the encore)
          if (state === 'play' && passed >= 3 && !gapsDone) {
            nextHazard -= dt;
            if (nextHazard <= 0) { spawnHazard(); nextHazard = (stage() === 3 ? 3.4 : 5) + Math.random() * 2 + mercy() * 2; }
          }
          hazards.forEach(h => {
            h.x -= spd * dt;
            if (h.warn > 0) h.warn -= dt; else { h.vy = Math.min(HAZ_V, h.vy + HAZ_G * dt); h.y += h.vy * dt; h.rot += dt * 10; }
            if (h.y >= GROUND - 4) burst(h.x + 3, GROUND - 2, 8, -30, 30, -60, -20);
          });
          hazards = hazards.filter(h => h.y < GROUND - 4 && h.x > -12);

          if (state === 'play') {
            const hb = hitbox();
            for (const o of obs) {
              if (hb.r > o.x + 1 && hb.l < o.x + OB_W - 1 && (hb.t < o.top - 2 || hb.b > o.bot)) { crash(); break; }
              if (o.nik && nikHit(o, hb)) { o.nik.hit = true; crash(); break; }
              if (!o.passed && o.x + OB_W < hb.l) {
                o.passed = true;
                if (!gapsDone) {
                  passed++; api.sfx('coin');
                  if (passed >= GOAL) { gapsDone = true; hazards = []; gust.phase = 'none'; if (photos.length < PGOAL) showBanner(4); }
                }
                checkWin();
                if (state !== 'play') break;
              }
            }
            if (state === 'play') for (const h of hazards) {
              if (h.warn > 0) continue;
              if (h.x + 5 > hb.l + 1 && h.x + 1 < hb.r - 1 && h.y + 8 > y + 2 && h.y + 2 < y + 30) { crash(); break; }
            }
            if (state === 'play' && y + 32 >= GROUND) { y = GROUND - 32; crash(); }
          }
        } else if (state === 'dead') {
          deadT += dt;
          vy = Math.min(260, vy + GRAV * 1.3 * dt);
          y = Math.min(GROUND - 32, y + vy * dt);
        }
        shake = Math.max(0, shake - dt); flashT = Math.max(0, flashT - dt); popT = Math.max(0, popT - dt);
        flying.forEach(f => { f.t += dt; }); flying = flying.filter(f => f.t < 0.7);
        pops.forEach(p => { p.t += dt; }); pops = pops.filter(p => p.t < 1);
        // confetti cannons fire every 2 beats while on screen
        subs.forEach(s => { if (s.kind === 'cannon' && s.x < W + 10) { const b2 = Math.floor(beat / 2); if (b2 !== s.fb) { s.fb = b2; burst(s.x + 9, subY(s) - 9, 10, 10, 60, -110, -50); } } });
        confetti.forEach(p => { p.x += (p.vx - spd) * dt; p.y += p.vy * dt; p.vy += 120 * dt; p.vx *= 0.98; p.life -= dt; });
        confetti = confetti.filter(p => p.life > 0 && p.y < GROUND);

        /* ---------- draw ---------- */
        ctx.save();
        if (shake > 0) ctx.translate(Math.round((Math.random() * 2 - 1) * 3), Math.round((Math.random() * 2 - 1) * 2));
        ctx.drawImage(sky, 0, 0);
        // rays from the giant disco ball
        ctx.globalCompositeOperation = 'lighter';
        for (let j = 0; j < 4; j++) beamTri(BIG_X, BIG_Y, frameT * 0.45 + j * 1.57, 320, 0.04, LIGHTS[(bi + j) % 6], (0.04 + 0.04 * pulse) * dk);
        ctx.globalCompositeOperation = 'source-over';
        tile(city, scroll * 0.12, 0);
        // giant disco ball
        ctx.fillStyle = '#4a4a5a'; ctx.fillRect(BIG_X, 0, 1, BIG_Y - 17);
        bigBall.render(rot * 0.5, beat, frameT);
        ctx.globalAlpha = 0.55; ctx.drawImage(bigBall.c, BIG_X - 17, BIG_Y - 17); ctx.globalAlpha = 1;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.05 + 0.08 * pulse * dk; disc(BIG_X, BIG_Y, 23, '#b45cff'); ctx.restore();
        tile(crowd, scroll * 0.35, GROUND - 44 - Math.round(pulse * 2 * dk));
        // sweeping corner beams
        ctx.globalCompositeOperation = 'lighter';
        const a = (0.05 + 0.05 * pulse) * dk;
        beamTri(2, HUD_H, Math.PI * 0.3 + Math.sin(frameT * 0.9) * 0.45, 380, 0.08, LIGHTS[bi % 6], a);
        beamTri(W - 2, HUD_H, Math.PI * 0.7 + Math.sin(frameT * 1.1 + 1) * 0.45, 380, 0.08, LIGHTS[(bi + 3) % 6], a);
        // reflection dots
        for (let i = 0; i < DOTS.length; i++) {
          const d = DOTS[i], xx = W + 10 - (((d.a + rot * 0.06 * d.sp) % 1) * (W + 20));
          ctx.globalAlpha = dk * (0.4 + 0.35 * Math.sin(frameT * 6 + i));
          ctx.fillStyle = d.c < 0 ? '#ffffff' : LIGHTS[d.c];
          ctx.fillRect(xx | 0, d.y | 0, d.s + 1, d.s);
        }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

        subs.forEach(s => drawSubject(s, bi, beat, rot));
        obs.forEach(o => { const x = Math.round(o.x); drawRig(x, o.top, o, bi, dk, pulse); drawSpeakerTower(x, o.bot, o, pump, bi, warnFlash); });
        hazards.forEach(h => { // telegraph: faint drop line + "!"
          if (h.warn <= 0 || Math.floor(h.warn * 8) % 2) return;
          const hx = Math.round(h.x);
          ctx.fillStyle = 'rgba(255,255,255,.12)'; for (let yy = HUD_H + 10; yy < GROUND; yy += 8) ctx.fillRect(hx + 2, yy, 2, 3);
          api.text(ctx, '!', hx + 3, HUD_H + 2, 8, '#ffe23f', 'center');
        });
        obs.forEach(o => { if (o.nik) drawNiklas(o, beat, rot, dk); });

        // dance floor
        ctx.fillStyle = '#120a1e'; ctx.fillRect(0, GROUND, W, H - GROUND);
        const off = Math.floor(scroll) % 12;
        for (let gx = -off, c = Math.floor(scroll / 12); gx < W; gx += 12, c++) for (let r = 0; r < 3; r++) {
          const on = ((c + r + bi) % 3 + 3) % 3 === 0;
          ctx.globalAlpha = on ? 0.3 + 0.5 * pulse * dk : 0.12;
          ctx.fillStyle = LIGHTS[((c * 2 + r + bi) % 6 + 6) % 6];
          ctx.fillRect(gx + 1, GROUND + 2 + r * 8, 10, 7);
        }
        ctx.globalAlpha = 1;
        hazards.forEach(h => { // shadow on the floor
          const hx = Math.round(h.x), blink = h.warn > 0 ? Math.floor(h.warn * 8) % 2 === 0 : true;
          if (!blink) return;
          ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(hx - 3, GROUND, 12, 2); ctx.fillRect(hx - 1, GROUND - 1, 8, 1); ctx.fillRect(hx - 1, GROUND + 2, 8, 1);
        });
        hazards.forEach(h => {
          const hx = Math.round(h.x), hy = Math.round(h.y);
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.18; disc(hx + 3, hy + 4, 6, h.c); ctx.restore();
          if (h.kind === 'stick') { const p = STICK[Math.floor(h.rot / (Math.PI / 4)) % 4]; api.drawPixels(ctx, p, { c: h.c, w: '#ffffff' }, hx + 3 - Math.floor(p[0].length / 2), hy + 4 - Math.floor(p.length / 2), 1); }
          else api.drawPixels(ctx, POPPER, { p: '#ff3fa4', y: '#ffe23f', c: '#3fe0ff', g: '#f5c542', G: '#c9a52a' }, hx, hy, 1.5);
        });
        confetti.forEach(p => { ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), Math.sin(frameT * 9 + p.ph) > 0 ? 2 : 1, 1); });

        const ey = Math.round(y);
        drawFlyer(EVA_X, ey, frameT, state === 'dead' ? 'idle' : 'jump', pulse * dk);
        ctx.fillStyle = '#1b1b1b'; ctx.fillRect(EVA_X + 18, ey + 15, 7, 5);
        ctx.fillStyle = '#5a6a7a'; ctx.fillRect(EVA_X + 23, ey + 16, 3, 3);
        ctx.fillStyle = '#d94c3d'; ctx.fillRect(EVA_X + 19, ey + 14, 2, 1);
        if (popT > 0) { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(EVA_X + 6, ey + 34, 3, 2); ctx.fillRect(EVA_X + 14, ey + 35, 3, 2); }
        if (state === 'play' || state === 'ready') { // viewfinder corners
          const vf = viewfinder();
          const hot = state === 'play' && targets().some(t => inFrame(t, vf));
          ctx.fillStyle = hot ? '#ffe23f' : 'rgba(255,255,255,.5)';
          const L = 6, th = hot ? 2 : 1;
          [[vf.l, vf.t, 1, 1], [vf.r, vf.t, -1, 1], [vf.l, vf.b, 1, -1], [vf.r, vf.b, -1, -1]].forEach(([cx, cy, sx, sy]) => {
            ctx.fillRect(sx > 0 ? cx : cx - L, sy > 0 ? cy : cy - th, L, th);
            ctx.fillRect(sx > 0 ? cx : cx - th, sy > 0 ? cy : cy - L, th, L);
          });
          ctx.fillRect(Math.round(vf.cx) - 1, Math.round(vf.cy), 3, 1); ctx.fillRect(Math.round(vf.cx), Math.round(vf.cy) - 1, 1, 3);
        }
        // bass-drop chevrons showing the push direction
        if (gustVis > 0.15) {
          const dir = gust.dir; ctx.globalAlpha = 0.3 * gustVis; ctx.fillStyle = '#ffffff';
          for (let j = 0; j < 9; j++) {
            const cx = 12 + (j * 47) % (W - 24), span = GROUND - HUD_H - 20;
            const cy = HUD_H + 10 + (((frameT * 150 * dir + j * 61) % span) + span) % span;
            for (let i = 0; i < 4; i++) { const yy = Math.round(cy + (dir > 0 ? i : -i)); ctx.fillRect(cx - 4 + i, yy, 2, 1); ctx.fillRect(cx + 3 - i, yy, 2, 1); }
          }
          ctx.globalAlpha = 1;
        }
        ctx.restore();

        // beat pulse + camera flash
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = dk * pulse * 0.06; ctx.fillStyle = LIGHTS[bi % 6]; ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        if (flashT > 0) { ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.7, flashT * 5).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); }
        pops.forEach(p => api.text(ctx, p.txt, Math.round(p.x), Math.round(p.y - p.t * 14), 8, p.c, 'center'));

        // HUD: gaps left, photo strip right
        ctx.fillStyle = 'rgba(8,4,16,.6)'; ctx.fillRect(0, 0, W, HUD_H);
        api.text(ctx, Math.min(passed, GOAL) + '/' + GOAL, 34, 5, 16, gapsDone ? '#7cff4f' : '#ffffff', 'center');
        if (gapsDone && photos.length < PGOAL) { if (Math.floor(frameT * 3) % 2 === 0) api.text(ctx, 'ZUGABE', 34, 25, 8, '#ff3fa4', 'center'); }
        else api.text(ctx, 'Lücken', 34, 25, 8, '#c8b8e8', 'center');
        for (let i = 0; i < PGOAL; i++) {
          const sx = SLOT_X0 + i * (SLOT_W + SLOT_GAP);
          if (photos[i] && !flying.some(f => f.idx === i)) drawPolaroid(photos[i].kind, sx, SLOT_Y, 1);
          else { ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(sx, SLOT_Y, SLOT_W, SLOT_H); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(sx + 7, SLOT_Y + 8, 4, 3); }
        }
        const shown = Math.min(PGOAL, photos.length - flying.length);
        api.text(ctx, 'Fotos ' + shown + '/' + PGOAL, SLOT_X0 + (PGOAL * SLOT_W + (PGOAL - 1) * SLOT_GAP) / 2, SLOT_Y + SLOT_H + 3, 8, shown >= PGOAL ? '#7cff4f' : '#ffffff', 'center');
        flying.forEach(f => {
          const kk = Math.min(1, f.t / 0.6), e = 1 - Math.pow(1 - kk, 3);
          const tx = SLOT_X0 + f.idx * (SLOT_W + SLOT_GAP), s = 1.8 - 0.8 * e;
          drawPolaroid(f.kind, Math.round(f.x0 + (tx - f.x0) * e), Math.round(f.y0 + (SLOT_Y - f.y0) * e), s);
        });

        // bass-drop warning + direction arrow
        if (state === 'play' && gust.phase !== 'none') {
          const warn = gust.phase === 'warn';
          if (!warn || Math.floor(gust.t * 6) % 2 === 0) {
            if (warn) api.text(ctx, 'BASS-DROP!', W / 2, HUD_H + 6, 16, LIGHTS[bi % 6], 'center');
            const ax = W - 24, ay = 128;
            ctx.fillStyle = 'rgba(8,4,16,.6)'; ctx.fillRect(ax - 6, ay - 6, 26, 30);
            api.drawPixels(ctx, gust.dir < 0 ? ARROW_UP : ARROW_DN, { a: warn ? '#ffe23f' : '#ffffff' }, ax, ay + 2, 2);
          }
        }
        // stage banner
        if (state === 'play' && banner.t > 0 && (banner.t < 1.7 || Math.floor(banner.t * 10) % 2 === 0)) {
          const by = 70, bh = 14 + banner.lines.length * 18;
          ctx.fillStyle = 'rgba(8,4,16,.72)'; ctx.fillRect(8, by, W - 16, bh);
          ctx.fillStyle = LIGHTS[bi % 6]; ctx.fillRect(8, by, W - 16, 2); ctx.fillRect(8, by + bh - 2, W - 16, 2);
          banner.lines.forEach((l, i) => api.text(ctx, l, W / 2, by + 5 + i * 18, 16, '#ffe23f', 'center'));
          api.text(ctx, banner.sub, W / 2, by + bh - 12, 8, '#f6e7c8', 'center');
        }
        if (state === 'won' && !albumEl) {
          api.text(ctx, 'Geschafft!', W / 2, 120, 16, LIGHTS[bi % 6], 'center');
        } else if (state === 'ready') {
          ctx.fillStyle = 'rgba(8,4,16,.65)'; ctx.fillRect(8, 200, W - 16, 48);
          api.text(ctx, 'Tippen = fliegen', W / 2, 205, 8, '#f6e7c8', 'center');
          api.text(ctx, '📸 = Foto knipsen', W / 2, 219, 8, '#ffe23f', 'center');
          api.text(ctx, '7 Lücken + 4 Fotos', W / 2, 233, 8, '#3fe0ff', 'center');
        } else if (state === 'dead' && deadT > 0.35) {
          ctx.fillStyle = 'rgba(8,4,16,.65)'; ctx.fillRect(14, 120, W - 28, 46);
          api.text(ctx, 'Autsch!', W / 2, 124, 8, '#ffe23f', 'center');
          api.text(ctx, photos.length ? 'Fotos bleiben!' : 'Gleich nochmal!', W / 2, 138, 8, '#f6e7c8', 'center');
          if (Math.floor(deadT * 2.5) % 2 === 0) api.text(ctx, 'Tippen = weiter', W / 2, 152, 8, '#f6e7c8', 'center');
        }
      });

      reset();

      return function cleanup() {
        stop(); clearTimeout(toastTimer);
        root.removeEventListener('pointerdown', onPointer);
        window.removeEventListener('keydown', onKey);
        camBtn.remove(); if (albumEl) albumEl.remove();
        cv.destroy();
      };
    }
  };
})();

/* Ballonflug – tap to flap with Eva hanging from birthday balloons through an autumn beech forest. */
(function () {
  'use strict';

  GAMES['flappy'] = {
    title: 'Ballonflug',
    intro: 'Eva hebt ab! Tippe, um mit den Ballons nach oben zu flattern. Flieg durch 10 Lücken.',
    start(root, api) {
      const W = 180, H = 320, GROUND = 296, GOAL = 10;
      const cv = api.makeCanvas(root, W, H);
      const ctx = cv.ctx;
      api.music('game');

      /* ---------- tuning (gentle) ---------- */
      const GRAV = 400, FLAP = -150, MAXFALL = 190, SPEED = 58, SPACING = 118, OB_W = 28;
      const BASE_GAP = 118, MERCY_STEP = 14, MERCY_MAX = 3;
      const EVA_X = 46; // left of Eva sprite (scale 2 => 24x32)

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

      /* ---------- state ---------- */
      let crashes = 0, state = 'ready', y = 140, vy = 0, passed = 0, scroll = 0, obs = [], spawned = 0, nextSpawnAt = 0;
      let toastTimer = 0, deadT = 0, shake = 0, flashT = 0, winT = 0, won = false, frameT = 0, popT = 0;
      const gapSize = () => BASE_GAP + MERCY_STEP * Math.min(MERCY_MAX, Math.floor(crashes / 3));

      function reset() {
        state = 'ready'; y = 140; vy = 0; passed = 0; obs = []; spawned = 0; nextSpawnAt = scroll + 150; deadT = 0;
      }
      let lastGapY = 150;
      function spawn() {
        const g = gapSize();
        const minC = 40 + g / 2, maxC = GROUND - 30 - g / 2;
        let c = lastGapY + (Math.random() * 2 - 1) * 60;
        if (spawned === 0) c = 150 + (Math.random() * 2 - 1) * 20;
        c = Math.max(minC, Math.min(maxC, c));
        lastGapY = c;
        obs.push({ x: W + 4, top: Math.round(c - g / 2), bot: Math.round(c + g / 2), passed: false, seed: (Math.random() * 97) | 0 });
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
        const moving = state === 'ready' || state === 'play' || state === 'won';
        const spd = moving ? SPEED : 0;
        scroll += spd * dt;

        if (state === 'ready') {
          y = 140 + Math.sin(frameT * 3) * 4;
        } else if (state === 'play' || state === 'won') {
          vy = Math.min(MAXFALL, vy + GRAV * dt);
          y += vy * dt;
          if (y < 14) { y = 14; if (vy < 0) vy = 0; } // ceiling: clamp only
          if (state === 'won') {
            // auto-pilot: float gently around the middle
            if (y > 150 && vy > 0) vy = FLAP * 0.7;
            winT += dt;
          }
          // spawn
          if (state === 'play' && spawned < GOAL && scroll >= nextSpawnAt) { spawn(); nextSpawnAt = scroll + SPACING; }
          obs.forEach(o => { o.x -= spd * dt; });
          obs = obs.filter(o => o.x > -OB_W - 10);
          if (state === 'play') {
            const hb = hitbox();
            for (const o of obs) {
              if (hb.r > o.x + 1 && hb.l < o.x + OB_W - 1 && (hb.t < o.top - 2 || hb.b > o.bot)) { crash(); break; }
              if (!o.passed && o.x + OB_W < hb.l) {
                o.passed = true; passed++; api.sfx('coin');
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
        obs.forEach(o => { drawBranch(Math.round(o.x), o.top, o.seed); drawTrunk(Math.round(o.x), o.bot); });
        tile(canopy, scroll * 0.6, -4);
        tile(ground, scroll, GROUND);

        drawFlyer(EVA_X, Math.round(y), frameT, state === 'dead' ? 'idle' : 'jump');
        if (popT > 0) { // little puff under Eva on flap
          ctx.fillStyle = 'rgba(255,255,255,.7)';
          ctx.fillRect(EVA_X + 6, Math.round(y) + 34, 3, 2); ctx.fillRect(EVA_X + 14, Math.round(y) + 35, 3, 2);
        }
        leaves.forEach(l => {
          if (l.far) return;
          ctx.fillStyle = l.c; const lx = Math.round(l.x), ly = Math.round(l.y);
          ctx.fillRect(lx, ly, 3, 2); if (Math.sin(frameT * 4 + l.ph) > 0) ctx.fillRect(lx + 1, ly + 2, 1, 1);
        });
        ctx.restore();

        if (flashT > 0) { ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(0, 0, W, H); }

        // HUD
        if (state === 'won') {
          const pulse = 1 + Math.round(Math.sin(winT * 6));
          api.text(ctx, GOAL + '/' + GOAL, W / 2, 110 - pulse, 32, '#f5c542', 'center');
          api.text(ctx, 'Geschafft!', W / 2, 152, 16, '#ffffff', 'center');
        } else {
          api.text(ctx, passed + '/' + GOAL, W / 2, 14, 16, '#ffffff', 'center');
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
